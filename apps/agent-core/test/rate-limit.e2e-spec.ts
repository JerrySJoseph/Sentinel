import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 with structured body on limit exceeded', async () => {
    const ip = '203.0.113.10';

    await request(app.getHttpServer())
      .get('/health')
      .set('x-forwarded-for', ip)
      .expect(200);

    await request(app.getHttpServer())
      .get('/health')
      .set('x-forwarded-for', ip)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-forwarded-for', ip)
      .expect(429);

    expect(res.headers['x-request-id']).toEqual(expect.any(String));
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: expect.any(String),
        requestId: res.headers['x-request-id'],
      })
    );

    if (res.body.retryAfterMs !== undefined) {
      expect(res.body.retryAfterMs).toEqual(expect.any(Number));
      expect(res.body.retryAfterMs).toBeGreaterThanOrEqual(0);
    }
  });
});

