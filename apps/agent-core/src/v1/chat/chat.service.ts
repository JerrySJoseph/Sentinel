import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChatRequest, ChatResponse, chatResponseSchema } from '@sentinel/contracts';

@Injectable()
export class ChatService {
  handleChat(request: ChatRequest): ChatResponse {
    const startTimeMs = Date.now();
    const startedAt = new Date().toISOString();

    const requestId = randomUUID();
    const sessionId = request.sessionId ?? randomUUID();

    const finalResponse = `Stubbed response: ${request.message}`;

    const endedAt = new Date().toISOString();
    const latencyMs = Date.now() - startTimeMs;

    const response: ChatResponse = {
      requestId,
      sessionId,
      latencyMs,
      finalResponse,
      toolCalls: [],
      toolResults: [],
      trace: {
        requestId,
        sessionId,
        steps: [
          {
            id: randomUUID(),
            kind: 'final',
            name: 'stub-response',
            startedAt,
            endedAt,
            durationMs: latencyMs,
            input: { message: request.message },
            output: { finalResponse },
          },
        ],
      },
    };

    // Ensure our stub stays contract-correct as schemas evolve.
    return chatResponseSchema.parse(response);
  }
}

