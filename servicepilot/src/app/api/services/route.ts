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

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  niche: z.enum(NICHES).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  basePrice: z.union([z.number(), z.string()]).nullable().optional(),
  durationMin: z.number().int().positive().max(1440).optional(),
});

type ServiceRow = {
  id: string;
  name: string;
  niche: string | null;
  description: string | null;
  basePrice: unknown;
  durationMin: number;
  active: boolean;
};

export function serializeService(s: ServiceRow) {
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

export function toPrice(v: number | string | null | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const services = await prisma.service.findMany({
    where: { businessId: ctx.businessId },
    orderBy: [{ niche: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ services: services.map(serializeService) });
}

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const role = ctx.user.memberships?.[0]?.role;
  if (!can(role, "manageSettings", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const service = await prisma.service.create({
    data: {
      businessId: ctx.businessId,
      name: d.name,
      niche: d.niche ?? null,
      description: d.description ?? null,
      basePrice: toPrice(d.basePrice),
      durationMin: d.durationMin ?? 60,
    },
  });
  return NextResponse.json(
    { service: serializeService(service) },
    { status: 201 },
  );
}
