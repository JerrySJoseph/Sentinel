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

const SESSION_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa1';

async function createApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

describe('Chat persistence (e2e)', () => {
  const prisma = createPrismaClient({ databaseUrl: TEST_DB_URL });
  const repo = new MemoryRepository(prisma);

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB_URL;
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

  it('continues a session across process restart and persists tool runs', async () => {
    // Turn 1 (process 1)
    const app1 = await createApp();
    const server1 = app1.getHttpServer() as unknown as Server;
    const res1 = await request(server1)
      .post('/v1/chat')
      .send({ sessionId: SESSION_ID, message: 'hello-1' })
      .expect(200);
    expect(res1.headers['x-request-id']).toEqual(expect.any(String));
    const body1 = ChatResponseSchema.parse(res1.body);
    expect(body1.requestId).toBe(res1.headers['x-request-id']);
    await app1.close();

    const messagesAfter1 = await repo.listMessages(SESSION_ID);
    const toolRunsAfter1 = await repo.listToolRuns(SESSION_ID);
    expect(messagesAfter1).toHaveLength(2); // user + assistant
    expect(toolRunsAfter1).toHaveLength(1);
    expect(toolRunsAfter1[0].name).toBe('calculator');

    // Turn 2 (process 2)
    const app2 = await createApp();
    const server2 = app2.getHttpServer() as unknown as Server;
    const res2 = await request(server2)
      .post('/v1/chat')
      .send({ sessionId: SESSION_ID, message: 'hello-2' })
      .expect(200);
    expect(res2.headers['x-request-id']).toEqual(expect.any(String));
    const body2 = ChatResponseSchema.parse(res2.body);
    expect(body2.requestId).toBe(res2.headers['x-request-id']);
    await app2.close();

    const messagesAfter2 = await repo.listMessages(SESSION_ID);
    const toolRunsAfter2 = await repo.listToolRuns(SESSION_ID);
    expect(messagesAfter2).toHaveLength(4);
    expect(toolRunsAfter2).toHaveLength(2);
    expect(toolRunsAfter2.every(tr => tr.name === 'calculator')).toBe(true);
  });
});
