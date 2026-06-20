import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";

const baseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  active: z.boolean().optional(),
  userId: z.string().trim().optional().nullable(),
});

function roleOf(ctx: { user: { memberships: { role: string }[] } }) {
  return ctx.user.memberships[0]?.role;
}

// A user may be linked as a technician only when they belong to this business.
// We also block linking a login that's already attached to another technician.
async function validateLinkableUser(
  userId: string,
  businessId: string,
  excludeTechnicianId?: string,
) {
  const member = await prisma.businessMember.findFirst({
    where: { businessId, userId },
    select: { role: true },
  });
  if (!member) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "That user is not a member of this business" },
        { status: 400 },
      ),
    };
  }
  const existing = await prisma.technician.findFirst({
    where: {
      businessId,
      userId,
      ...(excludeTechnicianId ? { id: { not: excludeTechnicianId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "That staff login is already linked to another technician" },
        { status: 409 },
      ),
    };
  }
  return { ok: true as const };
}

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  if (
    !can(roleOf(ctx), "manageTechnicians", {
      isSuperAdmin: ctx.user.isSuperAdmin,
    })
  ) {
    return NextResponse.json(
      { error: "You do not have permission to manage technicians" },
      { status: 403 },
    );
  }

  const technicians = await prisma.technician.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { jobs: true } },
    },
  });
  return NextResponse.json({ technicians });
}

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;
  if (
    !can(roleOf(ctx), "manageTechnicians", {
      isSuperAdmin: ctx.user.isSuperAdmin,
    })
  ) {
    return NextResponse.json(
      { error: "You do not have permission to manage technicians" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = baseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const skills = Array.from(
    new Set((d.skills ?? []).map((s) => s.trim()).filter(Boolean)),
  );

  const userId = d.userId || null;
  if (userId) {
    const link = await validateLinkableUser(userId, businessId);
    if (!link.ok) return link.res;
  }

  try {
    const technician = await prisma.technician.create({
      data: {
        businessId,
        name: d.name,
        phone: d.phone || null,
        email: d.email || null,
        skills,
        active: d.active ?? true,
        userId,
      },
    });
    return NextResponse.json({ ok: true, technician });
  } catch {
    return NextResponse.json(
      { error: "That staff login is already linked to another technician" },
      { status: 409 },
    );
  }
}
