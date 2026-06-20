import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

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
  name: z.string().trim().min(1).max(200),
  niche: z.enum(NICHES),
  basePrice: z.union([z.number(), z.string()]).nullable().optional(),
  durationMin: z.number().int().positive().max(1440).optional(),
});

const schema = z.object({
  // Required: account basics.
  businessName: z.string().min(1, "Business name is required").max(200),
  ownerName: z.string().min(1, "Owner name is required").max(120),
  ownerEmail: z.string().email("Valid email required"),
  ownerPassword: z.string().min(8, "Password must be at least 8 characters"),
  // Optional: business profile (option A).
  niche: z.enum(NICHES).optional(),
  trades: z.array(z.enum(NICHES)).optional(),
  services: z.array(serviceSchema).optional(),
  phone: z.string().max(40).optional(),
  businessEmail: z.string().max(160).optional(),
  website: z.string().max(300).optional(),
  diagnosticFee: z.number().nonnegative().nullish(),
  emergencyAvailable: z.boolean().optional(),
  googleReviewLink: z.string().max(400).optional(),
  // Optional: AI persona.
  personaName: z.string().max(80).optional(),
  tone: z.string().max(40).optional(),
  greeting: z.string().max(800).optional(),
  // If true, skip the owner's onboarding wizard.
  markComplete: z.boolean().optional(),
});

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
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const email = d.ownerEmail.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(d.ownerPassword);
  const trim = (v?: string) => (v && v.trim() ? v.trim() : undefined);

  // Selected trades (deduped). Primary niche is the explicit niche when it is
  // among the trades, otherwise the first trade, otherwise the explicit niche.
  const trades = Array.from(new Set(d.trades ?? []));
  const primary =
    d.niche && (trades.length === 0 || trades.includes(d.niche))
      ? d.niche
      : (trades[0] ?? d.niche);

  // Build service rows: only for selected trades, de-duplicated by niche+name.
  const serviceRows: {
    name: string;
    niche: (typeof NICHES)[number];
    basePrice: number | null;
    durationMin: number;
  }[] = [];
  const seen = new Set<string>();
  for (const s of d.services ?? []) {
    if (trades.length > 0 && !trades.includes(s.niche)) continue;
    const key = s.niche + "::" + s.name;
    if (seen.has(key)) continue;
    seen.add(key);
    const price =
      s.basePrice === undefined || s.basePrice === null || s.basePrice === ""
        ? null
        : Number(s.basePrice);
    serviceRows.push({
      name: s.name,
      niche: s.niche,
      basePrice: price !== null && Number.isNaN(price) ? null : price,
      durationMin: s.durationMin ?? 60,
    });
  }

  // Admin-initiated tenant creation. Mirrors signup but does NOT touch the
  // super admin's own session, so they stay signed in as the platform owner.
  const business = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: { name: d.ownerName, email, passwordHash },
    });
    const created = await tx.business.create({
      data: {
        name: d.businessName,
        ...(primary ? { niche: primary } : {}),
        ...(trades.length > 0 ? { trades } : {}),
        ...(trim(d.phone) ? { phone: trim(d.phone) } : {}),
        ...(trim(d.businessEmail) ? { email: trim(d.businessEmail) } : {}),
        ...(trim(d.website) ? { website: trim(d.website) } : {}),
        ...(d.diagnosticFee != null ? { diagnosticFee: d.diagnosticFee } : {}),
        ...(typeof d.emergencyAvailable === "boolean"
          ? { emergencyAvailable: d.emergencyAvailable }
          : {}),
        ...(trim(d.googleReviewLink)
          ? { googleReviewLink: trim(d.googleReviewLink) }
          : {}),
        ...(d.markComplete ? { onboardingCompleted: true } : {}),
        members: { create: { userId: owner.id, role: "OWNER" } },
        aiSetting: {
          create: {
            ...(trim(d.greeting) ? { greeting: trim(d.greeting) } : {}),
            ...(trim(d.tone) ? { tone: trim(d.tone) } : {}),
            ...(trim(d.personaName)
              ? { personaName: trim(d.personaName) }
              : {}),
          },
        },
        integrationSetting: { create: {} },
      },
      select: { id: true },
    });
    if (serviceRows.length > 0) {
      await tx.service.createMany({
        data: serviceRows.map((s) => ({ ...s, businessId: created.id })),
      });
    }
    return created;
  });

  return NextResponse.json({ ok: true, businessId: business.id });
}
