import { loadAgentCoreConfig, sentinelConfig } from '../src';

describe('@sentinel/config', () => {
  it('exports a config object', () => {
    expect(sentinelConfig).toEqual({ version: 1 });
  });

  it('loads agent-core config and gates redis when REDIS_URL is missing', () => {
    const cfg = loadAgentCoreConfig({
      DATABASE_URL: 'postgresql://sentinel:sentinel@localhost:5432/sentinel?schema=public',
      CORS_ORIGINS: 'http://localhost:3001',
    });

    expect(cfg.databaseUrl).toContain('postgresql://');
    expect(cfg.redis).toEqual({ enabled: false });
    expect(cfg.rateLimit.enabled).toBe(true);
    expect(cfg.rateLimit.perIp).toEqual({ limit: 60, windowMs: 60_000 });
    expect(cfg.concurrency).toEqual({
      providerMax: 10,
      toolMax: 10,
      store: 'auto',
      leaseTtlMs: 30_000,
    });
  });

  it('loads agent-core config with redis enabled when REDIS_URL is set', () => {
    const cfg = loadAgentCoreConfig({
      DATABASE_URL: 'postgresql://sentinel:sentinel@localhost:5432/sentinel?schema=public',
      REDIS_URL: 'redis://redis:6379',
    });

    expect(cfg.redis).toEqual({ enabled: true, url: 'redis://redis:6379' });
  });

  it('loads agent-core rate limit overrides from env', () => {
    const cfg = loadAgentCoreConfig({
      DATABASE_URL: 'postgresql://sentinel:sentinel@localhost:5432/sentinel?schema=public',
      RATE_LIMIT_ENABLED: 'false',
      RATE_LIMIT_PER_IP_LIMIT: '5',
      RATE_LIMIT_PER_IP_WINDOW_MS: '1234',
      RATE_LIMIT_STORE: 'memory',
    });

    expect(cfg.rateLimit).toEqual({
      enabled: false,
      perIp: { limit: 5, windowMs: 1234 },
      store: 'memory',
    });
  });

  it('loads agent-core concurrency overrides from env', () => {
    const cfg = loadAgentCoreConfig({
      DATABASE_URL: 'postgresql://sentinel:sentinel@localhost:5432/sentinel?schema=public',
      PROVIDER_MAX_CONCURRENCY: '3',
      TOOL_MAX_CONCURRENCY: '7',
      CONCURRENCY_STORE: 'memory',
      CONCURRENCY_LEASE_TTL_MS: '999',
    });

    expect(cfg.concurrency).toEqual({
      providerMax: 3,
      toolMax: 7,
      store: 'memory',
      leaseTtlMs: 999,
    });
  });
});

