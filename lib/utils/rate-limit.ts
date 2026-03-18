// ============================================================
// Simple token-bucket rate limiter for external API calls.
// Prevents hitting ENSEMBL / STRING rate limits during seeding.
// ============================================================

interface Bucket {
  tokens: number;
  lastRefill: number; // epoch ms
}

const buckets = new Map<string, Bucket>();

/**
 * Acquire a token for `key`. Blocks (via sleep) until a token is available.
 * @param key      Identifier for the rate-limited resource (e.g. "ensembl")
 * @param maxRPM   Maximum requests per minute for this key
 */
export async function acquireToken(key: string, maxRPM: number): Promise<void> {
  const intervalMs = (60 / maxRPM) * 1000; // ms between tokens

  if (!buckets.has(key)) {
    buckets.set(key, { tokens: maxRPM, lastRefill: Date.now() });
  }

  const bucket = buckets.get(key)!;

  // Refill tokens based on elapsed time
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor(elapsed / intervalMs);
  if (refill > 0) {
    bucket.tokens = Math.min(maxRPM, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return;
  }

  // Wait until next token is available
  const waitMs = intervalMs - (now - bucket.lastRefill);
  await sleep(waitMs);
  return acquireToken(key, maxRPM);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
