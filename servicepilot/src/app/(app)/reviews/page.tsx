import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, landingPath } from "@/lib/rbac";
import { ReviewsList, type ReviewJob } from "@/components/ReviewsList";
import {
  ReviewInsights,
  type ReviewInsightData,
} from "@/components/ReviewInsights";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const role = user.memberships[0]?.role;
  const isSuperAdmin = user.isSuperAdmin;
  if (!can(role, "editJobs", { isSuperAdmin })) {
    redirect(landingPath(role, isSuperAdmin));
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, googleReviewLink: true },
  });

  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      status: { in: ["COMPLETED", "PAID", "REVIEW_REQUESTED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { customer: { select: { name: true } } },
  });

  const reviewJobs: ReviewJob[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    customerName: j.customer?.name ?? null,
    amountCharged: j.amountCharged ? Number(j.amountCharged) : null,
    status: j.status,
    reviewRequestedAt: j.reviewRequestedAt
      ? j.reviewRequestedAt.toISOString()
      : null,
  }));

  const pending = reviewJobs.filter(
    (j) => j.status !== "REVIEW_REQUESTED",
  ).length;
  const requested = reviewJobs.filter(
    (j) => j.status === "REVIEW_REQUESTED",
  ).length;

  // Captured first-party reviews + AI insights (Path B).
  const reviews = await prisma.review.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      rating: true,
      sentiment: true,
      themes: true,
      comment: true,
      routedToGoogle: true,
      createdAt: true,
    },
  });

  const total = reviews.length;
  const averageRating =
    total > 0
      ? Math.round(
          (reviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10,
        ) / 10
      : 0;
  const routedToGoogle = reviews.filter((r) => r.routedToGoogle).length;

  const sentiment = { positive: 0, neutral: 0, negative: 0, unanalyzed: 0 };
  const themeCounts = new Map<string, number>();
  let pendingAnalysis = 0;
  for (const r of reviews) {
    if (r.sentiment === "positive") sentiment.positive += 1;
    else if (r.sentiment === "neutral") sentiment.neutral += 1;
    else if (r.sentiment === "negative") sentiment.negative += 1;
    else sentiment.unanalyzed += 1;
    for (const t of r.themes) {
      themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
    }
    if (r.comment && r.comment.trim() && !r.sentiment) pendingAnalysis += 1;
  }

  const topThemes = Array.from(themeCounts.entries())
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const recent = reviews
    .filter((r) => r.comment && r.comment.trim())
    .slice(0, 6)
    .map((r) => ({
      rating: r.rating,
      sentiment: r.sentiment,
      comment: r.comment as string,
      createdAt: r.createdAt.toISOString(),
    }));

  const insights: ReviewInsightData = {
    total,
    averageRating,
    routedToGoogle,
    sentiment,
    topThemes,
    recent,
    pendingAnalysis,
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Capture feedback after a job, route happy customers to Google, and see
          what people are saying.
        </p>
      </header>

      <div className="space-y-8">
        <ReviewInsights data={insights} />
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Request a review
          </h2>
          <ReviewsList
            jobs={reviewJobs}
            reviewLink={business?.googleReviewLink ?? null}
            businessName={business?.name ?? "us"}
            pending={pending}
            requested={requested}
          />
        </div>
      </div>
    </div>
  );
}
