import { InMemoryRateLimitStore, RateLimiter } from '../src';

describe('rate limiting', () => {
  describe('InMemoryRateLimitStore', () => {
    it('increments monotonically and sets expiry on first write (fixed window)', async () => {
      const store = new InMemoryRateLimitStore();
      const key = 'rl:test:fixed-window';

      const r1 = await store.incrementWithTtl({ key, ttlMs: 100 });
      const r2 = await store.incrementWithTtl({ key, ttlMs: 100 });
      const r3 = await store.incrementWithTtl({ key, ttlMs: 100 });

      expect(r1.count).toBe(1);
      expect(r2.count).toBe(2);
      expect(r3.count).toBe(3);

      // Expiry should not be extended by subsequent increments (fixed window).
      expect(r2.expiresAtMs).toBe(r1.expiresAtMs);
      expect(r3.expiresAtMs).toBe(r1.expiresAtMs);

      await store.close();
    });

    it('resets the counter after expiry', async () => {
      const store = new InMemoryRateLimitStore();
      const key = 'rl:test:expiry-reset';

      const r1 = await store.incrementWithTtl({ key, ttlMs: 20 });
      expect(r1.count).toBe(1);

      await new Promise(r => setTimeout(r, 30));

      const r2 = await store.incrementWithTtl({ key, ttlMs: 20 });
      expect(r2.count).toBe(1);
      expect(r2.expiresAtMs).toBeGreaterThan(r1.expiresAtMs);

      await store.close();
    });

    it('is race-safe under concurrent increments (no lost updates)', async () => {
      const store = new InMemoryRateLimitStore();
      const key = 'rl:test:concurrency';
      const ttlMs = 1000;

      const results = await Promise.all(
        Array.from({ length: 50 }, () => store.incrementWithTtl({ key, ttlMs }))
      );

      const counts = results.map(r => r.count).sort((a, b) => a - b);
      expect(counts[0]).toBe(1);
      expect(counts[counts.length - 1]).toBe(50);

      // Ensure we got exactly {1..50} once each.
      expect(counts).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));

      // All increments should share the same expiry (fixed window).
      const expires = new Set(results.map(r => r.expiresAtMs));
      expect(expires.size).toBe(1);

      await store.close();
    });
  });

  describe('RateLimiter', () => {
    it('enforces limit within a window and allows after reset', async () => {
      const store = new InMemoryRateLimitStore();
      const rl = new RateLimiter(store);
      const key = 'rl:test:limiter';

      const a1 = await rl.consume({ key, limit: 3, windowMs: 50 });
      const a2 = await rl.consume({ key, limit: 3, windowMs: 50 });
      const a3 = await rl.consume({ key, limit: 3, windowMs: 50 });
      const a4 = await rl.consume({ key, limit: 3, windowMs: 50 });

      expect(a1.allowed).toBe(true);
      expect(a2.allowed).toBe(true);
      expect(a3.allowed).toBe(true);
      expect(a4.allowed).toBe(false);
      expect(a4.remaining).toBe(0);
      expect(a4.retryAfterMs).toBeGreaterThanOrEqual(0);

      await new Promise(r => setTimeout(r, 60));

      const b1 = await rl.consume({ key, limit: 3, windowMs: 50 });
      expect(b1.allowed).toBe(true);
      expect(b1.count).toBe(1);

      await store.close();
    });
  });
});
