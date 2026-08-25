import type { Pool } from "pg";

export type ProductRecord = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  cost: string;
  sale_price: string;
  profit_margin_pct: string;
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  tax_code_type: string | null;
  tax_code: string | null;
  origin: number | null;
  gtin: string | null;
  gtin_trib: string | null;
  tax_unit: string | null;
  icms_rate: string;
  pis_cst: string | null;
  pis_rate: string;
  cofins_cst: string | null;
  cofins_rate: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  quantity: string;
  minimum_quantity: string;
};

export type ProductInput = {
  code: string;
  name: string;
  description?: string | null;
  unit: string;
  cost: number;
  salePrice: number;
  profitMarginPct: number;
  ncm?: string | null;
  cest?: string | null;
  cfop?: string | null;
  taxCodeType?: "CST" | "CSOSN" | null;
  taxCode?: string | null;
  origin?: number | null;
  gtin?: string | null;
  gtinTrib?: string | null;
  taxUnit?: string | null;
  icmsRate?: number;
  pisCst?: string | null;
  pisRate?: number;
  cofinsCst?: string | null;
  cofinsRate?: number;
};

const productColumns = `products.id, products.code, products.name, products.description, products.unit,
  products.cost, products.sale_price, products.profit_margin_pct,
  products.ncm, products.cest, products.cfop, products.tax_code_type, products.tax_code,
  products.origin, products.gtin, products.gtin_trib, products.tax_unit,
  products.icms_rate, products.pis_cst, products.pis_rate, products.cofins_cst, products.cofins_rate,
  products.active, products.created_at, products.updated_at,
  stock.quantity, stock.minimum_quantity`;

export class ProductRepository {
  constructor(private readonly pool: Pool) {}

  async list(search?: string): Promise<ProductRecord[]> {
    const term = search?.trim();
    const base = `SELECT ${productColumns} FROM products
      INNER JOIN stock ON stock.product_id = products.id`;
    if (!term) return (await this.pool.query<ProductRecord>(`${base} ORDER BY products.name`)).rows;
    return (await this.pool.query<ProductRecord>(`${base} WHERE products.code ILIKE $1 OR products.name ILIKE $1 ORDER BY products.name`, [`%${term}%`])).rows;
  }

  async create(input: ProductInput): Promise<ProductRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const product = await client.query<{ id: number }>(`INSERT INTO products (code,name,description,unit,cost,sale_price,profit_margin_pct,ncm,cest,cfop,tax_code_type,tax_code,origin,gtin,gtin_trib,tax_unit,icms_rate,pis_cst,pis_rate,cofins_cst,cofins_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`, [input.code.trim().toUpperCase(),input.name.trim(),input.description??null,input.unit,input.cost,input.salePrice,input.profitMarginPct,input.ncm??null,input.cest??null,input.cfop??null,input.taxCodeType??null,input.taxCode??null,input.origin??null,input.gtin??null,input.gtinTrib??null,input.taxUnit??null,input.icmsRate??0,input.pisCst??null,input.pisRate??0,input.cofinsCst??null,input.cofinsRate??0]);
      await client.query("INSERT INTO stock (product_id) VALUES ($1)",[product.rows[0].id]);
      const result = await client.query<ProductRecord>(`SELECT ${productColumns} FROM products INNER JOIN stock ON stock.product_id=products.id WHERE products.id=$1`,[product.rows[0].id]);
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async update(id:number,input:ProductInput):Promise<ProductRecord|undefined>{
    const result=await this.pool.query<{id:number}>(`UPDATE products SET code=$2,name=$3,description=$4,unit=$5,cost=$6,sale_price=$7,profit_margin_pct=$8,ncm=$9,cest=$10,cfop=$11,tax_code_type=$12,tax_code=$13,origin=$14,gtin=$15,gtin_trib=$16,tax_unit=$17,icms_rate=$18,pis_cst=$19,pis_rate=$20,cofins_cst=$21,cofins_rate=$22,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id`,[id,input.code.trim().toUpperCase(),input.name.trim(),input.description??null,input.unit,input.cost,input.salePrice,input.profitMarginPct,input.ncm??null,input.cest??null,input.cfop??null,input.taxCodeType??null,input.taxCode??null,input.origin??null,input.gtin??null,input.gtinTrib??null,input.taxUnit??null,input.icmsRate??0,input.pisCst??null,input.pisRate??0,input.cofinsCst??null,input.cofinsRate??0]);
    if(!result.rows[0]) return undefined;
    return (await this.pool.query<ProductRecord>(`SELECT ${productColumns} FROM products INNER JOIN stock ON stock.product_id=products.id WHERE products.id=$1`,[id])).rows[0];
  }

  async setActive(id:number,active:boolean):Promise<ProductRecord|undefined>{
    const updated=await this.pool.query<{id:number}>(`UPDATE products SET active=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id`,[id,active]);
    if(!updated.rows[0]) return undefined;
    return (await this.pool.query<ProductRecord>(`SELECT ${productColumns} FROM products INNER JOIN stock ON stock.product_id=products.id WHERE products.id=$1`,[id])).rows[0];
  }

  async setMinimumQuantity(id:number,minimumQuantity:number):Promise<ProductRecord|undefined>{
    const updated=await this.pool.query<{product_id:number}>(`UPDATE stock SET minimum_quantity=$2 WHERE product_id=$1 RETURNING product_id`,[id,minimumQuantity]);
    if(!updated.rows[0]) return undefined;
    return (await this.pool.query<ProductRecord>(`SELECT ${productColumns} FROM products INNER JOIN stock ON stock.product_id=products.id WHERE products.id=$1`,[id])).rows[0];
  }
}

export type { ProductRecord as ProductRow };
