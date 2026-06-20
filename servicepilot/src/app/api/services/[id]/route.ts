import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";

const NICHES = [
  "PLUMBING",
  "HVAC",
  "ELECTRICAL",
  "ROOFING",
  "PEST_CONTROL",
  "CLEANING",
  "APPLIANCE_REPAIR",
  "HANDYMAN",
  "GENERAL_REPAIR",
  "OTHER",
] as const;

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  niche: z.enum(NICHES).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  basePrice: z.union([z.number(), z.string()]).nullable().optional(),
  durationMin: z.number().int().positive().max(1440).optional(),
  active: z.boolean().optional(),
});

function serialize(s: {
  id: string;
  name: string;
  niche: string | null;
  description: string | null;
  basePrice: unknown;
  durationMin: number;
  active: boolean;
}) {
  return {
    id: s.id,
    name: s.name,
    niche: s.niche,
    description: s.description,
    basePrice: s.basePrice != null ? Number(s.basePrice) : null,
    durationMin: s.durationMin,
    active: s.active,
  };
}

function toPrice(v: number | string | null | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function guard(ctx: {
  user: { memberships?: { role?: string }[]; isSuperAdmin: boolean };
}) {
  const role = ctx.user.memberships?.[0]?.role;
  return can(role, "manageSettings", { isSuperAdmin: ctx.user.isSuperAdmin });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  if (!guard(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.service.findFirst({
    where: { id, businessId: ctx.businessId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
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
  if (d.niche !== undefined) data.niche = d.niche;
  if (d.description !== undefined) data.description = d.description;
  if (d.basePrice !== undefined) data.basePrice = toPrice(d.basePrice);
  if (d.durationMin !== undefined) data.durationMin = d.durationMin;
  if (d.active !== undefined) data.active = d.active;
  const service = await prisma.service.update({ where: { id }, data });
  return NextResponse.json({ service: serialize(service) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  if (!guard(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.service.findFirst({
    where: { id, businessId: ctx.businessId },
    include: { _count: { select: { jobs: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }
  if (existing._count.jobs > 0) {
    // Linked to jobs: archive (deactivate) instead of deleting to keep history.
    const service = await prisma.service.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({
      ok: true,
      archived: true,
      service: serialize(service),
    });
  }
  await prisma.service.delete({ where: { id } });
  return NextResponse.json({ ok: true, archived: false });
}
