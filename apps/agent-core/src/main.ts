import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createCorsOptionsFromEnv } from './common/cors';
import { loadAgentCoreConfig } from '@sentinel/config';

async function bootstrap(): Promise<void> {
  const cfg = loadAgentCoreConfig(process.env);
  const app = await NestFactory.create(AppModule);
  const httpServer = app.getHttpAdapter().getInstance() as unknown as {
    set: (key: string, value: unknown) => void;
  };
  httpServer.set('trust proxy', cfg.trustProxy);
  app.enableCors(createCorsOptionsFromEnv());
  const port = cfg.port ?? 3000;
  await app.listen(port);
}
bootstrap().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
