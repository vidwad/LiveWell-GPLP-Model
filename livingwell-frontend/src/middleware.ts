import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/portfolio",
  "/communities",
  "/investors",
  "/maintenance",
  "/ai",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const hasToken = req.cookies.get("lwc_token_present")?.value === "1";

  if (isProtected && !hasToken) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect logged-in users away from auth pages
  if ((pathname === "/login" || pathname === "/register") && hasToken) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/portfolio/:path*",
    "/communities/:path*",
    "/investors/:path*",
    "/maintenance/:path*",
    "/ai/:path*",
    "/login",
    "/register",
  ],
};
