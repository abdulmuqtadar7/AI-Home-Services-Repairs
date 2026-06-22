import { prisma } from "@/lib/prisma";
import { FeedbackForm } from "@/components/FeedbackForm";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      businessId: true,
      customer: { select: { name: true } },
    },
  });

  const business = job
    ? await prisma.business.findUnique({
        where: { id: job.businessId },
        select: { name: true },
      })
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {!job ? (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-slate-900">
              Link not found
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              This feedback link is no longer valid. Please contact the business
              directly.
            </p>
          </div>
        ) : (
          <FeedbackForm
            jobId={job.id}
            businessName={business?.name ?? "us"}
            customerName={job.customer?.name ?? null}
            jobTitle={job.title}
          />
        )}
      </div>
    </main>
  );
}
