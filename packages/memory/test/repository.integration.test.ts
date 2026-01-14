import { execSync } from 'node:child_process';
import { createPrismaClient, MemoryRepository, MessageRole } from '../src';

function getTestDatabaseUrl(): string {
  const url =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://sentinel:sentinel@127.0.0.1:5433/sentinel_test?schema=public';

  // Safety: avoid accidentally running against a non-test DB.
  if (!url.includes('sentinel_test')) {
    throw new Error(
      `Refusing to run integration tests against non-test DB. Set TEST_DATABASE_URL to a *_test database. Got: ${url}`
    );
  }
  return url;
}

describe('MemoryRepository (integration)', () => {
  const databaseUrl = getTestDatabaseUrl();
  const prisma = createPrismaClient({ databaseUrl });
  const repo = new MemoryRepository(prisma);

  beforeAll(async () => {
    // Ensure migrations applied.
    execSync('pnpm --filter @sentinel/memory prisma:migrate:deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.toolRun.deleteMany();
    await prisma.message.deleteMany();
    await prisma.session.deleteMany();
  });

  it('persists sessions, messages, and tool runs', async () => {
    const session = await repo.createSession();

    await repo.createMessage({
      sessionId: session.id,
      role: MessageRole.user,
      content: 'hello',
    });
    await repo.createMessage({
      sessionId: session.id,
      role: MessageRole.assistant,
      content: 'hi there',
    });

    await repo.createToolRun({
      sessionId: session.id,
      toolCallId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      name: 'calculator',
      args: { expression: '1+2' },
      ok: true,
      result: 3,
      durationMs: 1,
    });

    const loadedSession = await repo.getSession(session.id);
    expect(loadedSession?.id).toBe(session.id);

    const messages = await repo.listMessages(session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe(MessageRole.user);
    expect(messages[1].role).toBe(MessageRole.assistant);

    const toolRuns = await repo.listToolRuns(session.id);
    expect(toolRuns).toHaveLength(1);
    expect(toolRuns[0].name).toBe('calculator');
    expect(toolRuns[0].ok).toBe(true);
    expect(toolRuns[0].result).toEqual(3);
  });

  it('enforces idempotency key uniqueness for tool_runs', async () => {
    const session = await repo.createSession();
    const toolCallId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    const created1 = await repo.createToolRunIdempotent({
      sessionId: session.id,
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
      idempotencyKey: 'idem-1',
      toolCallId,
      name: 'calculator',
      args: { expression: '1+2' },
      ok: true,
      result: 3,
    });

    const created2 = await repo.createToolRunIdempotent({
      sessionId: session.id,
      requestId: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
      idempotencyKey: 'idem-1',
      toolCallId,
      name: 'calculator',
      args: { expression: '1+2' },
      ok: true,
      result: 3,
    });

    expect(created2.id).toBe(created1.id);

    const runs = await repo.listToolRuns(session.id);
    expect(runs).toHaveLength(1);

    const found = await repo.findToolRunByIdempotency({
      sessionId: session.id,
      toolCallId,
      idempotencyKey: 'idem-1',
    });
    expect(found?.id).toBe(created1.id);
  });
});
