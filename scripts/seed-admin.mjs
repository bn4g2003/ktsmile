/**
 * Tạo/cập nhật tài khoản admin mặc định để đăng nhập hệ thống.
 * Usage: node scripts/seed-admin.mjs
 */
import { lookup } from "node:dns/promises";
import { setDefaultResultOrder } from "node:dns";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

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

const admin = {
  code: "UPDEV",
  full_name: "updev",
  role: "Quản trị hệ thống",
  permissions: "admin",
  username: "updev",
  email: "updev@gmail.com",
  password_plain: "123456",
};

const sql = `
insert into public.employees (
  code, full_name, role, permissions, username, email, password_plain, base_salary, is_active
)
values ($1, $2, $3, $4, $5, $6, $7, 0, true)
on conflict (code) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  permissions = excluded.permissions,
  username = excluded.username,
  email = excluded.email,
  password_plain = excluded.password_plain,
  is_active = true,
  updated_at = now()
returning id, code, username, email, permissions;
`;

async function upsertViaPostgres() {
  const client = new pg.Client({ connectionString, ssl });
  await client.connect();
  try {
    const { rows } = await client.query(sql, [
      admin.code,
      admin.full_name,
      admin.role,
      admin.permissions,
      admin.username,
      admin.email,
      admin.password_plain,
    ]);
    return rows[0];
  } finally {
    await client.end().catch(() => {});
  }
}

async function upsertViaSupabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY để fallback.");
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("employees")
    .upsert(
      {
        code: admin.code,
        full_name: admin.full_name,
        role: admin.role,
        permissions: admin.permissions,
        username: admin.username,
        email: admin.email,
        password_plain: admin.password_plain,
        base_salary: 0,
        is_active: true,
      },
      { onConflict: "code" },
    )
    .select("id, code, username, email, permissions")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

try {
  let row;
  try {
    row = await upsertViaPostgres();
  } catch (pgErr) {
    console.warn("Postgres trực tiếp lỗi, chuyển sang Supabase REST:", pgErr.message);
    row = await upsertViaSupabase();
  }
  console.log("OK: admin ready");
  console.log(
    `id=${row.id} code=${row.code} username=${row.username} email=${row.email} permissions=${row.permissions}`,
  );
  console.log("Login: account=updev@gmail.com, password=123456");
} catch (e) {
  console.error("Lỗi tạo admin:", e.message);
  process.exitCode = 1;
}
