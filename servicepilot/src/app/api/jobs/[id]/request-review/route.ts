import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";
import { isTwilioConfigured, sendSms } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sends a review request to the job's customer (currently via SMS) using the
// business's Google review link, flips the job to REVIEW_REQUESTED, and records
// the attempt. De-duplicates on Job.reviewRequestedAt unless ?force=1 is passed.
export async function POST(
  req: Request,
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

  const force = new URL(req.url).searchParams.get("force") === "1";

  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, businessId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Already requested: do not text the customer twice unless explicitly forced.
  if (job.reviewRequestedAt && !force) {
    return NextResponse.json({ ok: true, alreadySent: true, job });
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, googleReviewLink: true },
  });

  const phone = job.customer?.phone || null;
  const customerName = job.customer?.name ? " " + job.customer.name : "";
  const reviewLink = business?.googleReviewLink || null;
  const bizName = business?.name || "our team";

  const message = reviewLink
    ? "Hi" +
      customerName +
      ", thanks for choosing " +
      bizName +
      "! If you have a moment, we'd love a quick review: " +
      reviewLink
    : "Hi" +
      customerName +
      ", thanks for choosing " +
      bizName +
      "! We'd really appreciate your feedback on the service you received.";

  let smsSent = false;
  if (phone && isTwilioConfigured()) {
    smsSent = await sendSms(phone, message);
  }

  const updated = await prisma.job.update({
    where: { id },
    data: { status: "REVIEW_REQUESTED", reviewRequestedAt: new Date() },
  });

  // No dedicated notification type for reviews; log to the audit trail instead.
  await prisma.auditLog.create({
    data: {
      businessId,
      userId: ctx.user.id,
      action: "REVIEW_REQUESTED",
      entityType: "Job",
      entityId: id,
      metadata: {
        channel: phone ? "SMS" : "NONE",
        to: phone,
        smsSent,
        hasReviewLink: Boolean(reviewLink),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    job: updated,
    sent: smsSent,
    channel: phone ? "SMS" : "NONE",
    to: phone,
    hasReviewLink: Boolean(reviewLink),
  });
}
