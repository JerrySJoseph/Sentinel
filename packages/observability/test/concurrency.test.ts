import { ConcurrencyLimiter, InMemoryConcurrencyStore } from '../src';

describe('concurrency limiter', () => {
  it('acquires up to limit and rejects overflow; release frees capacity', async () => {
    const store = new InMemoryConcurrencyStore();
    const limiter = new ConcurrencyLimiter(store, {
      key: 'conc:test',
      limit: 2,
      leaseTtlMs: 10_000,
    });

    const a1 = await limiter.tryAcquire();
    const a2 = await limiter.tryAcquire();
    const a3 = await limiter.tryAcquire();

    expect(a1.acquired).toBe(true);
    expect(a2.acquired).toBe(true);
    expect(a3.acquired).toBe(false);

    await limiter.release({ leaseId: a1.leaseId, expiresAtMs: a1.expiresAtMs! });
    const a4 = await limiter.tryAcquire();
    expect(a4.acquired).toBe(true);
  });

  it('is race-safe: concurrent acquires never exceed limit', async () => {
    const store = new InMemoryConcurrencyStore();
    const limiter = new ConcurrencyLimiter(store, {
      key: 'conc:race',
      limit: 3,
      leaseTtlMs: 10_000,
    });

    const results = await Promise.all(Array.from({ length: 20 }, () => limiter.tryAcquire()));
    const acquired = results.filter(r => r.acquired);
    const rejected = results.filter(r => !r.acquired);

    expect(acquired).toHaveLength(3);
    expect(rejected).toHaveLength(17);

    // release and ensure capacity returns
    await Promise.all(
      acquired.map(r => limiter.release({ leaseId: r.leaseId, expiresAtMs: r.expiresAtMs! }))
    );
    const again = await limiter.tryAcquire();
    expect(again.acquired).toBe(true);
  });
});
