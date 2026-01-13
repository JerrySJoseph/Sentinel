import type {
  AcquireLeaseInput,
  AcquireLeaseResult,
  ConcurrencyStore,
  ReleaseLeaseInput,
  ReleaseLeaseResult,
} from './types';

type RedisClientLike = {
  connect(): Promise<void>;
  quit(): Promise<void>;
  disconnect?: () => void;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
};

export type ConcurrencyLogger = {
  warn(msg: string, meta?: Record<string, unknown>): void;
};

export type CreateRedisConcurrencyStoreOptions = {
  url: string;
  keyPrefix?: string;
  connectTimeoutMs?: number;
  /**
   * If true, Redis outages will not crash the process. The store will behave as if
   * it always acquires successfully (no concurrency protection).
   */
  suppressConnectionErrors?: boolean;
  logger?: ConcurrencyLogger;
  clientFactory?: (input: { url: string; connectTimeoutMs: number }) => RedisClientLike;
};

function defaultLogger(): ConcurrencyLogger {
  return { warn: () => undefined };
}

const ACQUIRE_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
local limit = tonumber(ARGV[2])
if count >= limit then
  local earliest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  if earliest[2] ~= nil then
    return {0, count, earliest[2]}
  end
  return {0, count, 0}
end
local expiresAt = tonumber(ARGV[1]) + tonumber(ARGV[3])
redis.call('ZADD', KEYS[1], expiresAt, ARGV[4])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[3]) + 1000)
return {1, count + 1, expiresAt}
`;

const RELEASE_LUA = `
local removed = redis.call('ZREM', KEYS[1], ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
return {removed, count}
`;

export class RedisConcurrencyStore implements ConcurrencyStore {
  readonly kind = 'redis';

  private readonly keyPrefix: string;
  private readonly logger: ConcurrencyLogger;
  private readonly suppressConnectionErrors: boolean;
  private readonly connectTimeoutMs: number;

  private client: RedisClientLike | null = null;
  private connectPromise: Promise<void> | null = null;
  private disabled = false;
  private loggedFailure = false;

  constructor(private readonly options: CreateRedisConcurrencyStoreOptions) {
    this.keyPrefix = options.keyPrefix ?? '';
    this.logger = options.logger ?? defaultLogger();
    this.suppressConnectionErrors = options.suppressConnectionErrors ?? false;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 500;
  }

  async tryAcquire(input: AcquireLeaseInput): Promise<AcquireLeaseResult> {
    if (!Number.isFinite(input.limit) || input.limit <= 0) {
      throw new Error('RedisConcurrencyStore: limit must be a positive number');
    }
    if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) {
      throw new Error('RedisConcurrencyStore: ttlMs must be a positive number');
    }

    const now = Date.now();
    const key = this.keyPrefix + input.key;

    const c = await this.ensureConnected();
    if (!c) {
      return { acquired: true, leaseId: input.leaseId, count: 1, expiresAtMs: now + input.ttlMs };
    }

    const raw = await c.eval(ACQUIRE_LUA, {
      keys: [key],
      arguments: [String(now), String(input.limit), String(Math.floor(input.ttlMs)), input.leaseId],
    });

    if (!Array.isArray(raw) || raw.length < 3) {
      throw new Error('RedisConcurrencyStore: unexpected eval result');
    }

    const acquired = Number(raw[0]) === 1;
    const count = Number(raw[1]);
    const score = Number(raw[2]); // expiresAt when acquired; earliest expiry when blocked

    if (acquired) {
      return {
        acquired: true,
        leaseId: input.leaseId,
        count,
        expiresAtMs: score,
      };
    }

    const retryAfterMs = Number.isFinite(score) && score > 0 ? Math.max(0, score - now) : undefined;
    return { acquired: false, leaseId: input.leaseId, count, retryAfterMs };
  }

  async release(input: ReleaseLeaseInput): Promise<ReleaseLeaseResult> {
    const key = this.keyPrefix + input.key;
    const c = await this.ensureConnected();
    if (!c) return { released: true, count: 0 };

    const raw = await c.eval(RELEASE_LUA, {
      keys: [key],
      arguments: [input.leaseId],
    });

    if (!Array.isArray(raw) || raw.length < 2) {
      throw new Error('RedisConcurrencyStore: unexpected release result');
    }

    return { released: Number(raw[0]) === 1, count: Number(raw[1]) };
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
      this.warnOnce('redis_concurrency_store_unavailable', {
        url: this.options.url,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}

