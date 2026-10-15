/**
 * BKC activity: ingest pages from an API guarded by a token bucket.
 * A teaching model of rate-limited ingestion, not code from the internship.
 * Deterministic: the same choices always give the same run.
 */
export const BUCKET = { capacity: 5, refillPerSecond: 2 };
export const PAGES = 40;
export const RATES = [1, 2, 4, 8] as const;
export type Rate = typeof RATES[number];
export interface IngestRun { rate: Rate; backoff: boolean; seconds: number; rejected: number; requests: number; timeline: Array<'ok' | '429'> }

const STEP = .05;
/** Send `rate` requests a second until every page is in. With back-off, a 429 pauses sending for the Retry-After second. */
export function ingest(rate: Rate, backoff: boolean, pages = PAGES): IngestRun {
  let tokens = BUCKET.capacity, done = 0, rejected = 0, requests = 0, t = 0, nextSend = 0, pausedUntil = 0;
  const timeline: IngestRun['timeline'] = [];
  while (done < pages && t < 600) {
    tokens = Math.min(BUCKET.capacity, tokens + BUCKET.refillPerSecond * STEP);
    if (t + 1e-9 >= nextSend && t + 1e-9 >= pausedUntil) {
      requests++; nextSend = t + 1 / rate;
      if (tokens >= 1) { tokens -= 1; done++; timeline.push('ok'); }
      else { rejected++; timeline.push('429'); if (backoff) pausedUntil = t + 1; }
    }
    t += STEP;
  }
  return { rate, backoff, seconds: Math.round(t * 10) / 10, rejected, requests, timeline };
}

/** The best clean run: no 429s, in the least time. */
export function bestCleanRun() {
  return RATES.flatMap(rate => [false, true].map(backoff => ingest(rate, backoff))).filter(r => r.rejected === 0).sort((a, b) => a.seconds - b.seconds)[0];
}
/** Solved when a run has no 429s and is as fast as the best clean run. */
export const solves = (run: IngestRun) => run.rejected === 0 && run.seconds <= bestCleanRun().seconds + 1e-9;
