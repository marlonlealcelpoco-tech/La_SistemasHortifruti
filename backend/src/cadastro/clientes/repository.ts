import type { Pool } from "pg";

export type CustomerRecord = {
  id: number;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type CustomerInput = {
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
};

export class CustomerRepository {
  constructor(private readonly pool: Pool) {}

  async list(search?: string): Promise<CustomerRecord[]> {
    const normalizedSearch = search?.trim();
    if (!normalizedSearch) {
      const result = await this.pool.query<CustomerRecord>(
        `SELECT id, name, document, email, phone, active, created_at, updated_at
         FROM customers ORDER BY name`
      );
      return result.rows;
    }
    const result = await this.pool.query<CustomerRecord>(
      `SELECT id, name, document, email, phone, active, created_at, updated_at
       FROM customers
       WHERE name ILIKE $1 OR document ILIKE $1 OR email ILIKE $1
       ORDER BY name`,
      [`%${normalizedSearch}%`]
    );
    return result.rows;
  }

  async create(input: CustomerInput): Promise<CustomerRecord> {
    const result = await this.pool.query<CustomerRecord>(
      `INSERT INTO customers (name, document, email, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, document, email, phone, active, created_at, updated_at`,
      [input.name.trim(), input.document ?? null, input.email?.toLowerCase() ?? null, input.phone ?? null]
    );
    return result.rows[0];
  }

  async update(id: number, input: CustomerInput): Promise<CustomerRecord | undefined> {
    const result = await this.pool.query<CustomerRecord>(
      `UPDATE customers
       SET name = $2, document = $3, email = $4, phone = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, document, email, phone, active, created_at, updated_at`,
      [id, input.name.trim(), input.document ?? null, input.email?.toLowerCase() ?? null, input.phone ?? null]
    );
    return result.rows[0];
  }

  async setActive(id: number, active: boolean): Promise<CustomerRecord | undefined> {
    const result = await this.pool.query<CustomerRecord>(
      `UPDATE customers
       SET active = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, document, email, phone, active, created_at, updated_at`,
      [id, active]
    );
    return result.rows[0];
  }
}
