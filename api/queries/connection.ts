import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    const url = new URL(env.databaseUrl);
    const isLocal =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";

    const pool = mysql.createPool({
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      // Managed hosts like Aiven require TLS. Local MySQL does not.
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      connectionLimit: 5,
      enableKeepAlive: true,
    });

    instance = drizzle(pool, { mode: "default", schema: fullSchema });
  }
  return instance;
}
