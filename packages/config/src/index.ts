import { z } from 'zod';

export const sentinelConfig = {
  // Kept for backwards-compat with early smoke tests.
  version: 1,
};

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : value;
}

function stringToBoolean(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'y') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'n') return false;
  return value;
}

export const agentCoreEnvSchema = z.object({
  NODE_ENV: z
    .preprocess(emptyStringToUndefined, z.enum(['development', 'test', 'production']).optional())
    .optional(),
  PORT: z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().optional()),
  DATABASE_URL: z.string().min(1),
  TRUST_PROXY: z.preprocess(
    emptyStringToUndefined,
    z.preprocess(stringToBoolean, z.boolean().optional())
  ),
  CORS_ORIGINS: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  REDIS_URL: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  RATE_LIMIT_ENABLED: z.preprocess(
    emptyStringToUndefined,
    z.preprocess(stringToBoolean, z.boolean().optional())
  ),
  RATE_LIMIT_PER_IP_LIMIT: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().positive().optional()
  ),
  RATE_LIMIT_PER_IP_WINDOW_MS: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().positive().optional()
  ),
  RATE_LIMIT_STORE: z
    .preprocess(emptyStringToUndefined, z.enum(['auto', 'memory', 'redis']).optional())
    .optional(),
  PROVIDER_MAX_CONCURRENCY: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().positive().optional()
  ),
  TOOL_MAX_CONCURRENCY: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().positive().optional()
  ),
  CONCURRENCY_STORE: z
    .preprocess(emptyStringToUndefined, z.enum(['auto', 'memory', 'redis']).optional())
    .optional(),
  CONCURRENCY_LEASE_TTL_MS: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().positive().optional()
  ),
});

export type AgentCoreConfig = {
  nodeEnv?: 'development' | 'test' | 'production';
  port?: number;
  databaseUrl: string;
  trustProxy: boolean;
  corsOrigins?: string;
  redis: { enabled: boolean; url?: string };
  rateLimit: {
    enabled: boolean;
    perIp: { limit: number; windowMs: number };
    store: 'auto' | 'memory' | 'redis';
  };
  concurrency: {
    providerMax: number;
    toolMax: number;
    store: 'auto' | 'memory' | 'redis';
    leaseTtlMs: number;
  };
};

export function loadAgentCoreConfig(env: Record<string, unknown> = process.env): AgentCoreConfig {
  const parsed = agentCoreEnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `${i.path.join('.') || 'env'}: ${i.message}`)
      .join(', ');
    throw new Error(`Invalid agent-core environment: ${issues}`);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    trustProxy: parsed.data.TRUST_PROXY ?? false,
    corsOrigins: parsed.data.CORS_ORIGINS,
    redis: parsed.data.REDIS_URL
      ? { enabled: true, url: parsed.data.REDIS_URL }
      : { enabled: false },
    rateLimit: {
      enabled: parsed.data.RATE_LIMIT_ENABLED ?? true,
      perIp: {
        limit: parsed.data.RATE_LIMIT_PER_IP_LIMIT ?? 60,
        windowMs: parsed.data.RATE_LIMIT_PER_IP_WINDOW_MS ?? 60_000,
      },
      store: parsed.data.RATE_LIMIT_STORE ?? 'auto',
    },
    concurrency: {
      providerMax: parsed.data.PROVIDER_MAX_CONCURRENCY ?? 10,
      toolMax: parsed.data.TOOL_MAX_CONCURRENCY ?? 10,
      store: parsed.data.CONCURRENCY_STORE ?? 'auto',
      leaseTtlMs: parsed.data.CONCURRENCY_LEASE_TTL_MS ?? 30_000,
    },
  };
}
