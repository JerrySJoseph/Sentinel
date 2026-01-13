import type { KvBackend, KvSetOptions } from './kv';

export function createNoopKvBackend(): KvBackend {
  return {
    kind: 'noop',
    async get(_key: string): Promise<string | null> {
      return null;
    },
    async set(_key: string, _value: string, _options?: KvSetOptions): Promise<void> {
      // no-op
    },
    async del(_key: string): Promise<number> {
      return 0;
    },
    async close(): Promise<void> {
      // no-op
    },
  };
}

