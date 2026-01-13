import { randomUUID } from 'crypto';
import type { AcquireLeaseResult, ConcurrencyStore } from './types';

export type ConcurrencyLimiterOptions = {
  key: string;
  limit: number;
  leaseTtlMs: number;
};

export type ConcurrencyLease = {
  leaseId: string;
  expiresAtMs: number;
};

export class ConcurrencyLimiter {
  constructor(
    private readonly store: ConcurrencyStore,
    private readonly options: ConcurrencyLimiterOptions
  ) {}

  async tryAcquire(): Promise<AcquireLeaseResult> {
    const leaseId = randomUUID();
    return await this.store.tryAcquire({
      key: this.options.key,
      limit: this.options.limit,
      ttlMs: this.options.leaseTtlMs,
      leaseId,
    });
  }

  async release(lease: ConcurrencyLease): Promise<void> {
    await this.store.release({ key: this.options.key, leaseId: lease.leaseId });
  }
}

