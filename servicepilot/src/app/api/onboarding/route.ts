import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";

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

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  niche: z.enum(NICHES),
  basePrice: z.union([z.number(), z.string()]).nullable().optional(),
  durationMin: z.number().int().positive().max(1440).optional(),
});

const schema = z.object({
  trades: z.array(z.enum(NICHES)).min(1),
  niche: z.enum(NICHES).optional(),
  services: z.array(serviceSchema).optional(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  diagnosticFee: z.union([z.number(), z.string()]).optional().nullable(),
  emergencyAvailable: z.boolean().optional(),
  googleReviewLink: z.string().trim().max(300).optional().or(z.literal("")),
  serviceAreaZips: z.array(z.string().trim()).optional(),
  personaName: z.string().trim().max(60).optional().or(z.literal("")),
  tone: z.enum(["friendly", "professional", "casual"]).optional(),
  greeting: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const trades = Array.from(new Set(d.trades));
  const primary = d.niche && trades.includes(d.niche) ? d.niche : trades[0];

  const fee =
    d.diagnosticFee === undefined ||
    d.diagnosticFee === null ||
    d.diagnosticFee === ""
      ? null
      : Number(d.diagnosticFee);
  if (fee !== null && Number.isNaN(fee)) {
    return NextResponse.json(
      { error: "Invalid diagnostic fee" },
      { status: 400 },
    );
  }

  const zips = Array.from(
    new Set((d.serviceAreaZips ?? []).map((z) => z.trim()).filter(Boolean)),
  );

  // Build service rows: only for selected trades, de-duplicated by niche+name.
  const seen = new Set<string>();
  const serviceRows: {
    businessId: string;
    name: string;
    niche: (typeof NICHES)[number];
    basePrice: number | null;
    durationMin: number;
  }[] = [];
  for (const s of d.services ?? []) {
    if (!trades.includes(s.niche)) continue;
    const key = s.niche + "::" + s.name;
    if (seen.has(key)) continue;
    seen.add(key);
    const price =
      s.basePrice === undefined || s.basePrice === null || s.basePrice === ""
        ? null
        : Number(s.basePrice);
    serviceRows.push({
      businessId,
      name: s.name,
      niche: s.niche,
      basePrice: price !== null && Number.isNaN(price) ? null : price,
      durationMin: s.durationMin ?? 60,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: {
        niche: primary,
        trades,
        phone: d.phone || null,
        email: d.email || null,
        website: d.website || null,
        diagnosticFee: fee,
        emergencyAvailable: d.emergencyAvailable ?? false,
        googleReviewLink: d.googleReviewLink || null,
        onboardingCompleted: true,
      },
    });

    if (zips.length > 0) {
      await tx.serviceArea.deleteMany({ where: { businessId } });
      await tx.serviceArea.createMany({
        data: zips.map((zipCode) => ({ businessId, zipCode })),
        skipDuplicates: true,
      });
    }

    if (serviceRows.length > 0) {
      // Clear out any previously-seeded services that aren't tied to a job,
      // so re-running setup doesn't create duplicates.
      await tx.service.deleteMany({
        where: { businessId, jobs: { none: {} } },
      });
      await tx.service.createMany({ data: serviceRows });
    }

    await tx.aiSetting.upsert({
      where: { businessId },
      create: {
        businessId,
        personaName: d.personaName || "Assistant",
        tone: d.tone ?? "friendly",
        greeting: d.greeting || null,
      },
      update: {
        personaName: d.personaName || "Assistant",
        tone: d.tone ?? "friendly",
        greeting: d.greeting || null,
      },
    });
  });

  return NextResponse.json({ ok: true, redirect: "/dashboard" });
}
