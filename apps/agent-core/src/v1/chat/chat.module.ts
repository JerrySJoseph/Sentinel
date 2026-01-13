import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConcurrencyModule } from '../../concurrency/concurrency.module';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [ConfigModule, ConcurrencyModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule { }

