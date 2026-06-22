// Deterministic lead scoring. Ranks open jobs by how urgently they should be
// chased: urgency, pipeline freshness, age, contactability, loyalty, and value.
// Pure + side-effect free so it is easy to unit test and reuse on the server.

export type ScoredJobInput = {
  status: string;
  urgency: string;
  createdAt: Date;
  customerPhone?: string | null;
  customerReturning?: boolean;
  amountCharged?: number | null;
};

export type LeadTier = "hot" | "warm" | "cool";

export type LeadScore = {
  score: number;
  tier: LeadTier;
  reasons: string[];
};

const URGENCY_POINTS: Record<string, number> = {
  EMERGENCY: 50,
  HIGH: 30,
  NORMAL: 10,
  LOW: 5,
};

const STATUS_POINTS: Record<string, number> = {
  NEW_LEAD: 25,
  QUALIFIED: 15,
  ESTIMATE_REQUESTED: 12,
  BOOKED: 5,
  DISPATCHED: 3,
  IN_PROGRESS: 0,
};

const HOUR_MS = 60 * 60 * 1000;

export function scoreLead(
  input: ScoredJobInput,
  now: Date = new Date(),
): LeadScore {
  const reasons: string[] = [];
  let score = 0;

  score += URGENCY_POINTS[input.urgency] ?? 5;
  if (input.urgency === "EMERGENCY") reasons.push("Emergency job");
  else if (input.urgency === "HIGH") reasons.push("High urgency");

  score += STATUS_POINTS[input.status] ?? 0;
  if (input.status === "NEW_LEAD") reasons.push("Brand-new lead");
  else if (input.status === "QUALIFIED") reasons.push("Qualified, not booked");
  else if (input.status === "ESTIMATE_REQUESTED")
    reasons.push("Waiting on an estimate");

  const ageMs = now.getTime() - input.createdAt.getTime();
  if (ageMs <= HOUR_MS) {
    score += 20;
    reasons.push("Came in within the hour");
  } else if (ageMs <= 24 * HOUR_MS) {
    score += 10;
    reasons.push("Less than a day old");
  } else if (ageMs <= 7 * 24 * HOUR_MS) {
    score += 5;
  } else {
    reasons.push("Going stale - over a week old");
  }

  if (input.customerPhone) {
    score += 10;
    reasons.push("Has a phone number to call");
  } else {
    reasons.push("No phone on file");
  }

  if (input.customerReturning) {
    score += 10;
    reasons.push("Returning customer");
  }

  if (input.amountCharged && input.amountCharged > 0) {
    score += Math.min(20, Math.round(input.amountCharged / 100));
    reasons.push("Estimated value attached");
  }

  const tier: LeadTier = score >= 80 ? "hot" : score >= 50 ? "warm" : "cool";

  return { score, tier, reasons };
}
