import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Redis unavailable (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://sentinel:sentinel@localhost:5433/sentinel_test?schema=public';

    // Point at a port that should be closed in CI/dev; app must still start.
    process.env.REDIS_URL = 'redis://127.0.0.1:6399';

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

  it('/health (GET) should still be OK', () => {
    return request(server)
      .get('/health')
      .expect(200)
      .expect(res => {
        expect(res.headers['x-request-id']).toEqual(expect.any(String));
        expect(res.body).toEqual({ status: 'ok' });
      });
  });
});
