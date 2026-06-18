import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Resolves the authenticated user + their tenant (businessId) for API routes.
// Returns a ready-to-send error response when the request isn't allowed,
// so every handler stays scoped to a single business.
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
  return { ok: true as const, user, businessId };
}
