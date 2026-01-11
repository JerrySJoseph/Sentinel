import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { ChatModule } from './v1/chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [AppController, HealthController],
  providers: [AppService, HealthService],
})
export class AppModule { }
