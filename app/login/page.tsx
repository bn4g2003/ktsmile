import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/modules/auth/login-form";
import { BrandLogo } from "@/components/shared/brand-logo";
import { DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE } from "@/lib/auth/demo-session";

export default async function LoginPage() {
  const jar = await cookies();
  if (jar.get(DEMO_SESSION_COOKIE)?.value === DEMO_SESSION_VALUE) {
    redirect("/");
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface-muted)] px-4 py-12">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-card)] ring-1 ring-[var(--border-ghost)]">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo size={80} priority className="shadow-[var(--shadow-card)] ring-1 ring-[var(--border-ghost)]" />
          <h1 className="text-center text-2xl font-bold tracking-tight text-[var(--primary)]">
            KT Smile Lab
          </h1>
        </div>
        <p className="mt-1 text-center text-sm text-[var(--on-surface-muted)]">
          Đăng nhập 
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
