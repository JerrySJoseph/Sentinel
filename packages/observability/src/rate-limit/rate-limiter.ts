import type { RateLimitStore } from './types';

export type RateLimitDecision = {
  allowed: boolean;
  /**
   * Count after applying this request (i.e. after increment).
   */
  count: number;
  /**
   * Remaining requests allowed in this window (0 when blocked).
   */
  remaining: number;
  /**
   * Epoch millis when the current window resets.
   */
  resetAtMs: number;
  /**
   * Suggested retry-after duration (0 when allowed).
   */
  retryAfterMs: number;
};

export type RateLimiterInput = {
  key: string;
  limit: number;
  windowMs: number;
};

export class RateLimiter {
  constructor(private readonly store: RateLimitStore) {}

  async consume(input: RateLimiterInput): Promise<RateLimitDecision> {
    if (!Number.isFinite(input.limit) || input.limit <= 0) {
      throw new Error('RateLimiter: limit must be a positive number');
    }
    if (!Number.isFinite(input.windowMs) || input.windowMs <= 0) {
      throw new Error('RateLimiter: windowMs must be a positive number');
    }

    const { count, expiresAtMs } = await this.store.incrementWithTtl({
      key: input.key,
      ttlMs: input.windowMs,
    });

    const allowed = count <= input.limit;
    const remaining = Math.max(0, input.limit - count);
    const now = Date.now();
    const retryAfterMs = allowed ? 0 : Math.max(0, expiresAtMs - now);

    return {
      allowed,
      count,
      remaining,
      resetAtMs: expiresAtMs,
      retryAfterMs,
    };
  }
}
