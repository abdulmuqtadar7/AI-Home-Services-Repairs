import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createSessionCookie } from "@/lib/auth";

const schema = z.object({ businessId: z.string().min(1) });

// Super-admin only: re-issue the session cookie pointed at another business so
// the founder can "enter" any tenant's workspace. isSuperAdmin stays true, so
// they can always return to /super-admin and switch again.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { id: parsed.data.businessId },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  await createSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    isSuperAdmin: user.isSuperAdmin,
    businessId: business.id,
    role: "OWNER",
  });

  return NextResponse.json({ ok: true, redirect: "/dashboard" });
}
