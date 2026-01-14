import { Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import type { AgentCoreConfig } from '@sentinel/config';
import { AGENT_CORE_CONFIG, ConfigModule } from '../config/config.module';
import {
  ConcurrencyLimiter,
  InMemoryConcurrencyStore,
  RedisConcurrencyStore,
  type ConcurrencyStore,
} from '@sentinel/observability';
import {
  CONCURRENCY_STORE,
  PROVIDER_CONCURRENCY_LIMITER,
  TOOL_CONCURRENCY_LIMITER,
} from './concurrency.constants';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CONCURRENCY_STORE,
      useFactory: (cfg: AgentCoreConfig): ConcurrencyStore => {
        const mode = cfg.concurrency.store;
        const nodeEnv = cfg.nodeEnv ?? 'development';

        // Always deterministic for tests.
        if (nodeEnv === 'test') return new InMemoryConcurrencyStore();

        const chooseMemory = () => new InMemoryConcurrencyStore();
        const chooseRedis = () => {
          if (!cfg.redis.url) throw new Error('CONCURRENCY_STORE=redis requires REDIS_URL');
          return new RedisConcurrencyStore({
            url: cfg.redis.url,
            keyPrefix: 'sentinel:conc:',
            suppressConnectionErrors: nodeEnv !== 'production',
            logger: {
              warn: (msg, meta) => Logger.warn(JSON.stringify({ msg, ...meta }), 'Concurrency'),
            },
          });
        };

        if (mode === 'memory') return chooseMemory();
        if (mode === 'redis') return chooseRedis();

        // auto
        if (cfg.redis.enabled && cfg.redis.url) return chooseRedis();
        return chooseMemory();
      },
      inject: [AGENT_CORE_CONFIG],
    },
    {
      provide: PROVIDER_CONCURRENCY_LIMITER,
      useFactory: (cfg: AgentCoreConfig, store: ConcurrencyStore): ConcurrencyLimiter =>
        new ConcurrencyLimiter(store, {
          key: 'provider',
          limit: cfg.concurrency.providerMax,
          leaseTtlMs: cfg.concurrency.leaseTtlMs,
        }),
      inject: [AGENT_CORE_CONFIG, CONCURRENCY_STORE],
    },
    {
      provide: TOOL_CONCURRENCY_LIMITER,
      useFactory: (cfg: AgentCoreConfig, store: ConcurrencyStore): ConcurrencyLimiter =>
        new ConcurrencyLimiter(store, {
          key: 'tool',
          limit: cfg.concurrency.toolMax,
          leaseTtlMs: cfg.concurrency.leaseTtlMs,
        }),
      inject: [AGENT_CORE_CONFIG, CONCURRENCY_STORE],
    },
  ],
  exports: [PROVIDER_CONCURRENCY_LIMITER, TOOL_CONCURRENCY_LIMITER],
})
export class ConcurrencyModule implements OnModuleDestroy {
  constructor(@Inject(CONCURRENCY_STORE) private readonly store: ConcurrencyStore) {
    Logger.log(
      JSON.stringify({ msg: 'concurrency_module_loaded', kind: store.kind }),
      'Concurrency'
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.close();
  }
}
