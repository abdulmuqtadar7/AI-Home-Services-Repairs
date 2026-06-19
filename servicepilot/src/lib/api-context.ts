import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Resolves the authenticated user + their tenant (businessId) for API routes.
// Returns a ready-to-send error response when the request isn't allowed,
// so every handler stays scoped to a single, active business.
export async function getApiContext() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const businessId = user.session.businessId;
  if (!businessId) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "No business associated with this account" },
        { status: 403 },
      ),
    };
  }

  // Block API access for tenants that aren't active. Super admins are exempt so
  // they can still inspect/manage a pending or suspended business.
  //  - PENDING: signed up but not paid/activated yet -> services disabled.
  //  - SUSPENDED: deactivated by the platform owner.
  if (!user.isSuperAdmin) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { status: true },
    });
    if (!business) {
      return {
        ok: false as const,
        res: NextResponse.json(
          { error: "Business not found" },
          { status: 404 },
        ),
      };
    }
    if (business.status === "PENDING") {
      return {
        ok: false as const,
        res: NextResponse.json(
          {
            error:
              "This account is pending activation. Complete payment to enable services.",
            status: "PENDING",
          },
          { status: 403 },
        ),
      };
    }
    if (business.status === "SUSPENDED") {
      return {
        ok: false as const,
        res: NextResponse.json(
          { error: "This business is suspended", status: "SUSPENDED" },
          { status: 403 },
        ),
      };
    }
  }

  return { ok: true as const, user, businessId };
}
