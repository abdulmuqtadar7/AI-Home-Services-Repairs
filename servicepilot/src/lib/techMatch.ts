// Deterministic technician matching. Ranks technicians for a job by skill match
// (against the job's service category) and current workload. Pure + testable.

export type TechCandidate = {
  id: string;
  name: string;
  skills: string[];
  active: boolean;
  openJobs: number;
};

export type TechMatchResult = {
  id: string;
  name: string;
  score: number;
  skillMatch: boolean;
  openJobs: number;
  reasons: string[];
};

export function matchTechnicians(
  candidates: TechCandidate[],
  opts: { niche?: string | null },
): TechMatchResult[] {
  const niche = (opts.niche ?? "").trim();
  const nicheLower = niche.toLowerCase();

  return candidates
    .filter((c) => c.active)
    .map((c) => {
      const reasons: string[] = [];
      const skillsLower = c.skills.map((s) => s.toLowerCase());
      const skillMatch =
        nicheLower.length > 0 && skillsLower.includes(nicheLower);

      let score = 0;
      if (skillMatch) {
        score += 50;
        reasons.push("Skilled in " + niche);
      } else if (nicheLower.length === 0) {
        reasons.push("No service category on job");
      } else {
        reasons.push("Not tagged for " + niche);
      }

      const loadScore = Math.max(0, 30 - c.openJobs * 10);
      score += loadScore;
      if (c.openJobs === 0) {
        reasons.push("No open jobs right now");
      } else {
        reasons.push(
          c.openJobs + (c.openJobs === 1 ? " open job" : " open jobs"),
        );
      }

      return {
        id: c.id,
        name: c.name,
        score,
        skillMatch,
        openJobs: c.openJobs,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);
}
