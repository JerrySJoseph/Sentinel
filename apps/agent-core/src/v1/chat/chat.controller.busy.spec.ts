import { Test } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AgentBusyError } from '@sentinel/agent';
import type { Request } from 'express';

describe('ChatController (busy errors)', () => {
  it('maps PROVIDER_BUSY to 503 structured error with requestId', async () => {
    const chatService = {
      runTurn: async () => {
        throw new AgentBusyError({ code: 'PROVIDER_BUSY', message: 'Provider is at capacity', retryAfterMs: 123 });
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: chatService }],
    }).compile();

    const controller = moduleRef.get(ChatController);

    const req = {
      header: () => undefined,
      requestId: 'req-1',
    } as unknown as Request;

    await expect(controller.chat(req, { message: 'hello' })).rejects.toMatchObject({
      status: 503,
      response: {
        code: 'PROVIDER_BUSY',
        message: 'Provider is at capacity',
        requestId: 'req-1',
        retryAfterMs: 123,
      },
    });
  });
});

