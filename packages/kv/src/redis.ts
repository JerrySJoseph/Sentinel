import type { KvBackend, KvSetOptions } from './kv';

export type KvLogger = {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
};

type RedisClientLike = {
  connect(): Promise<void>;
  quit(): Promise<void>;
  disconnect?: () => void;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { PX?: number }): Promise<unknown>;
  del(key: string): Promise<number>;
};

export type CreateRedisKvBackendOptions = {
  url: string;
  /**
   * If Redis is unreachable, operations will degrade to safe defaults and a warning
   * will be logged once. This should generally be true in dev.
   */
  suppressConnectionErrors?: boolean;
  /**
   * Connection timeout for the underlying Redis client.
   */
  connectTimeoutMs?: number;
  logger?: KvLogger;
  /**
   * Dependency injection hook for tests. In production, leave unset.
   */
  clientFactory?: (input: { url: string; connectTimeoutMs: number }) => RedisClientLike;
};

function defaultLogger(): KvLogger {
  return {
    info: () => undefined,
    warn: () => undefined,
  };
}

export function createRedisKvBackend(options: CreateRedisKvBackendOptions): KvBackend {
  const logger = options.logger ?? defaultLogger();
  const suppressConnectionErrors = options.suppressConnectionErrors ?? true;
  const connectTimeoutMs = options.connectTimeoutMs ?? 250;

  let client: RedisClientLike | null = null;
  let connectPromise: Promise<void> | null = null;
  let disabled = false;
  let loggedConnectionFailure = false;

  const createClient = (): RedisClientLike => {
    if (options.clientFactory) {
      return options.clientFactory({ url: options.url, connectTimeoutMs });
    }
    // Lazy import to avoid paying cost when Redis is disabled.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('redis') as typeof import('redis');
    return createClient({
      url: options.url,
      socket: { connectTimeout: connectTimeoutMs },
    }) as unknown as RedisClientLike;
  };

  const warnOnce = (msg: string, meta?: Record<string, unknown>) => {
    if (loggedConnectionFailure) return;
    loggedConnectionFailure = true;
    logger.warn(msg, meta);
  };

  const ensureConnected = async (): Promise<RedisClientLike | null> => {
    if (disabled) return null;

    if (!client) client = createClient();

    if (!connectPromise) {
      connectPromise = client.connect();
    }

    try {
      await connectPromise;
      return client;
    } catch (err) {
      connectPromise = null;

      if (suppressConnectionErrors) {
        disabled = true;
        warnOnce('redis_unavailable_degrading_to_noop', {
          kind: 'redis',
          url: options.url,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
      throw err;
    }
  };

  return {
    kind: 'redis',
    async get(key: string): Promise<string | null> {
      const c = await ensureConnected();
      if (!c) return null;
      return await c.get(key);
    },
    async set(key: string, value: string, options?: KvSetOptions): Promise<void> {
      const c = await ensureConnected();
      if (!c) return;
      const ttlMs = options?.ttlMs;
      if (typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0) {
        await c.set(key, value, { PX: ttlMs });
      } else {
        await c.set(key, value);
      }
    },
    async del(key: string): Promise<number> {
      const c = await ensureConnected();
      if (!c) return 0;
      return await c.del(key);
    },
    async close(): Promise<void> {
      try {
        if (!client) return;
        // Prefer a non-blocking close when the client never successfully connected.
        if (typeof client.disconnect === 'function' && !connectPromise) {
          client.disconnect();
          return;
        }
        await client.quit();
      } catch {
        // best-effort
      } finally {
        client = null;
        connectPromise = null;
      }
    },
  };
}

