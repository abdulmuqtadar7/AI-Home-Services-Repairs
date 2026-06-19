import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/jwt";
import { can, canAccessPath, landingPath } from "@/lib/rbac";

const PROTECTED = [
  "/dashboard",
  "/onboarding",
  "/inbox",
  "/chatbot",
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

  // A super admin has no business of their own. Until they pick one via
  // "Open workspace" on Platform Admin, send them there instead of the tenant
  // onboarding/register screen.
  if (
    isProtected &&
    session &&
    session.isSuperAdmin &&
    !session.businessId &&
    !pathname.startsWith("/super-admin")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/super-admin";
    return NextResponse.redirect(url);
  }

  // Role-based access for business members. Super admins are handled above and
  // the platform area has its own guard, so both are excluded here. Onboarding
  // stays open to every member. The "/jobs" list is open to all roles
  // (technicians get a filtered "My Jobs"), but any deeper "/jobs/*" route
  // (create form or job detail) requires job-editing rights.
  if (
    isProtected &&
    session &&
    !session.isSuperAdmin &&
    session.businessId &&
    !pathname.startsWith("/super-admin") &&
    !pathname.startsWith("/onboarding")
  ) {
    const role = session.role;
    const deeperJobs = pathname !== "/jobs" && pathname.startsWith("/jobs/");
    const blocked =
      !canAccessPath(pathname, role) || (deeperJobs && !can(role, "editJobs"));
    if (blocked) {
      const url = req.nextUrl.clone();
      url.pathname = landingPath(role);
      return NextResponse.redirect(url);
    }
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
    "/chatbot/:path*",
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
