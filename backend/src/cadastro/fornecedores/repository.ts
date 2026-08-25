import type { Pool } from "pg";

export type SupplierRecord = {
  id: number;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type SupplierInput = {
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
};

export class SupplierRepository {
  constructor(private readonly pool: Pool) {}

  async list(search?: string): Promise<SupplierRecord[]> {
    const normalizedSearch = search?.trim();
    const result = normalizedSearch
      ? await this.pool.query<SupplierRecord>(
          `SELECT id, name, document, email, phone, active, created_at, updated_at
           FROM suppliers
           WHERE name ILIKE $1 OR document ILIKE $1 OR email ILIKE $1
           ORDER BY name`,
          [`%${normalizedSearch}%`]
        )
      : await this.pool.query<SupplierRecord>(
          `SELECT id, name, document, email, phone, active, created_at, updated_at
           FROM suppliers
           ORDER BY name`
        );
    return result.rows;
  }

  async create(input: SupplierInput): Promise<SupplierRecord> {
    const result = await this.pool.query<SupplierRecord>(
      `INSERT INTO suppliers (name, document, email, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, document, email, phone, active, created_at, updated_at`,
      [input.name.trim(), input.document ?? null, input.email?.toLowerCase() ?? null, input.phone ?? null]
    );
    return result.rows[0];
  }

  async update(id: number, input: SupplierInput): Promise<SupplierRecord | undefined> {
    const result = await this.pool.query<SupplierRecord>(
      `UPDATE suppliers
       SET name = $2, document = $3, email = $4, phone = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, document, email, phone, active, created_at, updated_at`,
      [id, input.name.trim(), input.document ?? null, input.email?.toLowerCase() ?? null, input.phone ?? null]
    );
    return result.rows[0];
  }

  async setActive(id: number, active: boolean): Promise<SupplierRecord | undefined> {
    const result = await this.pool.query<SupplierRecord>(
      `UPDATE suppliers
       SET active = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, document, email, phone, active, created_at, updated_at`,
      [id, active]
    );
    return result.rows[0];
  }
}
