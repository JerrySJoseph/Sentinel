import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Error model normalization (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://sentinel:sentinel@localhost:5433/sentinel_test?schema=public';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('normalizes provider errors', async () => {
    const res = await request(app.getHttpServer()).get('/__test__/errors/provider').expect(502);
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 502,
        code: 'PROVIDER_ERROR',
        message: expect.any(String),
        requestId: res.headers['x-request-id'],
      })
    );
  });

  it('normalizes tool errors', async () => {
    const res = await request(app.getHttpServer()).get('/__test__/errors/tool').expect(500);
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 500,
        code: 'TOOL_NOT_FOUND',
        message: expect.any(String),
        requestId: res.headers['x-request-id'],
      })
    );
  });
});

