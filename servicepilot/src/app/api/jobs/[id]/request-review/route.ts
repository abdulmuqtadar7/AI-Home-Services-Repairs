import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const role = ctx.user.memberships[0]?.role;
  if (!can(role, "editJobs", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to request reviews" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const existing = await prisma.job.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const job = await prisma.job.update({
    where: { id },
    data: { status: "REVIEW_REQUESTED", reviewRequestedAt: new Date() },
  });
  return NextResponse.json({ ok: true, job });
}
