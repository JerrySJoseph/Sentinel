import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { ChatModule } from './v1/chat/chat.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';

@Module({
  imports: [ChatModule],
  controllers: [AppController, HealthController],
  providers: [AppService, HealthService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, RequestLoggerMiddleware).forRoutes('*');
  }
}
