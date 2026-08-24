import { buildApp } from "./app.js";
import { loadEnvironment } from "./config.js";
import { createPool } from "./db/pool.js";

const environment = loadEnvironment();
const pool = createPool(environment);
const app = buildApp(environment, pool);

async function start() {
  try {
    await app.listen({ host: environment.HOST, port: environment.PORT });
  } catch (error) {
    app.log.error(error);
    await pool.end();
    process.exit(1);
  }
}

void start();
