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

const schema = z.object({
  niche: z.enum(NICHES),
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

  await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: {
        niche: d.niche,
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
