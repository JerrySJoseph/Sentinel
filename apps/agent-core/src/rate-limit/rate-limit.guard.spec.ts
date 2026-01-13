import { ExecutionContext, HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { InMemoryRateLimitStore, RateLimiter } from '@sentinel/observability';
import type { AgentCoreConfig } from '@sentinel/config';

function makeContext(input: {
  requestId?: string;
  ip?: string;
  headers?: Record<string, string>;
}) {
  const req = {
    requestId: input.requestId,
    ip: input.ip,
    header: (name: string) => input.headers?.[name.toLowerCase()],
    socket: { remoteAddress: input.ip },
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
      redis: { enabled: false },
      rateLimit: { enabled: true, perIp: { limit: 1, windowMs: 60_000 }, store: 'memory' },
      concurrency: { providerMax: 1, toolMax: 1, store: 'memory', leaseTtlMs: 10_000 },
    };

    // Construct guard without Nest DI for unit test.
    const guard = new RateLimitGuard(limiter, cfg);

    const { ctx } = makeContext({
      requestId: 'req-1',
      headers: { 'x-forwarded-for': '198.51.100.1' },
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
});

