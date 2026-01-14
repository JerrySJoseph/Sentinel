import { PrismaClient, MessageRole, Session, Message, ToolRun, Prisma } from '@prisma/client';

export type CreateSessionInput = {
  id?: string;
};

export type CreateMessageInput = {
  sessionId: string;
  role: MessageRole;
  content: string;
  toolCallId?: string;
  createdAt?: Date;
};

export type CreateToolRunInput = {
  sessionId: string;
  toolCallId: string;
  requestId?: string;
  idempotencyKey?: string;
  name: string;
  args: Prisma.InputJsonValue;
  ok: boolean;
  result?: Prisma.InputJsonValue;
  error?: Prisma.InputJsonValue;
  startedAt?: Date;
  endedAt?: Date;
  durationMs?: number;
  truncated?: boolean;
};

export class MemoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureSession(sessionId: string): Promise<Session> {
    return await this.prisma.session.upsert({
      where: { id: sessionId },
      create: { id: sessionId },
      update: {},
    });
  }

  async createSession(input: CreateSessionInput = {}): Promise<Session> {
    return await this.prisma.session.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
      },
    });
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
  }

  async listSessions(limit = 50): Promise<Session[]> {
    return await this.prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    return await this.prisma.message.create({
      data: {
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        toolCallId: input.toolCallId,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
    });
  }

  async listMessages(sessionId: string): Promise<Message[]> {
    return await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createToolRun(input: CreateToolRunInput): Promise<ToolRun> {
    return await this.prisma.toolRun.create({
      data: {
        sessionId: input.sessionId,
        toolCallId: input.toolCallId,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
        name: input.name,
        args: input.args,
        ok: input.ok,
        result: input.result,
        error: input.error,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        durationMs: input.durationMs,
        truncated: input.truncated,
      },
    });
  }

  async findToolRunByIdempotency(input: {
    sessionId: string;
    toolCallId: string;
    idempotencyKey: string;
  }): Promise<ToolRun | null> {
    return await this.prisma.toolRun.findFirst({
      where: {
        sessionId: input.sessionId,
        toolCallId: input.toolCallId,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  async createToolRunIdempotent(
    input: CreateToolRunInput & { idempotencyKey: string }
  ): Promise<ToolRun> {
    try {
      return await this.createToolRun(input);
    } catch (err) {
      // If we hit the unique constraint, return the existing run.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.findToolRunByIdempotency({
          sessionId: input.sessionId,
          toolCallId: input.toolCallId,
          idempotencyKey: input.idempotencyKey,
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  async listToolRuns(sessionId: string): Promise<ToolRun[]> {
    return await this.prisma.toolRun.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
