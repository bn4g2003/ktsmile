"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEMO_LOGIN_EMAIL,
  DEMO_LOGIN_PASSWORD,
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_VALUE,
} from "@/lib/auth/demo-session";

export async function demoLogin(formData: FormData): Promise<{ error?: string } | void> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (email !== DEMO_LOGIN_EMAIL.toLowerCase() || password !== DEMO_LOGIN_PASSWORD) {
    return { error: "Sai email hoặc mật khẩu." };
  }
  const jar = await cookies();
  jar.set(DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function demoLogout(_formData: FormData): Promise<void> {
  const jar = await cookies();
  jar.delete(DEMO_SESSION_COOKIE);
  redirect("/login");
}
