// Simple in-memory sliding-window rate limiter.
//
// IMPORTANT: state lives in THIS process only. On serverless / multi-instance
// hosts (e.g. Vercel) each request may hit a different worker, so this does NOT
// enforce a global limit there. Swap to Upstash Redis (or similar shared store)
// before running more than one instance.

const buckets = new Map<string, number[]>();

const CLEANUP_MS = 60_000;
let lastCleanup = 0;

// Drop stale buckets at most once per minute so the Map cannot grow unbounded.
function cleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_MS) return;
  lastCleanup = now;
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => now - t < CLEANUP_MS * 2);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfter: number;
};

export function rateLimit(args: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const { key, limit, windowMs } = args;
  const now = Date.now();
  cleanup(now);

  const hits = buckets.get(key) ?? [];
  const fresh = hits.filter((t) => now - t < windowMs);

  if (fresh.length >= limit) {
    const oldest = fresh[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, fresh);
    return { ok: false, remaining: 0, retryAfter };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  return { ok: true, remaining: limit - fresh.length, retryAfter: 0 };
}
