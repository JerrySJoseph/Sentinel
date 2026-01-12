import { PlanOutputSchema } from '@sentinel/contracts';
import { MissingApiKeyError, ProviderDisabledInTestError, ProviderRegistryError } from '../errors';
import { PlanInput, ToggleableProvider } from '../types';

export type AnthropicProviderOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

export class AnthropicProvider implements ToggleableProvider {
  readonly name = 'anthropic';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: AnthropicProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'claude-3-5-sonnet-latest';
    this.baseUrl = options.baseUrl ?? 'https://api.anthropic.com/v1';
  }

  static fromEnv(): AnthropicProvider {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new MissingApiKeyError('ANTHROPIC_API_KEY');
    return new AnthropicProvider({ apiKey });
  }

  isEnabled(): boolean {
    if (process.env.NODE_ENV === 'test') return false;
    return Boolean(this.apiKey);
  }

  async plan(input: PlanInput) {
    if (process.env.NODE_ENV === 'test') throw new ProviderDisabledInTestError(this.name);
    if (!this.apiKey) throw new MissingApiKeyError('ANTHROPIC_API_KEY');

    const system = [
      'You are a planning model.',
      'Return ONLY valid JSON matching:',
      '{"toolCalls":[{"id":"uuid","name":"string","args":{}}],"finalResponse":"string","trace":{"requestId":"uuid","sessionId":"uuid?","steps":[]}}',
    ].join('\n');

    const user = `sessionId=${input.options.sessionId ?? ''}\nmessage=${input.request.message}`;

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) throw new ProviderRegistryError(`Anthropic API error: ${res.status}`);

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = json.content?.find((c) => c.type === 'text')?.text;
    if (!text) throw new ProviderRegistryError('Anthropic response missing text content');

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ProviderRegistryError('Anthropic response was not valid JSON');
    }

    return PlanOutputSchema.parse(parsed);
  }
}

