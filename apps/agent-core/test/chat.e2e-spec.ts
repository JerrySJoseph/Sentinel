import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('ChatController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/v1/chat (POST) should return stubbed ChatResponse', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/chat')
      .send({ message: 'hello' })
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        requestId: expect.any(String),
        sessionId: expect.any(String),
        latencyMs: expect.any(Number),
        finalResponse: expect.any(String),
        toolCalls: [],
        toolResults: [],
        trace: expect.any(Object),
      })
    );

    expect(res.body.requestId).toMatch(UUID_V4_REGEX);
    expect(res.body.sessionId).toMatch(UUID_V4_REGEX);
    expect(res.body.latencyMs).toBeGreaterThanOrEqual(0);

    expect(res.body.trace).toEqual(
      expect.objectContaining({
        requestId: res.body.requestId,
        sessionId: res.body.sessionId,
        steps: expect.any(Array),
      })
    );

    expect(res.body.trace.steps.length).toBeGreaterThanOrEqual(1);
  });

  it('/v1/chat (POST) invalid request should return 400 with structured error', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/chat')
      .send({ message: '' })
      .expect(400);

    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        issues: expect.any(Array),
      })
    );

    expect(res.body.issues.length).toBeGreaterThanOrEqual(1);
    expect(res.body.issues[0]).toEqual(
      expect.objectContaining({
        path: expect.any(String),
        message: expect.any(String),
        code: expect.any(String),
      })
    );
  });
});

