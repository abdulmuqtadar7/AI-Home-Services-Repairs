import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// A pending owner asks the platform to confirm their subscription and unlock
// the account. We only record the request timestamp; a super admin (or Stripe
// webhook later) flips the business to ACTIVE.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = user.session.businessId;
  if (!businessId) {
    return NextResponse.json(
      { error: "No business associated with this account" },
      { status: 403 },
    );
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { accessRequestedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
