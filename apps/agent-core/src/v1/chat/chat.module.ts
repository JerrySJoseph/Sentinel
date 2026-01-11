import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { AgentService } from './chat.service';

@Module({
  controllers: [ChatController],
  providers: [AgentService],
})
export class ChatModule { }

