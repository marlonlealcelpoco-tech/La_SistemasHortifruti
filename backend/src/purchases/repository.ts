import type { Pool, PoolClient } from "pg";
import type { XmlPurchase, XmlPurchaseItem } from "./xml-parser.js";

export type ProductMatch = { id: number; code: string; name: string; cost: string; sale_price: string; profit_margin_pct: string };
export type ImportPreviewItem = XmlPurchaseItem & { match: ProductMatch | null; costBefore: number | null; salePriceBefore: number | null; suggestedSalePrice: number | null; resolution: "FOUND" | "UNRESOLVED" };
export type PurchaseItemInput = { productId: number; quantity: number; unitCost: number; xmlItemNumber?: number; referenceCode?: string | null; referenceDescription?: string | null };
export type PurchaseRecord = { id: number; supplier_id: number | null; status: string; total: string; source: string; xml_access_key: string | null; created_at: Date };
export type PurchaseItemRecord = { id: number; product_id: number | null; quantity: string; unit_cost: string; total: string; xml_item_number: number | null; source_code: string | null; source_description: string | null; cost_before: string | null; sale_price_before: string | null; suggested_sale_price: string | null };
export type CreatedPurchase = { purchase: PurchaseRecord; items: PurchaseItemRecord[] };

export class PurchaseRepository {
  constructor(private readonly pool: Pool) {}

  async previewXml(xml: XmlPurchase): Promise<ImportPreviewItem[]> {
    const codes = [...new Set(xml.items.map((item) => item.code.toUpperCase()))];
    const result = await this.pool.query<ProductMatch>(`SELECT id, code, name, cost, sale_price, profit_margin_pct FROM products WHERE UPPER(code) = ANY($1::text[])`, [codes]);
    const products = new Map(result.rows.map((product) => [product.code.toUpperCase(), product]));
    return xml.items.map((item) => {
      const match = products.get(item.code.toUpperCase()) ?? null;
      const margin = match ? Number(match.profit_margin_pct) : 0;
      return { ...item, match, costBefore: match ? Number(match.cost) : null, salePriceBefore: match ? Number(match.sale_price) : null, suggestedSalePrice: match ? Number((item.unitCost * (1 + margin / 100)).toFixed(2)) : null, resolution: match ? "FOUND" : "UNRESOLVED" };
    });
  }

  async createManual(supplierId: number, items: PurchaseItemInput[]): Promise<CreatedPurchase> { return this.createPurchase({ supplierId, source: "MANUAL", items, xmlAccessKey: null, xmlRaw: null }); }
  async createImported(supplierId: number, xml: XmlPurchase, xmlRaw: string, items: PurchaseItemInput[]): Promise<CreatedPurchase> { return this.createPurchase({ supplierId, source: "XML", items, xmlAccessKey: xml.accessKey ?? null, xmlRaw }); }

  async confirm(purchaseId: number, salePriceUpdates: Map<number, boolean>): Promise<{ kind: "not_found" | "already_confirmed" } | { kind: "success"; purchase: PurchaseRecord }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const purchase = await client.query<PurchaseRecord>(`SELECT id, supplier_id, status, total, source, xml_access_key, created_at FROM purchases WHERE id = $1 FOR UPDATE`, [purchaseId]);
      const record = purchase.rows[0];
      if (!record) { await client.query("ROLLBACK"); return { kind: "not_found" }; }
      if (record.status !== "DRAFT") { await client.query("ROLLBACK"); return { kind: "already_confirmed" }; }
      const items = await client.query<PurchaseItemRecord>(`SELECT id, product_id, quantity, unit_cost, total, xml_item_number, source_code, source_description, cost_before, sale_price_before, suggested_sale_price FROM purchase_items WHERE purchase_id = $1 FOR UPDATE`, [purchaseId]);
      if (items.rows.some((item) => item.product_id === null)) throw new Error("Todos os itens devem estar vinculados a um produto antes da confirmação.");

      for (const item of items.rows) {
        const productId = item.product_id as number;
        await client.query("SELECT id FROM products WHERE id = $1 FOR UPDATE", [productId]);
        await client.query("UPDATE products SET cost = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [productId, item.unit_cost]);
        if (salePriceUpdates.get(item.id) && item.suggested_sale_price !== null) await client.query("UPDATE products SET sale_price = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [productId, item.suggested_sale_price]);
        const stock = await client.query<{ quantity: string }>("UPDATE stock SET quantity = quantity + $2 WHERE product_id = $1 RETURNING quantity", [productId, item.quantity]);
        if (!stock.rows[0]) throw new Error("Estoque do produto não encontrado.");
        await client.query(`INSERT INTO stock_movements (product_id, type, quantity, reference, notes) VALUES ($1, 'ENTRY', $2, $3, $4)`, [productId, item.quantity, `COMPRA-${purchaseId}`, "Entrada por confirmação de compra"]);
      }

      // A confirmação da compra gera a obrigação financeira uma única vez.
      const existingPayable = await client.query<{ id: number }>("SELECT id FROM financial_entries WHERE purchase_id = $1 AND type = 'PAYABLE' LIMIT 1", [purchaseId]);
      if (!existingPayable.rows[0]) {
        const payable = await client.query<{ id: number }>(
          `INSERT INTO financial_entries (type, description, amount, due_date, supplier_id, source, document_number, purchase_id)
           VALUES ('PAYABLE', $1, $2, CURRENT_DATE, $3, 'PURCHASE', $4, $5) RETURNING id`,
          [`Compra ${purchaseId} - Conta a Pagar`, Number(record.total), record.supplier_id, `COMPRA-${purchaseId}`, purchaseId]
        );
        await client.query(`INSERT INTO financial_installments (financial_entry_id, installment_number, due_date, amount, settled_amount, status) VALUES ($1, 1, CURRENT_DATE, $2, 0, 'PENDING')`, [payable.rows[0].id, Number(record.total)]);
      }

      const confirmed = await client.query<PurchaseRecord>(`UPDATE purchases SET status = 'CONFIRMED' WHERE id = $1 RETURNING id, supplier_id, status, total, source, xml_access_key, created_at`, [purchaseId]);
      await client.query("COMMIT");
      return { kind: "success", purchase: confirmed.rows[0] };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  private async createPurchase(input: { supplierId: number; source: "MANUAL" | "XML"; items: PurchaseItemInput[]; xmlAccessKey: string | null; xmlRaw: string | null }): Promise<CreatedPurchase> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
      const purchase = await client.query<PurchaseRecord>(`INSERT INTO purchases (supplier_id, status, total, source, xml_access_key, xml_raw) VALUES ($1, 'DRAFT', $2, $3, $4, $5) RETURNING id, supplier_id, status, total, source, xml_access_key, created_at`, [input.supplierId, total, input.source, input.xmlAccessKey, input.xmlRaw]);
      const items: PurchaseItemRecord[] = [];
      for (const item of input.items) items.push(await this.insertItem(client, purchase.rows[0].id, item));
      await client.query("COMMIT");
      return { purchase: purchase.rows[0], items };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  private async insertItem(client: PoolClient, purchaseId: number, item: PurchaseItemInput): Promise<PurchaseItemRecord> {
    const product = await client.query<ProductMatch>(`SELECT id, code, name, cost, sale_price, profit_margin_pct FROM products WHERE id = $1 FOR UPDATE`, [item.productId]);
    const match = product.rows[0];
    if (!match) throw new Error("Produto informado não existe.");
    const suggestedSalePrice = Number((item.unitCost * (1 + Number(match.profit_margin_pct) / 100)).toFixed(2));
    const result = await client.query<PurchaseItemRecord>(`INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, total, xml_item_number, source_code, source_description, cost_before, sale_price_before, suggested_sale_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, product_id, quantity, unit_cost, total, xml_item_number, source_code, source_description, cost_before, sale_price_before, suggested_sale_price`, [purchaseId, item.productId, item.quantity, item.unitCost, item.quantity * item.unitCost, item.xmlItemNumber ?? null, item.referenceCode ?? match.code, item.referenceDescription ?? match.name, match.cost, match.sale_price, suggestedSalePrice]);
    return result.rows[0];
  }
}
