import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { chatRequestSchema } from '@sentinel/contracts';
import { ChatService } from './chat.service';

type ValidationIssue = {
  path: string;
  message: string;
  code: string;
};

@Controller('v1/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @Post()
  @HttpCode(200)
  async chat(@Body() body: unknown) {
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
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

    return await this.chatService.runTurn({
      sessionId: parsed.data.sessionId,
      message: parsed.data.message,
    });
  }
}

