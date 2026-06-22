import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";
import { matchTechnicians, type TechCandidate } from "@/lib/techMatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_JOB_STATUSES = ["BOOKED", "DISPATCHED", "IN_PROGRESS"] as const;

// Suggests the best technicians for a job, ranked by skill match against the
// job's service category and current workload.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const role = ctx.user.memberships[0]?.role;
  if (!can(role, "editJobs", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to dispatch jobs" },
      { status: 403 },
    );
  }

  const job = await prisma.job.findFirst({
    where: { id, businessId },
    include: { service: { select: { niche: true } } },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const niche = job.service?.niche ?? null;

  const [techs, loads] = await Promise.all([
    prisma.technician.findMany({
      where: { businessId, active: true },
      select: { id: true, name: true, skills: true, active: true },
    }),
    prisma.job.groupBy({
      by: ["technicianId"],
      where: {
        businessId,
        status: { in: [...ACTIVE_JOB_STATUSES] },
        technicianId: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const loadMap = new Map<string, number>(
    loads
      .filter((l) => l.technicianId)
      .map((l) => [l.technicianId as string, l._count._all]),
  );

  const candidates: TechCandidate[] = techs.map((t) => ({
    id: t.id,
    name: t.name,
    skills: t.skills,
    active: t.active,
    openJobs: loadMap.get(t.id) ?? 0,
  }));

  const suggestions = matchTechnicians(candidates, { niche });

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    niche,
    assignedTechnicianId: job.technicianId,
    count: suggestions.length,
    suggestions,
  });
}
