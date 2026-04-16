"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { AUTH_SESSION_COOKIE } from "@/lib/auth/session";

export async function login(formData: FormData): Promise<{ error?: string } | void> {
  const account = String(formData.get("account") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!account || !password) return { error: "Thiếu tài khoản hoặc mật khẩu." };

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("employees")
    .select("id, code, full_name, username, email, password_plain, is_active")
    .or(`username.eq.${account},email.eq.${account},code.eq.${account}`)
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Không tìm thấy tài khoản." };
  if (!Boolean(data["is_active"])) return { error: "Tài khoản đã bị khóa." };
  if (String(data["password_plain"] ?? "") !== password) return { error: "Sai mật khẩu." };

  const jar = await cookies();
  jar.set(AUTH_SESSION_COOKIE, data["id"] as string, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_SESSION_COOKIE);
  redirect("/login");
}
