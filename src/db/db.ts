import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import { env } from "../config/env.js";

const { Pool } = pkg;

import * as schema from "./schema/index.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
