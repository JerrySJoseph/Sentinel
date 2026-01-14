import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ErrorResponseSchema } from '@sentinel/contracts';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://sentinel:sentinel@localhost:5433/sentinel_test?schema=public';

    // Deterministic rate limiting in tests (no Redis dependency).
    process.env.RATE_LIMIT_STORE = 'memory';
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.RATE_LIMIT_PER_IP_LIMIT = '2';
    process.env.RATE_LIMIT_PER_IP_WINDOW_MS = '60000';

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

  it('returns 429 with structured body on limit exceeded', async () => {
    const ip = '203.0.113.10';

    await request(server).get('/health').set('x-forwarded-for', ip).expect(200);

    await request(server).get('/health').set('x-forwarded-for', ip).expect(200);

    const res = await request(server).get('/health').set('x-forwarded-for', ip).expect(429);

    expect(res.headers['x-request-id']).toEqual(expect.any(String));
    const body = ErrorResponseSchema.parse(res.body);
    expect(body.statusCode).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(typeof body.message).toBe('string');
    expect(body.requestId).toBe(res.headers['x-request-id']);

    if (body.retryAfterMs !== undefined) {
      expect(typeof body.retryAfterMs).toBe('number');
      expect(body.retryAfterMs).toBeGreaterThanOrEqual(0);
    }
  });
});
