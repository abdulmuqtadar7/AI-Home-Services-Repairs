export type ReviewSentiment = "positive" | "neutral" | "negative";

export type ReviewInsight = {
  sentiment: ReviewSentiment;
  themes: string[];
};

// Without a comment (or an API key) we still classify by the star rating so the
// dashboard always has a sentiment to show.
function sentimentFromRating(rating: number): ReviewSentiment {
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

function asTheme(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (!t) return null;
  return t.slice(0, 40);
}

// Extracts sentiment + a few short themes from one review using the same Groq /
// OpenAI-compatible endpoint the chat brain uses. Falls back to a rating-based
// guess on any failure so callers never throw.
export async function analyzeReview(input: {
  rating: number;
  comment: string | null;
}): Promise<ReviewInsight> {
  const fallback: ReviewInsight = {
    sentiment: sentimentFromRating(input.rating),
    themes: [],
  };

  const comment = (input.comment || "").trim();
  if (!comment) return fallback;

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey) return fallback;

  const sys =
    "You analyze a single customer review for a home-services business. " +
    "Respond ONLY with a JSON object with these keys: " +
    "sentiment (one of: positive, neutral, negative), " +
    "themes (an array of 1 to 3 short lowercase topic tags describing what the " +
    "review is about, for example: punctuality, pricing, communication, quality, " +
    "professionalism, scheduling, cleanliness). " +
    "Base sentiment primarily on the comment, using the star rating as context. " +
    "Keep each theme to one or two words. Use an empty array if no clear theme.";

  const user = "Star rating (1-5): " + input.rating + "\nComment: " + comment;

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
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return fallback;
    const parsed = JSON.parse(raw);
    const sentiment: ReviewSentiment = [
      "positive",
      "neutral",
      "negative",
    ].includes(parsed?.sentiment)
      ? parsed.sentiment
      : fallback.sentiment;
    const themesRaw = Array.isArray(parsed?.themes) ? parsed.themes : [];
    const themes = themesRaw
      .map(asTheme)
      .filter((t: string | null): t is string => Boolean(t))
      .slice(0, 3);
    return { sentiment, themes };
  } catch {
    return fallback;
  }
}
