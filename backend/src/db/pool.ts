import { Pool } from "pg";
import type { Environment } from "../config.js";

export function createPool(environment: Environment): Pool {
  return new Pool({
    connectionString: environment.DATABASE_URL,
    max: 10
  });
}
