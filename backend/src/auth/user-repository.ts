import type { Pool } from "pg";

export const ROLE_NAMES = ["ADMIN", "GERENTE", "SUPERVISOR", "VENDAS", "ESTOQUE", "FINANCEIRO"] as const;
export type UserRole = (typeof ROLE_NAMES)[number];

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  active: boolean;
};

export type UserSummary = Omit<UserRecord, "password_hash"> & {
  roles: UserRole[];
};

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  async count(): Promise<number> {
    const result = await this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users");
    return Number(result.rows[0].count);
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query<UserRecord>(
      "SELECT id, name, email, password_hash, active FROM users WHERE email = $1 LIMIT 1",
      [email.toLowerCase()]
    );
    return result.rows[0];
  }

  async findById(id: number): Promise<UserRecord | undefined> {
    const result = await this.pool.query<UserRecord>(
      "SELECT id, name, email, password_hash, active FROM users WHERE id = $1 LIMIT 1",
      [id]
    );
    return result.rows[0];
  }

  async findRoleNames(userId: number): Promise<UserRole[]> {
    const result = await this.pool.query<{ name: UserRole }>(
      `SELECT roles.name
       FROM roles
       INNER JOIN user_roles ON user_roles.role_id = roles.id
       WHERE user_roles.user_id = $1
       ORDER BY roles.name`,
      [userId]
    );
    return result.rows.map((row) => row.name);
  }

  async list(): Promise<UserSummary[]> {
    const result = await this.pool.query<UserSummary>(
      `SELECT users.id, users.name, users.email, users.active,
        COALESCE(array_agg(roles.name) FILTER (WHERE roles.name IS NOT NULL), '{}') AS roles
       FROM users
       LEFT JOIN user_roles ON user_roles.user_id = users.id
       LEFT JOIN roles ON roles.id = user_roles.role_id
       GROUP BY users.id
       ORDER BY users.name`
    );
    return result.rows;
  }

  async createWithRoles(name: string, email: string, passwordHash: string, roles: UserRole[]): Promise<UserSummary> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const created = await client.query<UserRecord>(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
         RETURNING id, name, email, password_hash, active`,
        [name.trim(), email.toLowerCase(), passwordHash]
      );
      const user = created.rows[0];
      const assigned = await client.query<{ name: UserRole }>(
        "SELECT name FROM roles WHERE name = ANY($1::text[])", [roles]
      );
      if (assigned.rows.length !== roles.length) throw new Error("Um ou mais perfis não existem.");
      await client.query(
        "INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = ANY($2::text[])",
        [user.id, roles]
      );
      await client.query("COMMIT");
      return { ...this.toSummary(user), roles };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceRoles(userId: number, roles: UserRole[]): Promise<UserSummary | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<UserRecord>(
        "SELECT id, name, email, password_hash, active FROM users WHERE id = $1 FOR UPDATE", [userId]
      );
      const user = existing.rows[0];
      if (!user) { await client.query("ROLLBACK"); return undefined; }
      await client.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
      const assigned = await client.query<{ name: UserRole }>(
        "SELECT name FROM roles WHERE name = ANY($1::text[])", [roles]
      );
      if (assigned.rows.length !== roles.length) throw new Error("Um ou mais perfis não existem.");
      await client.query(
        "INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = ANY($2::text[])",
        [userId, roles]
      );
      await client.query("COMMIT");
      return { ...this.toSummary(user), roles };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async setActive(userId: number, active: boolean): Promise<UserSummary | undefined> {
    const result = await this.pool.query<UserRecord>(
      `UPDATE users SET active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1
       RETURNING id, name, email, password_hash, active`, [userId, active]
    );
    const user = result.rows[0];
    if (!user) return undefined;
    return { ...this.toSummary(user), roles: await this.findRoleNames(user.id) };
  }

  private toSummary(user: UserRecord): Omit<UserSummary, "roles"> {
    const { password_hash: _passwordHash, ...summary } = user;
    return summary;
  }
}
