export type RateLimitIncrementInput = {
  /**
   * Logical key representing the subject being rate limited (e.g. userId, ip).
   * Callers typically namespace this themselves (e.g. "rl:login:ip:1.2.3.4").
   */
  key: string;
  /**
   * Fixed window duration; the counter expires after this TTL.
   * Implementations MUST set expiry when the key is first created.
   */
  ttlMs: number;
};

export type RateLimitIncrementResult = {
  /**
   * Current count after increment.
   */
  count: number;
  /**
   * Epoch millis when this counter will expire/reset.
   */
  expiresAtMs: number;
};

/**
 * Minimal store contract needed for rate limiting.
 *
 * IMPORTANT: incrementWithTtl must be atomic: concurrent calls for the same key
 * must result in monotonically increasing counts without lost updates, and a
 * stable expiration (fixed window) for the lifetime of the key.
 */
export interface RateLimitStore {
  readonly kind: string;
  incrementWithTtl(input: RateLimitIncrementInput): Promise<RateLimitIncrementResult>;
  close(): Promise<void>;
}

