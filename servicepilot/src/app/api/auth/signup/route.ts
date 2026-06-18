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
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  // Create the user, their business workspace, owner membership, and default
  // AI + integration settings together in one transaction.
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash },
    });
    const business = await tx.business.create({
      data: {
        name: businessName,
        members: { create: { userId: user.id, role: "OWNER" } },
        aiSetting: { create: {} },
        integrationSetting: { create: {} },
      },
    });
    return { user, business };
  });

  await createSessionCookie({
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
    isSuperAdmin: result.user.isSuperAdmin,
    businessId: result.business.id,
    role: "OWNER",
  });

  return NextResponse.json({ ok: true, redirect: "/onboarding" });
}
