"use client";

import * as React from "react";
import { login } from "@/lib/actions/auth";
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
        const res = await login(fd);
        if (res?.error) setErr(res.error);
        setPending(false);
      }}
    >
      {err ? <p className="text-sm text-[#b91c1c]">{err}</p> : null}
      <div className="grid gap-2">
        <Label htmlFor="login-account">Tài khoản</Label>
        <Input
          id="login-account"
          name="account"
          type="text"
          autoComplete="username"
          placeholder="username / email / mã NV"
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
          required
        />
      </div>
      <Button variant="primary" type="submit" className="w-full" disabled={pending}>
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
