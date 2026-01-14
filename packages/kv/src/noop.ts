import type { KvBackend, KvSetOptions } from './kv';

export function createNoopKvBackend(): KvBackend {
  return {
    kind: 'noop',
    get(_key: string): Promise<string | null> {
      return Promise.resolve(null);
    },
    set(_key: string, _value: string, _options?: KvSetOptions): Promise<void> {
      // no-op
      return Promise.resolve();
    },
    del(_key: string): Promise<number> {
      return Promise.resolve(0);
    },
    close(): Promise<void> {
      // no-op
      return Promise.resolve();
    },
  };
}
