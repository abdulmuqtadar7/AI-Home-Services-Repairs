import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      session: user.session,
      memberships: user.memberships.map((m) => ({
        businessId: m.businessId,
        businessName: m.business.name,
        role: m.role,
      })),
    },
  });
}
