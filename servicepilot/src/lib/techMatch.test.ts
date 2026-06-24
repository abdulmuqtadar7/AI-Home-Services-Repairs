import { describe, expect, it } from "vitest";
import { matchTechnicians } from "@/lib/techMatch";

describe("matchTechnicians", () => {
  it("ranks skill-matched, lightly-loaded techs first", () => {
    const result = matchTechnicians(
      [
        {
          id: "t1",
          name: "Alex",
          skills: ["plumbing"],
          active: true,
          openJobs: 1,
        },
        {
          id: "t2",
          name: "Sam",
          skills: ["electrical"],
          active: true,
          openJobs: 0,
        },
      ],
      { niche: "plumbing" },
    );
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("t1");
    expect(result[0].score).toBe(70); // 50 + (30 - 10)
    expect(result[0].skillMatch).toBe(true);
    expect(result[1].id).toBe("t2");
    expect(result[1].score).toBe(30); // 0 + 30
    expect(result[1].skillMatch).toBe(false);
  });

  it("excludes inactive technicians", () => {
    const result = matchTechnicians(
      [
        {
          id: "t1",
          name: "Alex",
          skills: ["plumbing"],
          active: false,
          openJobs: 0,
        },
        {
          id: "t2",
          name: "Sam",
          skills: ["plumbing"],
          active: true,
          openJobs: 0,
        },
      ],
      { niche: "plumbing" },
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t2");
  });

  it("matches the niche case-insensitively", () => {
    const result = matchTechnicians(
      [
        {
          id: "t1",
          name: "Alex",
          skills: ["Plumbing"],
          active: true,
          openJobs: 0,
        },
      ],
      { niche: "PLUMBING" },
    );
    expect(result[0].skillMatch).toBe(true);
    expect(result[0].score).toBe(80); // 50 + 30
  });

  it("handles a missing niche with load-only scoring", () => {
    const result = matchTechnicians(
      [
        {
          id: "t1",
          name: "Alex",
          skills: ["plumbing"],
          active: true,
          openJobs: 2,
        },
      ],
      { niche: null },
    );
    expect(result[0].skillMatch).toBe(false);
    expect(result[0].score).toBe(10); // max(0, 30 - 20)
    expect(result[0].reasons).toContain("No service category on job");
  });

  it("never scores workload below zero", () => {
    const result = matchTechnicians(
      [
        {
          id: "t1",
          name: "Alex",
          skills: ["plumbing"],
          active: true,
          openJobs: 9,
        },
      ],
      { niche: "plumbing" },
    );
    expect(result[0].score).toBe(50); // 50 + max(0, 30 - 90)
  });
});
