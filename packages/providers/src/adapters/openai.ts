import { PlanOutputSchema } from '@sentinel/contracts';
import { MissingApiKeyError, ProviderDisabledInTestError, ProviderRegistryError } from '../errors';
import { PlanInput, ToggleableProvider } from '../types';

export type OpenAIProviderOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

export class OpenAIProvider implements ToggleableProvider {
  readonly name = 'openai';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'gpt-4o-mini';
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
  }

  static fromEnv(): OpenAIProvider {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new MissingApiKeyError('OPENAI_API_KEY');
    return new OpenAIProvider({ apiKey });
  }

  isEnabled(): boolean {
    if (process.env.NODE_ENV === 'test') return false;
    return Boolean(this.apiKey);
  }

  async plan(input: PlanInput) {
    if (process.env.NODE_ENV === 'test') throw new ProviderDisabledInTestError(this.name);
    if (!this.apiKey) throw new MissingApiKeyError('OPENAI_API_KEY');

    // Minimal, production-safe baseline: require model to output strict JSON matching PlanOutputSchema.
    const system = [
      'You are a planning model.',
      'Return ONLY valid JSON with this shape:',
      '{"toolCalls":[{"id":"uuid","name":"string","args":{}}],"finalResponse":"string","trace":{"requestId":"uuid","sessionId":"uuid?","steps":[]}}',
    ].join('\n');

    const user = `sessionId=${input.options.sessionId ?? ''}\nmessage=${input.request.message}`;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      throw new ProviderRegistryError(`OpenAI API error: ${res.status}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new ProviderRegistryError('OpenAI response missing content');

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ProviderRegistryError('OpenAI response was not valid JSON');
    }

    return PlanOutputSchema.parse(parsed);
  }
}
