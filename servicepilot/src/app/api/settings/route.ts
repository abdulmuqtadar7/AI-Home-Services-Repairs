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

const schema = z.object({
  // Business profile
  trades: z.array(z.enum(NICHES)).min(1),
  niche: z.enum(NICHES).optional(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  diagnosticFee: z.union([z.number(), z.string()]).optional().nullable(),
  emergencyAvailable: z.boolean().optional(),
  googleReviewLink: z.string().trim().max(300).optional().or(z.literal("")),
  // AI assistant
  personaName: z.string().trim().max(60).optional().or(z.literal("")),
  tone: z.enum(["friendly", "professional", "casual"]).optional(),
  greeting: z.string().trim().max(500).optional().or(z.literal("")),
  systemPromptOverride: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .or(z.literal("")),
  bookingEnabled: z.boolean().optional(),
  collectPhotos: z.boolean().optional(),
  emergencyKeywords: z.array(z.string().trim()).optional(),
});

function canManage(ctx: {
  user: { memberships: { role: string }[]; isSuperAdmin: boolean };
}) {
  return can(ctx.user.memberships?.[0]?.role, "manageSettings", {
    isSuperAdmin: ctx.user.isSuperAdmin,
  });
}

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  if (!canManage(ctx)) {
    return NextResponse.json(
      { error: "You do not have permission to manage settings" },
      { status: 403 },
    );
  }

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    include: { aiSetting: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  return NextResponse.json({
    business: {
      name: business.name,
      niche: business.niche,
      trades: business.trades,
      phone: business.phone,
      email: business.email,
      website: business.website,
      emergencyAvailable: business.emergencyAvailable,
      diagnosticFee: business.diagnosticFee
        ? Number(business.diagnosticFee)
        : null,
      googleReviewLink: business.googleReviewLink,
    },
    aiSetting: business.aiSetting
      ? {
          personaName: business.aiSetting.personaName,
          tone: business.aiSetting.tone,
          greeting: business.aiSetting.greeting,
          systemPromptOverride: business.aiSetting.systemPromptOverride,
          bookingEnabled: business.aiSetting.bookingEnabled,
          collectPhotos: business.aiSetting.collectPhotos,
          emergencyKeywords: business.aiSetting.emergencyKeywords,
        }
      : null,
  });
}

export async function PATCH(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  if (!canManage(ctx)) {
    return NextResponse.json(
      { error: "You do not have permission to manage settings" },
      { status: 403 },
    );
  }
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

  const keywords = Array.from(
    new Set((d.emergencyKeywords ?? []).map((k) => k.trim()).filter(Boolean)),
  );

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
      },
    });

    await tx.aiSetting.upsert({
      where: { businessId },
      create: {
        businessId,
        personaName: d.personaName || "Assistant",
        tone: d.tone ?? "friendly",
        greeting: d.greeting || null,
        systemPromptOverride: d.systemPromptOverride || null,
        bookingEnabled: d.bookingEnabled ?? true,
        collectPhotos: d.collectPhotos ?? true,
        emergencyKeywords: keywords,
      },
      update: {
        personaName: d.personaName || "Assistant",
        tone: d.tone ?? "friendly",
        greeting: d.greeting || null,
        systemPromptOverride: d.systemPromptOverride || null,
        bookingEnabled: d.bookingEnabled ?? true,
        collectPhotos: d.collectPhotos ?? true,
        emergencyKeywords: keywords,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
