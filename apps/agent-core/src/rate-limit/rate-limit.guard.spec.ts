import { ExecutionContext, HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { InMemoryRateLimitStore, RateLimiter } from '@sentinel/observability';
import type { AgentCoreConfig } from '@sentinel/config';

function makeContext(input: {
  requestId?: string;
  ip?: string;
  headers?: Record<string, string>;
  trustProxy?: boolean;
}) {
  const req = {
    requestId: input.requestId,
    ip: input.ip,
    header: (name: string) => input.headers?.[name.toLowerCase()],
    socket: { remoteAddress: input.ip },
    app: { get: (k: string) => (k === 'trust proxy' ? Boolean(input.trustProxy) : undefined) },
  };
  const res = { setHeader: jest.fn() };

  const http = {
    getRequest: () => req,
    getResponse: () => res,
  };

  const ctx = {
    switchToHttp: () => http,
  } as unknown as ExecutionContext;

  return { ctx, req, res };
}

describe('RateLimitGuard', () => {
  it('returns 429 with structured body and requestId', async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = new RateLimiter(store);
    const cfg: AgentCoreConfig = {
      databaseUrl: 'postgresql://x',
      trustProxy: true,
      redis: { enabled: false },
      rateLimit: { enabled: true, perIp: { limit: 1, windowMs: 60_000 }, store: 'memory' },
      concurrency: { providerMax: 1, toolMax: 1, store: 'memory', leaseTtlMs: 10_000 },
    };

    // Construct guard without Nest DI for unit test.
    const guard = new RateLimitGuard(limiter, cfg);

    const { ctx } = makeContext({
      requestId: 'req-1',
      headers: { 'x-forwarded-for': '198.51.100.1' },
      trustProxy: true,
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    try {
      await guard.canActivate(ctx);
      throw new Error('expected guard to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const ex = err as HttpException;
      expect(ex.getStatus()).toBe(429);
      expect(ex.getResponse()).toEqual(
        expect.objectContaining({
          code: 'RATE_LIMITED',
          requestId: 'req-1',
        })
      );
    }
  });

  it('ignores x-forwarded-for when trust proxy is disabled (prevents spoofing)', async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = new RateLimiter(store);
    const cfg: AgentCoreConfig = {
      databaseUrl: 'postgresql://x',
      trustProxy: false,
      redis: { enabled: false },
      rateLimit: { enabled: true, perIp: { limit: 1, windowMs: 60_000 }, store: 'memory' },
      concurrency: { providerMax: 1, toolMax: 1, store: 'memory', leaseTtlMs: 10_000 },
    };

    const guard = new RateLimitGuard(limiter, cfg);

    const c1 = makeContext({
      requestId: 'req-1',
      ip: '10.0.0.1',
      headers: { 'x-forwarded-for': '198.51.100.1' },
      trustProxy: false,
    });
    await expect(guard.canActivate(c1.ctx)).resolves.toBe(true);

    // Same remote address, different spoofed header -> should still count against same key.
    const c2 = makeContext({
      requestId: 'req-2',
      ip: '10.0.0.1',
      headers: { 'x-forwarded-for': '198.51.100.2' },
      trustProxy: false,
    });
    await expect(guard.canActivate(c2.ctx)).rejects.toBeInstanceOf(HttpException);
  });

  it('uses x-forwarded-for when trust proxy is enabled', async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = new RateLimiter(store);
    const cfg: AgentCoreConfig = {
      databaseUrl: 'postgresql://x',
      trustProxy: true,
      redis: { enabled: false },
      rateLimit: { enabled: true, perIp: { limit: 1, windowMs: 60_000 }, store: 'memory' },
      concurrency: { providerMax: 1, toolMax: 1, store: 'memory', leaseTtlMs: 10_000 },
    };

    const guard = new RateLimitGuard(limiter, cfg);

    const c1 = makeContext({
      requestId: 'req-1',
      ip: '10.0.0.1',
      headers: { 'x-forwarded-for': '198.51.100.1' },
      trustProxy: true,
    });
    await expect(guard.canActivate(c1.ctx)).resolves.toBe(true);

    // Same remote address, different forwarded-for -> should be a different key when trusted.
    const c2 = makeContext({
      requestId: 'req-2',
      ip: '10.0.0.1',
      headers: { 'x-forwarded-for': '198.51.100.2' },
      trustProxy: true,
    });
    await expect(guard.canActivate(c2.ctx)).resolves.toBe(true);
  });
});
