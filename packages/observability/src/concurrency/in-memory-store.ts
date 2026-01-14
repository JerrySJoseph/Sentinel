import type {
  AcquireLeaseInput,
  AcquireLeaseResult,
  ConcurrencyStore,
  ReleaseLeaseInput,
  ReleaseLeaseResult,
} from './types';

type LeaseEntry = {
  expiresAtMs: number;
};

type KeyLock = {
  tail: Promise<void>;
};

export type InMemoryConcurrencyStoreOptions = {
  nowMs?: () => number;
};

/**
 * Race-safe in-memory implementation using per-key async serialization.
 * Suitable for tests and single-process dev.
 */
export class InMemoryConcurrencyStore implements ConcurrencyStore {
  readonly kind = 'in-memory';

  private readonly nowMs: () => number;
  private readonly leasesByKey = new Map<string, Map<string, LeaseEntry>>();
  private readonly locks = new Map<string, KeyLock>();
  private closed = false;

  constructor(options: InMemoryConcurrencyStoreOptions = {}) {
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  async tryAcquire(input: AcquireLeaseInput): Promise<AcquireLeaseResult> {
    if (this.closed) throw new Error('InMemoryConcurrencyStore is closed');
    if (!Number.isFinite(input.limit) || input.limit <= 0) {
      throw new Error('InMemoryConcurrencyStore: limit must be a positive number');
    }
    if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) {
      throw new Error('InMemoryConcurrencyStore: ttlMs must be a positive number');
    }

    return await this.withKeyLock(input.key, () => {
      const now = this.nowMs();
      const expiresAtMs = now + input.ttlMs;

      const leases = this.leasesByKey.get(input.key) ?? new Map<string, LeaseEntry>();
      this.leasesByKey.set(input.key, leases);

      // Drop expired leases.
      for (const [id, lease] of leases.entries()) {
        if (lease.expiresAtMs <= now) leases.delete(id);
      }

      const count = leases.size;
      if (count >= input.limit) {
        // Suggest retryAfter based on earliest expiry.
        let minExpires = Infinity;
        for (const lease of leases.values()) {
          if (lease.expiresAtMs < minExpires) minExpires = lease.expiresAtMs;
        }
        const retryAfterMs =
          Number.isFinite(minExpires) && minExpires !== Infinity
            ? Math.max(0, minExpires - now)
            : undefined;
        return { acquired: false, leaseId: input.leaseId, count, retryAfterMs };
      }

      leases.set(input.leaseId, { expiresAtMs });
      return { acquired: true, leaseId: input.leaseId, count: leases.size, expiresAtMs };
    });
  }

  async release(input: ReleaseLeaseInput): Promise<ReleaseLeaseResult> {
    if (this.closed) return { released: false, count: 0 };

    return await this.withKeyLock(input.key, () => {
      const leases = this.leasesByKey.get(input.key);
      if (!leases) return { released: false, count: 0 };

      const existed = leases.delete(input.leaseId);
      if (leases.size === 0) this.leasesByKey.delete(input.key);

      return { released: existed, count: leases.size };
    });
  }

  close(): Promise<void> {
    this.closed = true;
    this.leasesByKey.clear();
    this.locks.clear();
    return Promise.resolve();
  }

  private async withKeyLock<T>(key: string, fn: () => T | Promise<T>): Promise<T> {
    const lock = this.locks.get(key) ?? { tail: Promise.resolve() };
    this.locks.set(key, lock);

    const prev = lock.tail;

    let release!: () => void;
    lock.tail = new Promise<void>(r => {
      release = r;
    });

    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
