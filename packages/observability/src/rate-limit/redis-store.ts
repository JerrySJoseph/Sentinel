import type { RateLimitIncrementInput, RateLimitIncrementResult, RateLimitStore } from './types';

type RedisClientLike = {
  connect(): Promise<void>;
  quit(): Promise<void>;
  disconnect?: () => void;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
};

export type RateLimitLogger = {
  warn(msg: string, meta?: Record<string, unknown>): void;
};

export type CreateRedisRateLimitStoreOptions = {
  url: string;
  /**
   * Optional key prefix (e.g. "sentinel:rl:").
   */
  keyPrefix?: string;
  /**
   * Connection timeout for redis socket.
   */
  connectTimeoutMs?: number;
  /**
   * If true, store will degrade to "always allow" semantics (count=1) when Redis
   * is unreachable. This is useful for local dev; production should typically
   * keep this false.
   */
  suppressConnectionErrors?: boolean;
  logger?: RateLimitLogger;
  /**
   * Dependency injection hook for tests. In production, leave unset.
   */
  clientFactory?: (input: { url: string; connectTimeoutMs: number }) => RedisClientLike;
};

function defaultLogger(): RateLimitLogger {
  return { warn: () => undefined };
}

const INCR_WITH_TTL_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

export class RedisRateLimitStore implements RateLimitStore {
  readonly kind = 'redis';

  private readonly keyPrefix: string;
  private readonly logger: RateLimitLogger;
  private readonly suppressConnectionErrors: boolean;
  private readonly connectTimeoutMs: number;

  private client: RedisClientLike | null = null;
  private connectPromise: Promise<void> | null = null;
  private disabled = false;
  private loggedFailure = false;

  constructor(private readonly options: CreateRedisRateLimitStoreOptions) {
    this.keyPrefix = options.keyPrefix ?? '';
    this.logger = options.logger ?? defaultLogger();
    this.suppressConnectionErrors = options.suppressConnectionErrors ?? false;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 500;
  }

  async incrementWithTtl(input: RateLimitIncrementInput): Promise<RateLimitIncrementResult> {
    if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) {
      throw new Error('RedisRateLimitStore: ttlMs must be a positive number');
    }

    const now = Date.now();
    const key = this.keyPrefix + input.key;

    const c = await this.ensureConnected();
    if (!c) {
      // Degraded mode: "always allow" semantics without counting.
      return { count: 1, expiresAtMs: now + input.ttlMs };
    }

    const raw = await c.eval(INCR_WITH_TTL_LUA, {
      keys: [key],
      arguments: [String(Math.floor(input.ttlMs))],
    });

    // redis returns [count, ttlMs]
    if (!Array.isArray(raw) || raw.length < 2) {
      throw new Error('RedisRateLimitStore: unexpected eval result');
    }

    const count = Number(raw[0]);
    const ttlLeftMs = Number(raw[1]);
    const expiresAtMs = now + Math.max(0, ttlLeftMs);

    if (!Number.isFinite(count) || !Number.isFinite(expiresAtMs)) {
      throw new Error('RedisRateLimitStore: invalid eval result types');
    }

    return { count, expiresAtMs };
  }

  async close(): Promise<void> {
    try {
      if (!this.client) return;
      if (typeof this.client.disconnect === 'function' && !this.connectPromise) {
        this.client.disconnect();
        return;
      }
      await this.client.quit();
    } catch {
      // best-effort
    } finally {
      this.client = null;
      this.connectPromise = null;
      this.disabled = true;
    }
  }

  private warnOnce(msg: string, meta?: Record<string, unknown>) {
    if (this.loggedFailure) return;
    this.loggedFailure = true;
    this.logger.warn(msg, meta);
  }

  private createClient(): RedisClientLike {
    if (this.options.clientFactory) {
      return this.options.clientFactory({
        url: this.options.url,
        connectTimeoutMs: this.connectTimeoutMs,
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('redis') as typeof import('redis');
    return createClient({
      url: this.options.url,
      socket: { connectTimeout: this.connectTimeoutMs },
    }) as unknown as RedisClientLike;
  }

  private async ensureConnected(): Promise<RedisClientLike | null> {
    if (this.disabled) return null;

    if (!this.client) this.client = this.createClient();
    if (!this.connectPromise) this.connectPromise = this.client.connect();

    try {
      await this.connectPromise;
      return this.client;
    } catch (err) {
      this.connectPromise = null;
      if (!this.suppressConnectionErrors) throw err;
      this.disabled = true;
      this.warnOnce('redis_rate_limit_store_unavailable', {
        url: this.options.url,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}

export function createRedisRateLimitStore(
  options: CreateRedisRateLimitStoreOptions
): RedisRateLimitStore {
  return new RedisRateLimitStore(options);
}
