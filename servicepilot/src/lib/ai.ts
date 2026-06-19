import { prisma } from "@/lib/prisma";

const DEFAULT_EMERGENCY_KEYWORDS = [
  "burst",
  "flood",
  "flooding",
  "gas leak",
  "gas smell",
  "smell gas",
  "no heat",
  "no hot water",
  "sparking",
  "electrical fire",
  "fire",
  "sewage",
  "overflowing",
  "carbon monoxide",
  "emergency",
  "urgent",
  "water everywhere",
];

export type ChatTurn = {
  role: "user" | "assistant" | "system";
  content: string;
};

export function detectEmergency(message: string, extraKeywords: string[] = []) {
  const text = message.toLowerCase();
  const keywords = [
    ...DEFAULT_EMERGENCY_KEYWORDS,
    ...extraKeywords.map((k) => k.toLowerCase()),
  ];
  const keyword = keywords.find((k) => k && text.includes(k)) ?? null;
  return { isEmergency: Boolean(keyword), keyword };
}

type BusinessLike = {
  name: string;
  niche: string;
  emergencyAvailable: boolean;
  diagnosticFee: unknown;
};

type AiSettingLike = {
  greeting: string | null;
  tone: string;
  personaName: string;
  systemPromptOverride: string | null;
  bookingEnabled: boolean;
} | null;

export function buildSystemPrompt(business: BusinessLike, ai: AiSettingLike) {
  if (ai?.systemPromptOverride && ai.systemPromptOverride.trim()) {
    return ai.systemPromptOverride;
  }
  const persona = ai?.personaName || "Assistant";
  const tone = ai?.tone || "friendly";
  const niche = business.niche.toLowerCase().replace(/_/g, " ");
  const lines = [
    `You are ${persona}, the ${tone} AI receptionist for ${business.name}, a ${niche} business.`,
    `Your job: greet customers, understand their problem, qualify the lead, and help them book a service visit.`,
    `Be concise, warm, and professional. Ask only one question at a time.`,
    `Collect the customer's name, phone number, service address, and a clear description of the problem.`,
    ai?.bookingEnabled
      ? `When you have enough detail, offer to book a visit and confirm a preferred day and time.`
      : `Do not promise specific booking times; tell the customer the team will follow up to schedule.`,
    business.emergencyAvailable
      ? `This business offers emergency service. If the issue sounds urgent or dangerous, reassure the customer and tell them a team member is being alerted immediately.`
      : `This business does not guarantee emergency service. For dangerous issues, advise contacting emergency services and that the team will follow up as soon as possible.`,
    `Never guarantee pricing.${business.diagnosticFee ? " If asked about cost, you may mention that a diagnostic or service-call fee may apply." : ""}`,
    `If the customer wants a human or asks something you cannot handle, tell them you will connect them with the team.`,
    `Stay strictly on topic for ${business.name}. Do not answer unrelated questions.`,
  ];
  return lines.filter(Boolean).join("\n");
}

export async function generateAiReply(args: {
  systemPrompt: string;
  history: ChatTurn[];
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey) {
    return fallbackReply(args.history);
  }
  try {
    const res = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 300,
        messages: [
          { role: "system", content: args.systemPrompt },
          ...args.history,
        ],
      }),
    });
    if (!res.ok) {
      return fallbackReply(args.history);
    }
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    return typeof reply === "string" && reply.trim()
      ? reply.trim()
      : fallbackReply(args.history);
  } catch {
    return fallbackReply(args.history);
  }
}

function fallbackReply(history: ChatTurn[]): string {
  const userTurns = history.filter((t) => t.role === "user").length;
  const script = [
    "Hi! Thanks for reaching out \u2014 I can help get a service visit booked. Could you tell me your name and what's going on?",
    "Thanks! What's the best phone number to reach you, and the address where you need service?",
    "Got it. Could you briefly describe the problem you're experiencing?",
    "Thank you. When would be a good day and time for a technician to visit?",
    "Perfect \u2014 I have everything I need. Our team will review the details and confirm your appointment shortly. Is there anything else I can help with?",
  ];
  if (userTurns >= 1 && userTurns <= script.length) {
    return script[userTurns - 1];
  }
  if (userTurns < 1) {
    return script[0];
  }
  return "Thanks! A team member will follow up shortly to confirm everything. If it's urgent, please call us directly and we'll prioritize your request.";
}
