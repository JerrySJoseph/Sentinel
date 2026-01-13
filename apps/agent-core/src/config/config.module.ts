import { Module } from '@nestjs/common';
import { loadAgentCoreConfig } from '@sentinel/config';
import type { AgentCoreConfig } from '@sentinel/config';

export const AGENT_CORE_CONFIG = 'AGENT_CORE_CONFIG';

@Module({
  providers: [
    {
      provide: AGENT_CORE_CONFIG,
      useFactory: (): AgentCoreConfig => loadAgentCoreConfig(process.env),
    },
  ],
  exports: [AGENT_CORE_CONFIG],
})
export class ConfigModule {}

