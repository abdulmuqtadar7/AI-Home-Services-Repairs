import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildVoicePrompt,
  detectEmergency,
  extractBooking,
  generateAiReply,
  type ChatTurn,
} from "@/lib/ai";
import { createNotification } from "@/lib/notifications";
import { gatherTwiml, sayHangupTwiml, sayThenGatherTwiml } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xml(body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

// Twilio posts the caller's transcribed speech here after each Gather. We run
// it through the same AI brain as web chat, book the job when ready, and speak
// the reply back while continuing to listen. The call is keyed by the Twilio
// CallSid stored in Conversation.externalRef.
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId") || "";
  const action =
    "/api/voice/gather?businessId=" + encodeURIComponent(businessId);

  const form = await req.formData().catch(() => null);
  const speech = ((form?.get("SpeechResult") as string) || "").trim();
  const callSid = (form?.get("CallSid") as string) || "";
  const from = (form?.get("From") as string) || "";

  const business = businessId
    ? await prisma.business.findUnique({ where: { id: businessId } })
    : null;
  if (!business || business.status !== "ACTIVE") {
    return xml(
      sayHangupTwiml(
        "Sorry, this phone assistant is not available right now. Goodbye.",
      ),
    );
  }

  const miss = parseInt(searchParams.get("miss") || "0", 10) || 0;
  const confidence = parseFloat((form?.get("Confidence") as string) || "");
  const lowConfidence = Number.isFinite(confidence) && confidence < 0.3;
  const missed = speech.length === 0 || callSid.length === 0 || lowConfidence;
  if (missed) {
    if (miss >= 1) {
      return xml(
        sayHangupTwiml(
          "I am still having trouble hearing you. I will have a team member follow up with you shortly. Goodbye.",
        ),
      );
    }
    return xml(
      gatherTwiml({
        prompt:
          "Sorry, I did not catch that. Please tell me how I can help in a few words.",
        action: action + "&miss=1",
      }),
    );
  }

  // Caller was silent or unintelligible, ask once more.
  if (!speech || !callSid) {
    return xml(
      gatherTwiml({
        prompt: "Sorry, I didn't catch that. Please tell me how I can help.",
        action,
      }),
    );
  }

  const aiSetting = await prisma.aiSetting.findUnique({
    where: { businessId },
  });

  const businessServices = await prisma.service.findMany({
    where: { businessId, active: true },
    select: { name: true, niche: true, basePrice: true },
    orderBy: { name: "asc" },
  });
  const promptServices = businessServices.map((s) => ({
    name: s.name,
    niche: s.niche,
    basePrice: s.basePrice != null ? Number(s.basePrice) : null,
  }));

  let conversation = await prisma.conversation.findFirst({
    where: {
      businessId,
      channel: "VOICE",
      externalRef: callSid,
      status: { notIn: ["LOST", "COMPLETED"] },
    },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId,
        channel: "VOICE",
        status: "AI_HANDLING",
        externalRef: callSid,
        aiActive: true,
      },
    });
  }

  const emergency = detectEmergency(speech, aiSetting?.emergencyKeywords ?? []);

  await prisma.message.create({
    data: {
      businessId,
      conversationId: conversation.id,
      sender: "CUSTOMER",
      content: speech,
      metadata: from ? { from } : undefined,
    },
  });

  let status = conversation.status;
  if (emergency.isEmergency && status !== "BOOKED") {
    status = "HUMAN_NEEDED";
    await createNotification({
      businessId,
      type: "HUMAN_HANDOFF",
      title: "Emergency call needs attention",
      body:
        'A phone caller mentioned "' +
        emergency.keyword +
        '". Flagged for immediate human follow-up.',
      metadata: {
        conversationId: conversation.id,
        keyword: emergency.keyword,
        from,
      },
    });
    await prisma.message.create({
      data: {
        businessId,
        conversationId: conversation.id,
        sender: "SYSTEM",
        content:
          'Emergency keyword detected ("' +
          emergency.keyword +
          '") on a phone call. Flagged for immediate human attention.',
      },
    });
  }

  // A human has taken over this call's conversation.
  if (!conversation.aiActive) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status },
    });
    return xml(
      sayHangupTwiml(
        "Thank you. A member of our team will follow up with you shortly. Goodbye.",
      ),
    );
  }

  if (emergency.isEmergency) {
    const reassure =
      "I understand this may be an emergency. I am alerting our team right now. Please stay on the line, and if anyone is in danger, hang up and call your local emergency number.";
    await prisma.message.create({
      data: {
        businessId,
        conversationId: conversation.id,
        sender: "AI",
        content: reassure,
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status },
    });
    return xml(sayHangupTwiml(reassure));
  }

  const recent = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  const history: ChatTurn[] = recent
    .filter((m) => m.sender === "CUSTOMER" || m.sender === "AI")
    .map((m) => ({
      role: m.sender === "CUSTOMER" ? "user" : "assistant",
      content: m.content,
    }));

  const systemPrompt =
    buildVoicePrompt(business, aiSetting, promptServices) +
    "\n" +
    (emergency.isEmergency
      ? "\nIMPORTANT: The caller's last message may describe an emergency. Respond with urgency and reassurance, and tell them a team member is being alerted now."
      : "");

  const reply = await generateAiReply({ systemPrompt, history });

  await prisma.message.create({
    data: {
      businessId,
      conversationId: conversation.id,
      sender: "AI",
      content: reply,
    },
  });

  // Attempt to turn a confirmed call into a real Job + Customer.
  let bookedCustomerId: string | null = null;
  let booked = false;
  const bookingEnabled = aiSetting?.bookingEnabled !== false;
  const userTurns = history.filter((h) => h.role === "user").length;
  if (
    bookingEnabled &&
    !emergency.isEmergency &&
    status !== "BOOKED" &&
    userTurns >= 2
  ) {
    const existingJob = await prisma.job.findUnique({
      where: { conversationId: conversation.id },
    });
    if (!existingJob) {
      const extraction = await extractBooking([
        ...history,
        { role: "assistant", content: reply },
      ]);
      if (extraction.readyToBook) {
        const callerPhone = extraction.phone || from || null;
        let customerId = conversation.customerId ?? null;
        if (!customerId) {
          const existingCustomer = callerPhone
            ? await prisma.customer.findFirst({
                where: { businessId, phone: callerPhone },
              })
            : null;
          const customer =
            existingCustomer ??
            (await prisma.customer.create({
              data: {
                businessId,
                name: extraction.customerName || null,
                phone: callerPhone,
                address: extraction.address || null,
              },
            }));
          customerId = customer.id;
        }
        bookedCustomerId = customerId;
        const noteParts = [
          extraction.preferredTime
            ? "Preferred time: " + extraction.preferredTime
            : "",
          "Booked via AI phone call.",
        ].filter(Boolean);
        let scheduledAt: Date | null = null;
        if (extraction.preferredDateIso) {
          const dt = new Date(extraction.preferredDateIso);
          if (!Number.isNaN(dt.getTime())) scheduledAt = dt;
        }
        const job = await prisma.job.create({
          data: {
            businessId,
            customerId,
            conversationId: conversation.id,
            title: extraction.problemSummary || "Phone booking request",
            problem: extraction.problemSummary || null,
            address: extraction.address || null,
            urgency: extraction.urgency,
            status: "BOOKED",
            scheduledAt,
            notes: noteParts.join(" "),
          },
        });
        booked = true;
        status = "BOOKED";
        await createNotification({
          businessId,
          type:
            extraction.urgency === "EMERGENCY" ? "URGENT_LEAD" : "NEW_BOOKING",
          title:
            (extraction.urgency === "EMERGENCY"
              ? "Urgent booking: "
              : "New booking: ") +
            (extraction.problemSummary || "Phone request"),
          body:
            (extraction.customerName || "A caller") +
            " booked via the AI phone line" +
            (extraction.preferredTime
              ? " for " + extraction.preferredTime
              : "") +
            ".",
          metadata: {
            jobId: job.id,
            conversationId: conversation.id,
            source: "VOICE_CALL",
          },
        });
        await prisma.message.create({
          data: {
            businessId,
            conversationId: conversation.id,
            sender: "SYSTEM",
            content: "Booking created from phone call (Job " + job.id + ").",
          },
        });
      }
    }
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      status,
      ...(bookedCustomerId && !conversation.customerId
        ? { customerId: bookedCustomerId }
        : {}),
    },
  });

  if (booked === false && userTurns >= 4) {
    const handoff =
      "Thank you for your patience. Let me have a team member call you back shortly to finish helping you. Goodbye.";
    await prisma.message.create({
      data: {
        businessId,
        conversationId: conversation.id,
        sender: "AI",
        content: handoff,
      },
    });
    await createNotification({
      businessId,
      type: "HUMAN_HANDOFF",
      title: "Phone call needs a callback",
      body: "An AI phone call reached the turn limit without booking. Flagged for a manual callback.",
      metadata: { conversationId: conversation.id, source: "VOICE_CALL" },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: "HUMAN_NEEDED" },
    });
    return xml(sayHangupTwiml(handoff));
  }

  const prompt = booked
    ? "Is there anything else I can help you with?"
    : "I'm listening.";
  return xml(sayThenGatherTwiml({ say: reply, prompt, action }));
}
