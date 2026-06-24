import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectEmergency,
  buildSystemPrompt,
  buildVoicePrompt,
  generateAiReply,
  extractBooking,
  type ChatTurn,
} from "@/lib/ai";

const business = {
  name: "Rapid Plumbing Co",
  niche: "plumbing",
  trades: ["plumbing"],
  emergencyAvailable: true,
  diagnosticFee: 49,
};

const multiTradeBusiness = {
  name: "All Trades Home Services",
  niche: "plumbing",
  trades: ["plumbing", "electrical", "hvac"],
  emergencyAvailable: false,
  diagnosticFee: null,
};

const aiSetting = {
  greeting: null,
  tone: "friendly",
  personaName: "Riley",
  systemPromptOverride: null,
  bookingEnabled: true,
};

const services = [
  { name: "Drain cleaning", niche: "plumbing", basePrice: 120 },
  { name: "Water heater repair", niche: "plumbing", basePrice: 250 },
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("detectEmergency", () => {
  it("flags default emergency keywords case-insensitively", () => {
    expect(detectEmergency("There is a GAS LEAK in the kitchen")).toEqual({
      isEmergency: true,
      keyword: "gas leak",
    });
  });

  it("returns no emergency for routine messages", () => {
    expect(detectEmergency("My kitchen sink is a little slow")).toEqual({
      isEmergency: false,
      keyword: null,
    });
  });

  it("honors extra keywords lowercased", () => {
    expect(detectEmergency("The boiler is KAPUT", ["kaput"])).toEqual({
      isEmergency: true,
      keyword: "kaput",
    });
  });
});

describe("buildSystemPrompt", () => {
  it("returns the override verbatim when set", () => {
    const prompt = buildSystemPrompt(
      business,
      { ...aiSetting, systemPromptOverride: "CUSTOM OVERRIDE PROMPT" },
      services,
    );
    expect(prompt).toBe("CUSTOM OVERRIDE PROMPT");
  });

  it("builds a single-trade prompt with persona, name, and services", () => {
    const prompt = buildSystemPrompt(business, aiSetting, services);
    expect(prompt).toContain("Riley");
    expect(prompt).toContain("Rapid Plumbing Co");
    expect(prompt).toContain("Drain cleaning");
    expect(prompt).not.toContain("multi-trade");
    expect(prompt).toContain("offer to book a visit");
  });

  it("builds a multi-trade prompt and respects bookingEnabled false", () => {
    const prompt = buildSystemPrompt(
      multiTradeBusiness,
      { ...aiSetting, bookingEnabled: false },
      services,
    );
    expect(prompt).toContain("multi-trade");
    expect(prompt).toContain("team will follow up to schedule");
  });
});

describe("buildVoicePrompt", () => {
  it("wraps the base prompt with voice-specific guidance", () => {
    const prompt = buildVoicePrompt(business, aiSetting, services);
    expect(prompt).toContain("Rapid Plumbing Co");
    expect(prompt).toContain("read aloud by a text to speech voice");
    expect(prompt).toContain("at most two short sentences");
  });
});

describe("generateAiReply", () => {
  it("falls back to the scripted reply when no API key is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const history: ChatTurn[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "my sink leaks" },
    ];
    const reply = await generateAiReply({ systemPrompt: "x", history });
    expect(reply).toContain("phone number");
  });

  it("returns the trimmed model reply when fetch succeeds", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "  Sure, I can help.  " } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const reply = await generateAiReply({
      systemPrompt: "sys",
      history: [{ role: "user", content: "hello" }],
    });
    expect(reply).toBe("Sure, I can help.");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("falls back when fetch responds non-ok", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const reply = await generateAiReply({
      systemPrompt: "sys",
      history: [{ role: "user", content: "hello" }],
    });
    expect(reply.length).toBeGreaterThan(0);
  });
});

describe("extractBooking", () => {
  it("returns the empty booking shape when no API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await extractBooking([{ role: "user", content: "hi" }]);
    expect(result.readyToBook).toBe(false);
    expect(result.urgency).toBe("NORMAL");
  });

  it("parses model JSON and guards the urgency enum", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  readyToBook: true,
                  customerName: "Jane Doe",
                  phone: "5551230001",
                  address: "12 Oak Street",
                  problemSummary: "Clogged sink",
                  preferredTime: "tomorrow morning",
                  preferredDateIso: "2026-07-01T09:00:00",
                  urgency: "BOGUS",
                }),
              },
            },
          ],
        }),
      }),
    );
    const result = await extractBooking([
      { role: "user", content: "book me please" },
    ]);
    expect(result.readyToBook).toBe(true);
    expect(result.customerName).toBe("Jane Doe");
    expect(result.urgency).toBe("NORMAL");
  });

  it("returns the empty booking when fetch throws", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await extractBooking([{ role: "user", content: "hi" }]);
    expect(result.readyToBook).toBe(false);
  });
});
