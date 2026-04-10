"use client";

import * as React from "react";
import { demoLogin } from "@/lib/actions/demo-auth";
import { DEMO_LOGIN_EMAIL } from "@/lib/auth/demo-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [err, setErr] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="mt-8 grid gap-4"
      action={async (fd) => {
        setPending(true);
        setErr(null);
        const res = await demoLogin(fd);
        if (res?.error) setErr(res.error);
        setPending(false);
      }}
    >
      {err ? <p className="text-sm text-[#b91c1c]">{err}</p> : null}
      <div className="grid gap-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={DEMO_LOGIN_EMAIL}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="login-pass">Mật khẩu</Label>
        <Input
          id="login-pass"
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue="123456"
          required
        />
      </div>
      <Button variant="primary" type="submit" className="w-full" disabled={pending}>
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
