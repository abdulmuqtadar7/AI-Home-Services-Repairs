import { nicheLabel } from "@/lib/serviceCatalog";

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
  trades?: string[] | null;
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

export type PromptService = {
  name: string;
  niche?: string | null;
  basePrice?: number | string | null;
};

function formatService(s: PromptService): string {
  const n = typeof s.basePrice === "number" ? s.basePrice : Number(s.basePrice);
  const price = Number.isFinite(n) && n > 0 ? ` (from $${n})` : "";
  return `${s.name}${price}`;
}

export function buildSystemPrompt(
  business: BusinessLike,
  ai: AiSettingLike,
  services: PromptService[] = [],
) {
  if (ai?.systemPromptOverride && ai.systemPromptOverride.trim()) {
    return ai.systemPromptOverride;
  }
  const persona = ai?.personaName || "Assistant";
  const tone = ai?.tone || "friendly";

  // Resolve the trades this business covers: prefer the multi-select list,
  // fall back to the single primary niche.
  const trades =
    business.trades && business.trades.length > 0
      ? business.trades
      : [business.niche];
  const multiTrade = trades.length > 1;
  const tradeLabels = trades.map((t) => nicheLabel(t));

  const cleanServices = services.filter((s) => s && s.name && s.name.trim());

  // Identity
  const identityLine = multiTrade
    ? `You are ${persona}, the ${tone} AI receptionist for ${business.name}, a multi-trade home services and repair business that handles ${tradeLabels.join(", ")}.`
    : `You are ${persona}, the ${tone} AI receptionist for ${business.name}, a ${tradeLabels[0]?.toLowerCase() || "home services"} business.`;

  // Services block: grouped by category for multi-trade, flat otherwise.
  let servicesBlock = "";
  if (cleanServices.length) {
    if (multiTrade) {
      const groups = new Map<string, PromptService[]>();
      for (const s of cleanServices) {
        const key = s.niche || "OTHER";
        const arr = groups.get(key);
        if (arr) arr.push(s);
        else groups.set(key, [s]);
      }
      const parts: string[] = [];
      for (const [key, list] of groups) {
        parts.push(
          `- ${nicheLabel(key)}: ${list.map(formatService).join(", ")}`,
        );
      }
      servicesBlock = `Services this business offers, grouped by category:\n${parts.join("\n")}`;
    } else {
      servicesBlock = `Services this business offers: ${cleanServices.map(formatService).join(", ")}.`;
    }
  }

  // Scope / guardrails
  const scopeLine = multiTrade
    ? `${business.name} works across these trades: ${tradeLabels.join(", ")}. Help with any reasonable request that falls within these trades. When a customer's need spans more than one trade, figure out which trade it belongs to. Politely decline work that is clearly outside all of these trades, or anything that is not a home service at all (for example legal, medical, or unrelated topics), and offer to connect them with the team.`
    : `${business.name} specializes in ${tradeLabels[0]?.toLowerCase() || "home services"}. If a customer asks for work in a clearly different trade that this business does not offer, politely explain it is outside your expertise and offer to connect them with the team, instead of booking it.`;

  const lines = [
    identityLine,
    servicesBlock,
    `Your job: greet customers, understand their problem, qualify the lead, and help them book a service visit.`,
    `Use the services list above to recognize what the customer needs, suggest the most relevant service, and give a rough idea of scope. Only reference services this business actually offers.`,
    `Be concise, warm, and professional. Ask only one question at a time.`,
    `Collect the customer's name, phone number, service address, and a clear description of the problem.`,
    ai?.bookingEnabled
      ? `When you have enough detail, offer to book a visit and confirm a preferred day and time.`
      : `Do not promise specific booking times; tell the customer the team will follow up to schedule.`,
    business.emergencyAvailable
      ? `This business offers emergency service. If the issue sounds urgent or dangerous, reassure the customer and tell them a team member is being alerted immediately.`
      : `This business does not guarantee emergency service. For dangerous issues, advise contacting emergency services and that the team will follow up as soon as possible.`,
    `Never guarantee exact pricing. The prices listed are starting points only.${business.diagnosticFee ? " If asked about cost, you may mention that a diagnostic or service-call fee may apply." : ""}`,
    `If the customer wants a human or asks something you cannot handle, tell them you will connect them with the team.`,
    scopeLine,
  ];
  return lines.filter(Boolean).join("\n");
}

export function buildVoicePrompt(
  business: BusinessLike,
  ai: AiSettingLike,
  services: PromptService[] = [],
) {
  const base = buildSystemPrompt(business, ai, services);
  const nl = String.fromCharCode(10);
  const voiceLines = [
    "This conversation is happening over a live phone call, and your reply will be read aloud by a text to speech voice.",
    "Keep every reply to at most two short sentences.",
    "Ask only one question per turn.",
    "Do not use URLs, links, email addresses, markdown, bullet points, or any special formatting.",
    "Speak in plain, natural spoken language, since the caller cannot see any text.",
    "Confirm key details like phone number and address by reading them back to the caller.",
  ];
  return base + nl + nl + voiceLines.join(" ");
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

export type BookingExtraction = {
  readyToBook: boolean;
  customerName: string;
  phone: string;
  address: string;
  problemSummary: string;
  preferredTime: string;
  preferredDateIso: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "EMERGENCY";
};

const EMPTY_BOOKING: BookingExtraction = {
  readyToBook: false,
  customerName: "",
  phone: "",
  address: "",
  problemSummary: "",
  preferredTime: "",
  preferredDateIso: "",
  urgency: "NORMAL",
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function extractBooking(
  history: ChatTurn[],
): Promise<BookingExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey) {
    return EMPTY_BOOKING;
  }
  const transcript = history
    .map(
      (t) => (t.role === "user" ? "Customer" : "Assistant") + ": " + t.content,
    )
    .join("\n");
  const today = new Date().toISOString();
  const sys =
    "You analyze a home-services chat and extract booking details. " +
    "Today's date and time is " +
    today +
    " (UTC). " +
    "Respond ONLY with a JSON object with these keys: " +
    "readyToBook (boolean: true if the customer has agreed to schedule or book a visit, or has clearly stated a day/time they want to be seen), " +
    "customerName (string), phone (string), address (string), " +
    "problemSummary (a short description of the issue), " +
    "preferredTime (the day/time the customer wants, as free text), " +
    "preferredDateIso (the preferred day/time as an absolute ISO 8601 timestamp like 2026-07-01T09:00:00; resolve relative dates such as tomorrow or next Monday against today, never return a past date, and if a day is given with no time default to 09:00; empty string if no specific day was requested), " +
    "urgency (one of: LOW, NORMAL, HIGH, EMERGENCY). " +
    "Use an empty string for anything not provided. Do not invent values.";
  try {
    const res = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: "Conversation:\n" + transcript },
        ],
      }),
    });
    if (!res.ok) {
      return EMPTY_BOOKING;
    }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") {
      return EMPTY_BOOKING;
    }
    const parsed = JSON.parse(raw);
    const urgency = ["LOW", "NORMAL", "HIGH", "EMERGENCY"].includes(
      parsed?.urgency,
    )
      ? parsed.urgency
      : "NORMAL";
    return {
      readyToBook: Boolean(parsed?.readyToBook),
      customerName: asString(parsed?.customerName),
      phone: asString(parsed?.phone),
      address: asString(parsed?.address),
      problemSummary: asString(parsed?.problemSummary),
      preferredTime: asString(parsed?.preferredTime),
      preferredDateIso: asString(parsed?.preferredDateIso),
      urgency,
    };
  } catch {
    return EMPTY_BOOKING;
  }
}
