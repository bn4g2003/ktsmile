import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/lib/auth/session";

export function middleware(request: NextRequest) {
  if (request.cookies.get(AUTH_SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/",
    "/orders/:path*",
    "/master/:path*",
    "/hr/:path*",
    "/inventory/:path*",
    "/accounting/:path*",
  ],
};
