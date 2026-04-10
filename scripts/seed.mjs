/**
 * Seed dữ liệu mẫu qua DATABASE_URL (Postgres trực tiếp).
 * Usage: npm run db:seed
 *
 * Nếu gặp ENETUNREACH (IPv6): script tự resolve IPv4 và nối với
 * servername TLS = hostname gốc (Supabase).
 */
import { lookup } from "node:dns/promises";
import { setDefaultResultOrder } from "node:dns";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

setDefaultResultOrder("ipv4first");

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(join(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* no .env */
  }
}

loadEnv();

let connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("Thiếu DATABASE_URL trong .env");
  process.exit(1);
}

/** @type {{ rejectUnauthorized?: boolean; servername?: string } | undefined} */
let ssl =
  connectionString.includes("supabase.co") ||
  connectionString.includes("sslmode=require") ||
  process.env.PGSSLMODE === "require"
    ? { rejectUnauthorized: false }
    : undefined;

const hostMatch = connectionString.match(/@([^/:?]+)/);
const originalHost = hostMatch?.[1];
if (
  originalHost &&
  !/^\d{1,3}(\.\d{1,3}){3}$/.test(originalHost) &&
  process.env.SEED_SKIP_IPV4_FIX !== "1"
) {
  try {
    const { address } = await lookup(originalHost, { family: 4 });
    connectionString = connectionString.replace(originalHost, address);
    if (ssl) ssl = { ...ssl, servername: originalHost };
  } catch (e) {
    console.warn("Không resolve IPv4, dùng hostname gốc:", e.message);
  }
}

const sqlPath = join(root, "supabase", "seed", "demo_seed.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString, ssl });

try {
  await client.connect();
  await client.query(sql);
  console.log("OK: đã chèn dữ liệu mẫu (DEMO-*)");
} catch (e) {
  console.error("Lỗi seed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
