import { PlanOutputSchema } from '@sentinel/contracts';
import { ExampleProvider, ProviderRegistry, ProviderRegistryError } from '../src';

describe('ExampleProvider', () => {
  const prevEnv = process.env;

  beforeEach(() => {
    process.env = { ...prevEnv };
  });

  afterAll(() => {
    process.env = prevEnv;
  });

  it('returns deterministic, schema-valid PlanOutput', async () => {
    process.env.NODE_ENV = 'development';
    const provider = new ExampleProvider({ enabled: true });

    const out = await provider.plan({
      request: { message: 'hello' },
      options: {
        requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
        sessionId: '3fa85f64-5717-4562-b3fc-2c963f66afa9',
      },
    });

    expect(PlanOutputSchema.safeParse(out).success).toBe(true);
    expect(out.finalResponse).toBe('ExampleProvider: hello');
    expect(out.trace.requestId).toBe('3fa85f64-5717-4562-b3fc-2c963f66afa8');
  });

  it('is config-gated (disabled provider is rejected by ProviderRegistry)', () => {
    process.env.NODE_ENV = 'development';
    const registry = new ProviderRegistry();
    const disabled = new ExampleProvider({ enabled: false });

    expect(() => registry.register(disabled)).toThrow(ProviderRegistryError);
  });

  it('fromEnv enables based on EXAMPLE_PROVIDER_ENABLED=true', () => {
    process.env.NODE_ENV = 'development';
    process.env.EXAMPLE_PROVIDER_ENABLED = 'true';
    const provider = ExampleProvider.fromEnv();
    const registry = new ProviderRegistry();

    expect(() => registry.register(provider)).not.toThrow();
    expect(registry.has('example')).toBe(true);
  });
});

