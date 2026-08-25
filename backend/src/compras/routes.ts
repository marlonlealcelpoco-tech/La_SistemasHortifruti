import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../auth/authorization.js";
import { UserRepository } from "../auth/user-repository.js";
import { ROLE_POLICY } from "../auth/role-policy.js";
import { ProductRepository } from "../cadastro/produtos/repository.js";
import { parseNfeXml } from "./xml-parser.js";
import { PurchaseRepository, type PurchaseItemInput } from "./repository.js";

const purchaseIdSchema = z.object({ id: z.coerce.number().int().positive() });
const manualItemSchema = z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().positive(), unitCost: z.coerce.number().nonnegative() });
const manualPurchaseSchema = z.object({ supplierId: z.coerce.number().int().positive(), items: z.array(manualItemSchema).min(1) });
const xmlSchema = z.object({ xml: z.string().min(20) });
const createProductSchema = z.object({ code: z.string().trim().min(1).max(60).optional(), name: z.string().trim().min(2).max(180).optional(), unit: z.string().trim().min(1).max(20).default("UN"), salePrice: z.coerce.number().nonnegative().optional(), profitMarginPct: z.coerce.number().min(0).max(999.99).default(0) });
const importItemSchema = z.object({ itemNumber: z.coerce.number().int().positive(), action: z.enum(["LINK", "CREATE"]), productId: z.coerce.number().int().positive().optional(), product: createProductSchema.optional() });
const importSchema = z.object({ supplierId: z.coerce.number().int().positive(), xml: z.string().min(20), items: z.array(importItemSchema).min(1) });
const confirmSchema = z.object({ salePriceUpdates: z.array(z.object({ itemId: z.coerce.number().int().positive(), applySuggestedSalePrice: z.boolean() })).default([]) });

export function registerPurchaseRoutes(app: FastifyInstance, users: UserRepository, purchases: PurchaseRepository, products: ProductRepository) {
  const purchaseRoles = ROLE_POLICY.PURCHASE_MAINTENANCE;
  app.post("/purchases", { onRequest: [app.authenticate] }, async (request, reply) => { if (!(await requireRoles(request, reply, users, purchaseRoles))) return; const input = manualPurchaseSchema.parse(request.body); const created = await purchases.createManual(input.supplierId, input.items); return reply.code(201).send(created); });
  app.post("/purchases/xml/preview", { onRequest: [app.authenticate] }, async (request, reply) => { if (!(await requireRoles(request, reply, users, purchaseRoles))) return; const { xml } = xmlSchema.parse(request.body); try { return { invoice: parseNfeXml(xml), items: await purchases.previewXml(parseNfeXml(xml)) }; } catch (error) { return reply.code(400).send({ message: error instanceof Error ? error.message : "Não foi possível interpretar o XML." }); } });
  app.post("/purchases/import-xml", { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!(await requireRoles(request, reply, users, purchaseRoles))) return;
    const input = importSchema.parse(request.body);
    try {
      const parsed = parseNfeXml(input.xml); const preview = await purchases.previewXml(parsed); const decisions = new Map(input.items.map((item) => [item.itemNumber, item])); const purchaseItems: PurchaseItemInput[] = [];
      for (const xmlItem of parsed.items) {
        const decision = decisions.get(xmlItem.itemNumber); if (!decision) return reply.code(400).send({ message: `Defina Vincular ou Cadastrar para o item ${xmlItem.itemNumber}.` });
        const previewItem = preview.find((item) => item.itemNumber === xmlItem.itemNumber); let productId: number;
        if (decision.action === "LINK") { productId = decision.productId ?? previewItem?.match?.id ?? 0; if (!productId) return reply.code(400).send({ message: `Selecione um produto cadastrado para vincular ao item ${xmlItem.itemNumber}.` }); }
        else { const draft = decision.product; const margin = draft?.profitMarginPct ?? 0; const salePrice = draft?.salePrice ?? Number((xmlItem.unitCost * (1 + margin / 100)).toFixed(2)); const product = await products.create({ code: draft?.code ?? xmlItem.code, name: draft?.name ?? xmlItem.name, unit: draft?.unit ?? "UN", cost: xmlItem.unitCost, salePrice, profitMarginPct: margin }); productId = product.id; }
        purchaseItems.push({ productId, quantity: xmlItem.quantity, unitCost: xmlItem.unitCost, xmlItemNumber: xmlItem.itemNumber, referenceCode: xmlItem.code, referenceDescription: xmlItem.name });
      }
      const created = await purchases.createImported(input.supplierId, parsed, input.xml, purchaseItems); return reply.code(201).send({ ...created, priceReview: created.items.map((item) => ({ itemId: item.id, costBefore: item.cost_before, salePriceBefore: item.sale_price_before, costAfter: item.unit_cost, suggestedSalePrice: item.suggested_sale_price })) });
    } catch (error) { return reply.code(400).send({ message: error instanceof Error ? error.message : "Não foi possível importar o XML." }); }
  });
  app.post("/purchases/:id/confirm", { onRequest: [app.authenticate] }, async (request, reply) => { if (!(await requireRoles(request, reply, users, purchaseRoles))) return; const { id } = purchaseIdSchema.parse(request.params); const input = confirmSchema.parse(request.body); const salePriceUpdates = new Map(input.salePriceUpdates.map((item) => [item.itemId, item.applySuggestedSalePrice])); const result = await purchases.confirm(id, salePriceUpdates); if (result.kind !== "success") { if (result.kind === "not_found") return reply.code(404).send({ message: "Compra não encontrada." }); return reply.code(409).send({ message: "Esta compra já foi confirmada ou não está em rascunho." }); } return { purchase: result.purchase }; });
}
