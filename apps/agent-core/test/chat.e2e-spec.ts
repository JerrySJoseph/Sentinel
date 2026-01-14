import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ChatResponseSchema, ErrorResponseSchema } from '@sentinel/contracts';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('ChatController (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://sentinel:sentinel@127.0.0.1:5433/sentinel_test?schema=public';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as unknown as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/v1/chat (POST) should return stubbed ChatResponse', async () => {
    const res = await request(server).post('/v1/chat').send({ message: 'hello' }).expect(200);

    expect(res.headers['x-request-id']).toEqual(expect.any(String));
    const body = ChatResponseSchema.parse(res.body);

    expect(body.requestId).toMatch(UUID_V4_REGEX);
    expect(body.sessionId).toMatch(UUID_V4_REGEX);
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.finalResponse).toBe('MockProvider: hello');
    expect(body.requestId).toBe(res.headers['x-request-id']);

    expect(body.trace.requestId).toBe(body.requestId);
    expect(body.trace.sessionId).toBe(body.sessionId);

    expect(body.trace.steps.length).toBeGreaterThanOrEqual(1);
    expect(body.trace.steps[0]).toEqual(
      expect.objectContaining({
        kind: 'provider',
        name: 'mock.plan',
      })
    );

    expect(body.toolCalls.length).toBeGreaterThanOrEqual(1);
    expect(body.toolCalls[0].name).toBe('calculator');
    expect(typeof body.toolCalls[0].args['expression']).toBe('string');

    expect(body.toolResults.length).toBeGreaterThanOrEqual(1);
    expect(body.toolResults[0]).toEqual(
      expect.objectContaining({
        ok: true,
        name: 'calculator',
        result: 7,
      })
    );
  });

  it('/v1/chat (POST) invalid request should return 400 with structured error', async () => {
    const res = await request(server).post('/v1/chat').send({ message: '' }).expect(400);

    expect(res.headers['x-request-id']).toEqual(expect.any(String));
    const body = ErrorResponseSchema.parse(res.body);
    expect(body.statusCode).toBe(400);
    expect(body.code).toBe('INVALID_INPUT');
    expect(body.message).toBe('Invalid request body');
    expect(body.requestId).toBe(res.headers['x-request-id']);
    expect(Array.isArray(body.issues)).toBe(true);

    expect(body.issues?.length).toBeGreaterThanOrEqual(1);
    expect(typeof body.issues?.[0]?.path).toBe('string');
    expect(typeof body.issues?.[0]?.message).toBe('string');
    expect(typeof body.issues?.[0]?.code).toBe('string');
  });
});
