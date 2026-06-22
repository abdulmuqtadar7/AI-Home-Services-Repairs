import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";
import { analyzeReview } from "@/lib/reviewInsights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fills in AI sentiment + themes for captured reviews that have a comment but
// have not been analyzed yet. Bounded per call and safe to run repeatedly.
export async function POST() {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const role = ctx.user.memberships[0]?.role;
  if (!can(role, "viewDashboard", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to analyze reviews" },
      { status: 403 },
    );
  }

  const pending = await prisma.review.findMany({
    where: { businessId, analyzedAt: null, comment: { not: null } },
    orderBy: { createdAt: "asc" },
    take: 25,
    select: { id: true, rating: true, comment: true },
  });

  let analyzed = 0;
  for (const r of pending) {
    const insight = await analyzeReview({
      rating: r.rating,
      comment: r.comment,
    });
    await prisma.review.update({
      where: { id: r.id },
      data: {
        sentiment: insight.sentiment,
        themes: insight.themes,
        analyzedAt: new Date(),
      },
    });
    analyzed += 1;
  }

  return NextResponse.json({
    ok: true,
    analyzed,
    maybeMore: pending.length === 25,
  });
}
