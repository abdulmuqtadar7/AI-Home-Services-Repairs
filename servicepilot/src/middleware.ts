import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/jwt";

const PROTECTED = [
  "/dashboard",
  "/onboarding",
  "/inbox",
  "/customers",
  "/jobs",
  "/calendar",
  "/technicians",
  "/payments",
  "/settings",
  "/super-admin",
];
const AUTH_PAGES = ["/login", "/signup"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // Block unauthenticated access to protected areas.
  if (isProtected && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Only super admins may enter /super-admin.
  if (pathname.startsWith("/super-admin") && session && !session.isSuperAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Logged-in users shouldn't see login/signup.
  if (isAuthPage && session) {
    const url = req.nextUrl.clone();
    url.pathname = session.isSuperAdmin ? "/super-admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/inbox/:path*",
    "/customers/:path*",
    "/jobs/:path*",
    "/calendar/:path*",
    "/technicians/:path*",
    "/payments/:path*",
    "/settings/:path*",
    "/super-admin/:path*",
    "/login",
    "/signup",
  ],
};
