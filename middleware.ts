import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE } from "@/lib/auth/demo-session";

export function middleware(request: NextRequest) {
  if (request.cookies.get(DEMO_SESSION_COOKIE)?.value === DEMO_SESSION_VALUE) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/",
    "/orders/:path*",
    "/master/:path*",
    "/inventory/:path*",
    "/accounting/:path*",
  ],
};
