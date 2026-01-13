export type AcquireLeaseInput = {
  key: string;
  limit: number;
  ttlMs: number;
  leaseId: string;
};

export type AcquireLeaseResult = {
  acquired: boolean;
  leaseId: string;
  /**
   * Number of active leases after this acquire attempt (if acquired, includes this lease).
   */
  count: number;
  /**
   * Epoch millis when this lease will expire (only meaningful when acquired=true).
   */
  expiresAtMs?: number;
  /**
   * Suggested retry-after duration when acquired=false.
   */
  retryAfterMs?: number;
};

export type ReleaseLeaseInput = {
  key: string;
  leaseId: string;
};

export type ReleaseLeaseResult = {
  released: boolean;
  count: number;
};

/**
 * Platform-agnostic distributed semaphore-like store.
 *
 * Implementations must provide atomic semantics for the same key:
 * - tryAcquire must not exceed limit under concurrency.
 * - leases must expire after ttlMs to avoid deadlocks on crashes.
 * - release must reduce active lease count when possible.
 */
export interface ConcurrencyStore {
  readonly kind: string;
  tryAcquire(input: AcquireLeaseInput): Promise<AcquireLeaseResult>;
  release(input: ReleaseLeaseInput): Promise<ReleaseLeaseResult>;
  close(): Promise<void>;
}

