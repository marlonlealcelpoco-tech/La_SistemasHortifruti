import type { Pool } from "pg";

export type PartyType = "customers" | "suppliers";

export type PartyRecord = {
  id: number;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type PartyInput = {
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
};

function tableFor(type: PartyType): string {
  return type === "customers" ? "customers" : "suppliers";
}

export class PartyRepository {
  constructor(private readonly pool: Pool) {}

  async list(type: PartyType, search?: string): Promise<PartyRecord[]> {
    const table = tableFor(type);
    const normalizedSearch = search?.trim();

    if (!normalizedSearch) {
      const result = await this.pool.query<PartyRecord>(
        `SELECT id, name, document, email, phone, active, created_at, updated_at
         FROM ${table}
         ORDER BY name`
      );
      return result.rows;
    }

    const result = await this.pool.query<PartyRecord>(
      `SELECT id, name, document, email, phone, active, created_at, updated_at
       FROM ${table}
       WHERE name ILIKE $1 OR document ILIKE $1 OR email ILIKE $1
       ORDER BY name`,
      [`%${normalizedSearch}%`]
    );
    return result.rows;
  }

  async create(type: PartyType, input: PartyInput): Promise<PartyRecord> {
    const table = tableFor(type);
    const result = await this.pool.query<PartyRecord>(
      `INSERT INTO ${table} (name, document, email, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, document, email, phone, active, created_at, updated_at`,
      [input.name.trim(), input.document ?? null, input.email?.toLowerCase() ?? null, input.phone ?? null]
    );
    return result.rows[0];
  }

  async update(id: number, type: PartyType, input: PartyInput): Promise<PartyRecord | undefined> {
    const table = tableFor(type);
    const result = await this.pool.query<PartyRecord>(
      `UPDATE ${table}
       SET name = $2, document = $3, email = $4, phone = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, document, email, phone, active, created_at, updated_at`,
      [id, input.name.trim(), input.document ?? null, input.email?.toLowerCase() ?? null, input.phone ?? null]
    );
    return result.rows[0];
  }

  async setActive(id: number, type: PartyType, active: boolean): Promise<PartyRecord | undefined> {
    const table = tableFor(type);
    const result = await this.pool.query<PartyRecord>(
      `UPDATE ${table}
       SET active = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, document, email, phone, active, created_at, updated_at`,
      [id, active]
    );
    return result.rows[0];
  }
}
