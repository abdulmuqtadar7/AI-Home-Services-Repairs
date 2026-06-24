import { describe, expect, it } from "vitest";
import { scoreLead } from "@/lib/leadScore";

const now = new Date("2026-06-24T12:00:00.000Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
const daysAgo = (d: number) =>
  new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

describe("scoreLead", () => {
  it("scores a fresh emergency lead as hot with rich reasons", () => {
    const result = scoreLead(
      {
        status: "NEW_LEAD",
        urgency: "EMERGENCY",
        createdAt: minutesAgo(30),
        customerPhone: "5551230001",
        customerReturning: true,
        amountCharged: 1000,
      },
      now,
    );
    // 50 + 25 + 20 + 10 + 10 + min(20, round(1000/100)=10) = 125
    expect(result.score).toBe(125);
    expect(result.tier).toBe("hot");
    expect(result.reasons).toContain("Emergency job");
    expect(result.reasons).toContain("Came in within the hour");
    expect(result.reasons).toContain("Returning customer");
  });

  it("scores a stale low-priority in-progress job as cool", () => {
    const result = scoreLead(
      {
        status: "IN_PROGRESS",
        urgency: "LOW",
        createdAt: daysAgo(10),
        customerPhone: null,
        customerReturning: false,
        amountCharged: null,
      },
      now,
    );
    // 5 + 0 + 0 + 0 = 5
    expect(result.score).toBe(5);
    expect(result.tier).toBe("cool");
    expect(result.reasons).toContain("No phone on file");
    expect(result.reasons).toContain("Going stale - over a week old");
  });

  it("scores a qualified high-urgency same-day lead as warm", () => {
    const result = scoreLead(
      {
        status: "QUALIFIED",
        urgency: "HIGH",
        createdAt: hoursAgo(5),
        customerPhone: "5551230002",
        customerReturning: false,
        amountCharged: null,
      },
      now,
    );
    // 30 + 15 + 10 + 10 = 65
    expect(result.score).toBe(65);
    expect(result.tier).toBe("warm");
  });

  it("falls back to default points for unknown urgency and status", () => {
    const result = scoreLead(
      {
        status: "MYSTERY",
        urgency: "MYSTERY",
        createdAt: minutesAgo(10),
        customerPhone: "555",
        customerReturning: false,
        amountCharged: null,
      },
      now,
    );
    // 5 + 0 + 20 + 10 = 35
    expect(result.score).toBe(35);
    expect(result.tier).toBe("cool");
  });

  it("caps the value bonus at 20 points", () => {
    const result = scoreLead(
      {
        status: "BOOKED",
        urgency: "NORMAL",
        createdAt: hoursAgo(48),
        customerPhone: "555",
        customerReturning: false,
        amountCharged: 999999,
      },
      now,
    );
    // 10 + 5 + 5 + 10 + 20(capped) = 50
    expect(result.score).toBe(50);
    expect(result.tier).toBe("warm");
    expect(result.reasons).toContain("Estimated value attached");
  });
});
