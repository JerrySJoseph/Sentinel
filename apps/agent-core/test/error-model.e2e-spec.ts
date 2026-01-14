import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ErrorResponseSchema } from '@sentinel/contracts';

describe('Error model normalization (e2e)', () => {
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

  it('normalizes provider errors', async () => {
    const res = await request(server).get('/__test__/errors/provider').expect(502);
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
    const body = ErrorResponseSchema.parse(res.body);
    expect(body.statusCode).toBe(502);
    expect(body.code).toBe('PROVIDER_ERROR');
    expect(typeof body.message).toBe('string');
    expect(body.requestId).toBe(res.headers['x-request-id']);
  });

  it('normalizes tool errors', async () => {
    const res = await request(server).get('/__test__/errors/tool').expect(500);
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
    const body = ErrorResponseSchema.parse(res.body);
    expect(body.statusCode).toBe(500);
    expect(body.code).toBe('TOOL_NOT_FOUND');
    expect(typeof body.message).toBe('string');
    expect(body.requestId).toBe(res.headers['x-request-id']);
  });
});
