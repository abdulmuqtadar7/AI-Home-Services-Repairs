import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatherTwiml, sayHangupTwiml } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xml(body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

// Twilio hits this when a call comes in. The business is identified by the
// ?businessId= query param baked into the number's webhook URL, so a single
// number maps to one tenant with no schema changes.
async function handle(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId") || "";

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

  const greeting =
    "Thank you for calling " +
    business.name +
    ". You've reached our A I assistant.";
  const prompt = "How can I help you today? Please describe the issue.";
  const action =
    "/api/voice/gather?businessId=" + encodeURIComponent(businessId);

  return xml(gatherTwiml({ greeting, prompt, action }));
}

export const POST = handle;
export const GET = handle;
