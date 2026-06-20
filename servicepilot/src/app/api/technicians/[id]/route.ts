import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z
    .union([z.string().trim().email(), z.literal("")])
    .optional()
    .nullable(),
  skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  active: z.boolean().optional(),
  userId: z.string().trim().optional().nullable(),
});

function roleOf(ctx: { user: { memberships: { role: string }[] } }) {
  return ctx.user.memberships[0]?.role;
}

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;
  const { id } = await params;
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

  const current = await prisma.technician.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.phone !== undefined) data.phone = d.phone || null;
  if (d.email !== undefined) data.email = d.email || null;
  if (d.active !== undefined) data.active = d.active;
  if (d.skills !== undefined) {
    data.skills = Array.from(
      new Set(d.skills.map((s) => s.trim()).filter(Boolean)),
    );
  }

  // userId: undefined = leave as-is, null/"" = unlink, string = link.
  if (d.userId !== undefined) {
    const userId = d.userId || null;
    if (userId) {
      const link = await validateLinkableUser(userId, businessId, id);
      if (!link.ok) return link.res;
    }
    data.userId = userId;
  }

  try {
    const technician = await prisma.technician.update({
      where: { id },
      data,
    });
    return NextResponse.json({ ok: true, technician });
  } catch {
    return NextResponse.json(
      { error: "That staff login is already linked to another technician" },
      { status: 409 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;
  const { id } = await params;
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

  const current = await prisma.technician.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Jobs keep their history; technicianId is set to null via the schema relation.
  await prisma.technician.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
