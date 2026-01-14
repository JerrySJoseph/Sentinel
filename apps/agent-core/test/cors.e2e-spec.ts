import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createCorsOptionsFromEnv } from '../src/common/cors';

describe('CORS (e2e)', () => {
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
    app.enableCors(createCorsOptionsFromEnv());
    await app.init();
    server = app.getHttpServer() as unknown as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows default local dev origin (http://localhost:3001)', async () => {
    await request(server)
      .get('/health')
      .set('Origin', 'http://localhost:3001')
      .expect(200)
      .expect(res => {
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3001');
      });
  });

  it('does not emit CORS headers for disallowed origin', async () => {
    await request(server)
      .get('/health')
      .set('Origin', 'http://evil.example')
      .expect(200)
      .expect(res => {
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
      });
  });
});
