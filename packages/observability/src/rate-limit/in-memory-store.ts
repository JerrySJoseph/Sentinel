import type { RateLimitIncrementInput, RateLimitIncrementResult, RateLimitStore } from './types';

type Entry = {
  count: number;
  expiresAtMs: number;
};

type KeyLock = {
  tail: Promise<void>;
};

/**
 * Deterministic, race-safe in-memory implementation.
 *
 * - Atomicity is provided by a per-key async queue (no lost updates).
 * - Expiry is "fixed window": first write sets expiresAtMs; subsequent increments
 *   within the window do NOT extend the expiry.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  readonly kind = 'in-memory';

  private readonly entries = new Map<string, Entry>();
  private readonly locks = new Map<string, KeyLock>();
  private closed = false;

  async incrementWithTtl(input: RateLimitIncrementInput): Promise<RateLimitIncrementResult> {
    if (this.closed) throw new Error('InMemoryRateLimitStore is closed');
    if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) {
      throw new Error('InMemoryRateLimitStore: ttlMs must be a positive number');
    }

    return await this.withKeyLock(input.key, async () => {
      const now = Date.now();
      const existing = this.entries.get(input.key);

      if (!existing || existing.expiresAtMs <= now) {
        const expiresAtMs = now + input.ttlMs;
        const next = { count: 1, expiresAtMs };
        this.entries.set(input.key, next);
        return { count: next.count, expiresAtMs: next.expiresAtMs };
      }

      existing.count += 1;
      return { count: existing.count, expiresAtMs: existing.expiresAtMs };
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    this.entries.clear();
    this.locks.clear();
  }

  private async withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const lock = this.locks.get(key) ?? { tail: Promise.resolve() };
    this.locks.set(key, lock);

    const prev = lock.tail;

    // Chain next tail *before* awaiting so concurrent callers serialize.
    let release!: () => void;
    lock.tail = new Promise<void>((r) => {
      release = r;
    });

    await prev;
    try {
      return await fn();
    } finally {
      release();
      // Note: we intentionally do not try to aggressively clean up locks here.
      // Cleanup is not required for correctness, and "is this the last waiter?"
      // is surprisingly subtle without extra bookkeeping.
    }
  }
}

