import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionCookie } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  businessName: z.string().min(1, "Business name is required"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { name, email, password, businessName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  // Self-signups start LOCKED: the business is created with status PENDING and
  // no services are enabled until payment is confirmed (manually by an admin
  // for now, or via Stripe later). The owner is signed in but routed to the
  // billing/request-access page.
  const { user, business } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash },
    });
    const business = await tx.business.create({
      data: {
        name: businessName,
        status: "PENDING",
        members: { create: { userId: user.id, role: "OWNER" } },
        aiSetting: { create: {} },
        integrationSetting: { create: {} },
      },
    });
    return { user, business };
  });

  await createSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    isSuperAdmin: user.isSuperAdmin,
    businessId: business.id,
    role: "OWNER",
  });

  return NextResponse.json({ ok: true, redirect: "/billing" });
}
