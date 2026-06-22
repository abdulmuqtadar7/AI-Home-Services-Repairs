import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public endpoint: a customer submits a star rating + optional comment from the
// feedback page (no auth). We store a Review row, then route happy customers
// (4-5 stars) to the business's Google review link while keeping lower ratings
// private so they never auto-post to Google.
export async function POST(req: Request) {
  const data = await req.json().catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const jobId = typeof data.jobId === "string" ? data.jobId : "";
  const rating = Number(data.rating);
  const comment =
    typeof data.comment === "string" ? data.comment.trim().slice(0, 2000) : "";

  if (!jobId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "A rating from 1 to 5 is required" },
      { status: 400 },
    );
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, businessId: true, customerId: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const business = await prisma.business.findUnique({
    where: { id: job.businessId },
    select: { googleReviewLink: true },
  });
  const link = business?.googleReviewLink || null;
  const routedToGoogle = rating >= 4 && Boolean(link);

  await prisma.review.create({
    data: {
      businessId: job.businessId,
      jobId: job.id,
      customerId: job.customerId,
      rating,
      comment: comment || null,
      source: "PUBLIC_FORM",
      routedToGoogle,
    },
  });

  return NextResponse.json({
    ok: true,
    routedToGoogle,
    googleReviewLink: routedToGoogle ? link : null,
  });
}
