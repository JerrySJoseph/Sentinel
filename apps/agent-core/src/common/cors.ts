import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const DEFAULT_CORS_ORIGINS = ['http://localhost:3001'] as const;

function parseCorsOrigins(input: string | undefined | null): string[] {
  const raw = (input ?? '').trim();
  if (raw.length === 0) return [...DEFAULT_CORS_ORIGINS];

  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return origins.length > 0 ? origins : [...DEFAULT_CORS_ORIGINS];
}

/**
 * CORS allowlist config for agent-core.
 *
 * Env:
 * - CORS_ORIGINS: comma-separated list of allowed origins (e.g. "http://localhost:3001,https://example.com")
 *
 * Behavior:
 * - Requests with no Origin header are allowed (non-browser / same-origin cases).
 * - Requests with an Origin not in the allowlist receive no CORS headers (browser will block).
 */
export function createCorsOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CorsOptions {
  const allowlist = new Set(parseCorsOrigins(env.CORS_ORIGINS));

  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, allowlist.has(origin));
    },
  };
}


