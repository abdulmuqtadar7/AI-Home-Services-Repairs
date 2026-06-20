import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, landingPath } from "@/lib/rbac";
import { ReviewsList, type ReviewJob } from "@/components/ReviewsList";

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

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask happy customers for a review after a completed or paid job.
        </p>
      </header>
      <ReviewsList
        jobs={reviewJobs}
        reviewLink={business?.googleReviewLink ?? null}
        businessName={business?.name ?? "us"}
        pending={pending}
        requested={requested}
      />
    </div>
  );
}
