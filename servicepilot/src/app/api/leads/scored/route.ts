import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";
import { scoreLead } from "@/lib/leadScore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_LEAD_STATUSES = [
  "NEW_LEAD",
  "QUALIFIED",
  "ESTIMATE_REQUESTED",
  "BOOKED",
] as const;

// Returns open leads ranked by a deterministic "hotness" score so owners and
// dispatchers can chase the highest-intent jobs first.
export async function GET() {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const role = ctx.user.memberships[0]?.role;
  if (!can(role, "viewDashboard", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to view leads" },
      { status: 403 },
    );
  }

  const now = new Date();
  const jobs = await prisma.job.findMany({
    where: { businessId, status: { in: [...OPEN_LEAD_STATUSES] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true, phone: true, isReturning: true } },
    },
  });

  const leads = jobs
    .map((job) => {
      const result = scoreLead(
        {
          status: job.status,
          urgency: job.urgency,
          createdAt: job.createdAt,
          customerPhone: job.customer?.phone ?? null,
          customerReturning: job.customer?.isReturning ?? false,
          amountCharged: job.amountCharged ? Number(job.amountCharged) : null,
        },
        now,
      );
      return {
        id: job.id,
        title: job.title,
        status: job.status,
        urgency: job.urgency,
        customer: job.customer?.name ?? null,
        score: result.score,
        tier: result.tier,
        reasons: result.reasons,
      };
    })
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ ok: true, count: leads.length, leads });
}
