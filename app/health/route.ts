import { NextResponse } from "next/server";

/** Health check cho proxy / Hostinger (không qua middleware auth). */
export function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
