import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { KvModule } from './kv/kv.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { ChatModule } from './v1/chat/chat.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { SentinelExceptionFilter } from './common/sentinel-exception.filter';
import { TestSupportModule } from './test-support/test-support.module';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';

@Module({
  imports: [MetricsModule, ChatModule, KvModule, RateLimitModule, TestSupportModule.forRoot()],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    HealthService,
    {
      provide: APP_FILTER,
      useClass: SentinelExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useExisting: RateLimitGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, MetricsMiddleware, RequestLoggerMiddleware).forRoutes('*');
  }
}
