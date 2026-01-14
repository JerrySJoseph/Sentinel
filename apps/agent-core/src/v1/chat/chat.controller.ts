import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { chatRequestSchema } from '@sentinel/contracts';
import { ChatService } from './chat.service';
import type { Request } from 'express';
import { AgentBusyError } from '@sentinel/agent';
import { setRequestContext } from '@sentinel/observability';

type ValidationIssue = {
  path: string;
  message: string;
  code: string;
};

@Controller('v1/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(200)
  async chat(@Req() req: Request, @Body() body: unknown) {
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issues: ValidationIssue[] = parsed.error.issues.map(issue => ({
        path: issue.path.length ? issue.path.join('.') : '(root)',
        message: issue.message,
        code: issue.code,
      }));

      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        issues,
      });
    }

    const idempotencyKey =
      req.header('idempotency-key')?.toString() ?? req.header('x-idempotency-key')?.toString();

    const requestId = (req as Request & { requestId?: string }).requestId;
    if (parsed.data.sessionId) {
      setRequestContext({ sessionId: parsed.data.sessionId });
    }

    try {
      return await this.chatService.runTurn({
        requestId,
        idempotencyKey,
        sessionId: parsed.data.sessionId,
        message: parsed.data.message,
      });
    } catch (err) {
      if (err instanceof AgentBusyError) {
        throw new ServiceUnavailableException({
          code: err.code,
          message: err.message,
          requestId: requestId ?? 'unknown',
          retryAfterMs: err.retryAfterMs,
        });
      }
      throw err;
    }
  }
}
