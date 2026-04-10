import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabaseUrl(): string {
  const u = process.env.SUPABASE_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  const db = process.env.DATABASE_URL?.trim();
  if (db) {
    const m = db.match(/@db\.([^.]+)\.supabase\.co/i);
    if (m?.[1]) return `https://${m[1]}.supabase.co`;
  }
  throw new Error(
    "Thiếu SUPABASE_URL (hoặc DATABASE_URL dạng Supabase @db.<ref>.supabase.co).",
  );
}

let _admin: SupabaseClient | null = null;

/** Client dùng service role — chỉ gọi từ Server Actions / Route Handlers. */
export function createSupabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Thiếu SUPABASE_SERVICE_ROLE_KEY (server-only). Lấy từ Supabase Dashboard → Settings → API.",
    );
  }
  if (!_admin) {
    _admin = createClient(getSupabaseUrl(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
