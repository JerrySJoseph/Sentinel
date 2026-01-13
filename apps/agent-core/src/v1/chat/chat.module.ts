import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConcurrencyModule } from '../../concurrency/concurrency.module';
import { ConfigModule } from '../../config/config.module';
import { MetricsModule } from '../../metrics/metrics.module';

@Module({
  imports: [ConfigModule, ConcurrencyModule, MetricsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule { }

