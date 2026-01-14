import {
  AnthropicProvider,
  MissingApiKeyError,
  OpenAIProvider,
  ProviderDisabledInTestError,
  ProviderRegistry,
} from '../src';

describe('Provider adapters (env-gated)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('OpenAIProvider.fromEnv throws when missing key', () => {
    expect(() => OpenAIProvider.fromEnv()).toThrow(MissingApiKeyError);
  });

  it('AnthropicProvider.fromEnv throws when missing key', () => {
    expect(() => AnthropicProvider.fromEnv()).toThrow(MissingApiKeyError);
  });

  it('providers are disabled in tests (even if key exists)', async () => {
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test';

    const p = new OpenAIProvider({ apiKey: 'test' });
    expect(p.isEnabled()).toBe(false);
    await expect(
      p.plan({
        request: { message: 'hi' },
        options: { requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
      })
    ).rejects.toThrow(ProviderDisabledInTestError);
  });

  it('registry refuses to register disabled adapter', () => {
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test';

    const registry = new ProviderRegistry();
    expect(() => registry.register(new OpenAIProvider({ apiKey: 'test' }))).toThrow();
  });
});
