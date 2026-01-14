import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Metrics (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://sentinel:sentinel@localhost:5433/sentinel_test?schema=public';

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

  it('/metrics (GET) responds and contains expected metric names', async () => {
    // Generate some traffic so counters definitely show up.
    await request(server).get('/health').expect(200);
    await request(server).post('/v1/chat').send({ message: 'hello' }).expect(200);
    await request(server).post('/v1/chat').send({ message: '' }).expect(400);

    const res = await request(server).get('/metrics').expect(200);
    expect(typeof res.text).toBe('string');

    expect(res.text).toContain('sentinel_http_requests_total');
    expect(res.text).toContain('sentinel_http_request_duration_seconds');
    expect(res.text).toContain('sentinel_agent_turn_duration_seconds');
    expect(res.text).toContain('sentinel_provider_call_duration_seconds');
    expect(res.text).toContain('sentinel_tool_execution_duration_seconds');
    expect(res.text).toContain('sentinel_errors_total');
  });
});
