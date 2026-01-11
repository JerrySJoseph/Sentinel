import { randomUUID } from 'crypto';
import {
  chatResponseSchema,
  ChatResponse,
  PlanOutputSchema,
  ToolCall,
  toolCallSchema,
} from '@sentinel/contracts';
import { ProviderRegistry } from '@sentinel/providers';
import { MemoryPort } from './memory';

export type ToolPolicy = {
  mode: 'safe' | 'developer';
};

export type RunTurnInput = {
  sessionId?: string;
  message: string;
  provider?: string;
  toolPolicy: ToolPolicy;
};

export class Agent {
  constructor(
    private readonly deps: {
      providers: ProviderRegistry;
      memory: MemoryPort;
    }
  ) { }

  async runTurn(input: RunTurnInput): Promise<ChatResponse> {
    const startTimeMs = Date.now();
    const startedAt = new Date().toISOString();

    const requestId = randomUUID();
    const sessionId = input.sessionId ?? randomUUID();

    // Load history (stub memory for now), and pass it to the provider.
    const history = await this.deps.memory.loadHistory(sessionId);

    const provider = this.deps.providers.resolve(input.provider);

    const planUnknown = await provider.plan({
      request: { sessionId, message: input.message, history },
      options: { requestId, sessionId },
    });

    // Validate provider output is shape-correct (defense-in-depth).
    const plan = PlanOutputSchema.parse(planUnknown);

    // Validate tool call shapes too (even though we don't execute yet).
    const toolCalls: ToolCall[] = plan.toolCalls.map((tc) => toolCallSchema.parse(tc));

    const endedAt = new Date().toISOString();
    const latencyMs = Date.now() - startTimeMs;

    const response: ChatResponse = {
      requestId,
      sessionId,
      latencyMs,
      finalResponse: plan.finalResponse,
      toolCalls,
      toolResults: [],
      trace: plan.trace,
    };

    // Persist messages to memory (in-memory stub).
    await this.deps.memory.appendMessages(sessionId, [
      { role: 'user', content: input.message, createdAt: startedAt },
      { role: 'assistant', content: response.finalResponse, createdAt: endedAt },
    ]);

    return chatResponseSchema.parse(response);
  }
}

