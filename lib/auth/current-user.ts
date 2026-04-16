"use server";

import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { AUTH_SESSION_COOKIE } from "@/lib/auth/session";

export type CurrentUser = {
  employee_id: string;
  code: string;
  full_name: string;
  email: string | null;
  permissions: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const employeeId = jar.get(AUTH_SESSION_COOKIE)?.value ?? null;
  if (!employeeId) return null;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("employees")
    .select("id, code, full_name, email, permissions, is_active")
    .eq("id", employeeId)
    .maybeSingle();
  if (error) return null;
  if (!data || !Boolean(data["is_active"])) return null;
  return {
    employee_id: data["id"] as string,
    code: data["code"] as string,
    full_name: data["full_name"] as string,
    email: (data["email"] as string | null) ?? null,
    permissions: (data["permissions"] as string | null) ?? null,
  };
}
