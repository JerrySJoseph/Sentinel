import { Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import type { AgentCoreConfig } from '@sentinel/config';
import {
  createNoopKvBackend,
  createRedisKvBackend,
  type KvBackend,
  type KvLogger,
} from '@sentinel/kv';
import { AGENT_CORE_CONFIG, ConfigModule } from '../config/config.module';

export const KV_BACKEND = 'KV_BACKEND';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KV_BACKEND,
      useFactory: (cfg: AgentCoreConfig): KvBackend => {
        if (!cfg.redis.enabled || !cfg.redis.url) return createNoopKvBackend();
        const logger: KvLogger = {
          info: (msg: string, meta?: Record<string, unknown>) =>
            Logger.log(JSON.stringify({ msg, ...meta }), 'KV'),
          warn: (msg: string, meta?: Record<string, unknown>) =>
            Logger.warn(JSON.stringify({ msg, ...meta }), 'KV'),
        };
        return createRedisKvBackend({
          url: cfg.redis.url,
          suppressConnectionErrors: true,
          logger,
        });
      },
      inject: [AGENT_CORE_CONFIG],
    },
  ],
  exports: [KV_BACKEND],
})
export class KvModule implements OnModuleDestroy {
  constructor(@Inject(KV_BACKEND) private readonly kv: KvBackend) {
    Logger.log(JSON.stringify({ msg: 'kv_backend_initialized', kind: kv.kind }), 'KV');
  }

  async onModuleDestroy(): Promise<void> {
    await this.kv.close();
  }
}
