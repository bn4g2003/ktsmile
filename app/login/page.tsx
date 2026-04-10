import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/modules/auth/login-form";
import { DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE } from "@/lib/auth/demo-session";

export default async function LoginPage() {
  const jar = await cookies();
  if (jar.get(DEMO_SESSION_COOKIE)?.value === DEMO_SESSION_VALUE) {
    redirect("/");
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface-muted)] px-4 py-12">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-card)] ring-1 ring-[var(--border-ghost)]">
        <h1 className="text-center text-2xl font-bold tracking-tight text-[var(--primary)]">
          KT Smile Lab
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--on-surface-muted)]">
          Đăng nhập demo (phiên bản thử nghiệm)
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
