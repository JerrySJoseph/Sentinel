import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createCorsOptionsFromEnv } from './common/cors';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors(createCorsOptionsFromEnv());
  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
