import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { isTwilioConfigured, sendSms } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMINAL_STATUSES = [
  "completed",
  "busy",
  "no-answer",
  "failed",
  "canceled",
];
const RECOVERY_MARKER = "Missed-call recovery SMS";

function ok(): NextResponse {
  return new NextResponse(null, { status: 200 });
}

// Twilio calls this when a voice call ends (configure it as the number's
// "Call status changes" callback). If the call ended without a booking or a
// human handoff, we text the caller back to recover the lead and notify the
// business. The call is keyed by CallSid in Conversation.externalRef.
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId") || "";

  const form = await req.formData().catch(() => null);
  const callStatus = ((form?.get("CallStatus") as string) || "").toLowerCase();
  const callSid = (form?.get("CallSid") as string) || "";
  const from = (form?.get("From") as string) || "";
  const callDuration = (form?.get("CallDuration") as string) || "";

  // Only react to final call states, and only when we know who to text.
  if (!TERMINAL_STATUSES.includes(callStatus)) return ok();
  if (!businessId || !from) return ok();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  if (!business || business.status !== "ACTIVE") return ok();

  let conversation = callSid
    ? await prisma.conversation.findFirst({
        where: { businessId, channel: "VOICE", externalRef: callSid },
      })
    : null;

  // The call already became a booking or was handed to a human, no recovery.
  if (
    conversation &&
    (conversation.status === "BOOKED" || conversation.status === "HUMAN_NEEDED")
  ) {
    return ok();
  }

  // Anchor the conversation so we can record and de-duplicate the recovery.
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId,
        channel: "VOICE",
        status: "NEW_LEAD",
        externalRef: callSid || null,
        aiActive: true,
      },
    });
  }

  // Avoid sending twice if Twilio fires more than one terminal event.
  const already = await prisma.message.findFirst({
    where: {
      conversationId: conversation.id,
      sender: "SYSTEM",
      content: { contains: RECOVERY_MARKER },
    },
  });
  if (already) return ok();

  const message =
    "Hi! This is " +
    business.name +
    ". Sorry we missed your call. Call us back anytime and our 24/7 assistant will help you book a visit.";

  const smsSent = isTwilioConfigured() ? await sendSms(from, message) : false;

  await createNotification({
    businessId,
    type: "MISSED_CALL_RECOVERED",
    title: "Missed call - follow up with " + from,
    body: smsSent
      ? "We texted " + from + " a recovery message after a missed call."
      : "Missed call from " +
        from +
        ". Recovery SMS could not be delivered (caller unverified on trial).",
    metadata: {
      conversationId: conversation.id,
      from,
      callStatus,
      callDuration,
      smsSent,
    },
  });

  await prisma.message.create({
    data: {
      businessId,
      conversationId: conversation.id,
      sender: "SYSTEM",
      content:
        RECOVERY_MARKER +
        (smsSent
          ? " sent to " + from + "."
          : " attempted for " + from + " (delivery skipped on trial)."),
    },
  });

  return ok();
}

export { POST as GET };
