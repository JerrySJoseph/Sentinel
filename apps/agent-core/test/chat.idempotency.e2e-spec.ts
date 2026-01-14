import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createPrismaClient, MemoryRepository } from '@sentinel/memory';
import { ChatResponseSchema } from '@sentinel/contracts';

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://sentinel:sentinel@127.0.0.1:5433/sentinel_test?schema=public';

const SESSION_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa2';

describe('Chat idempotency (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const prisma = createPrismaClient({ databaseUrl: TEST_DB_URL });
  const repo = new MemoryRepository(prisma);

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB_URL;
    await prisma.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as unknown as Server;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.toolRun.deleteMany();
    await prisma.message.deleteMany();
    await prisma.session.deleteMany();
  });

  it('does not duplicate tool_runs when idempotency-key is reused', async () => {
    const idempotencyKey = 'idem-abc';

    const res1 = await request(server)
      .post('/v1/chat')
      .set('idempotency-key', idempotencyKey)
      .send({ sessionId: SESSION_ID, message: 'retry-me' })
      .expect(200);
    const body1 = ChatResponseSchema.parse(res1.body);

    const runsAfter1 = await repo.listToolRuns(SESSION_ID);
    expect(runsAfter1).toHaveLength(1);

    const res2 = await request(server)
      .post('/v1/chat')
      .set('idempotency-key', idempotencyKey)
      .send({ sessionId: SESSION_ID, message: 'retry-me' })
      .expect(200);
    const body2 = ChatResponseSchema.parse(res2.body);

    const runsAfter2 = await repo.listToolRuns(SESSION_ID);
    expect(runsAfter2).toHaveLength(1);

    // Second response should indicate reuse in tool trace step.
    const toolSteps2 = body2.trace.steps.filter(s => s.kind === 'tool');
    expect(toolSteps2.length).toBeGreaterThanOrEqual(1);
    expect(toolSteps2[0].input).toEqual(expect.objectContaining({ reused: true }));

    expect(body1.toolResults[0].result).toBe(7);
    expect(body2.toolResults[0].result).toBe(7);
  });
});
