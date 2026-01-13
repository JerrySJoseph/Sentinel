import { createRedisKvBackend } from '../src/redis';

describe('@sentinel/kv redis', () => {
  it('degrades to safe defaults when connection fails and suppressConnectionErrors=true', async () => {
    const logs: Array<{ level: 'warn' | 'info'; msg: string }> = [];

    const kv = createRedisKvBackend({
      url: 'redis://127.0.0.1:6399',
      suppressConnectionErrors: true,
      logger: {
        info: (msg) => logs.push({ level: 'info', msg }),
        warn: (msg) => logs.push({ level: 'warn', msg }),
      },
      clientFactory: () => {
        return {
          async connect(): Promise<void> {
            throw new Error('connect failed');
          },
          async quit(): Promise<void> {
            // no-op
          },
          async get(): Promise<string | null> {
            return 'should_not_happen';
          },
          async set(): Promise<void> {
            // no-op
          },
          async del(): Promise<number> {
            return 123;
          },
        };
      },
    });

    await expect(kv.get('k')).resolves.toBeNull();
    await expect(kv.set('k', 'v')).resolves.toBeUndefined();
    await expect(kv.del('k')).resolves.toBe(0);

    expect(logs.filter((l) => l.level === 'warn').length).toBe(1);
    await kv.close();
  });
});

