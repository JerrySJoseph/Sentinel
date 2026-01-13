import { Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import type { AgentCoreConfig } from '@sentinel/config';
import { AGENT_CORE_CONFIG, ConfigModule } from '../config/config.module';
import {
  InMemoryRateLimitStore,
  RateLimiter,
  RedisRateLimitStore,
  type RateLimitStore,
} from '@sentinel/observability';
import { RateLimitGuard } from './rate-limit.guard';
import { RATE_LIMITER, RATE_LIMIT_STORE } from './rate-limit.constants';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      useFactory: (cfg: AgentCoreConfig): RateLimitStore => {
        const storeMode = cfg.rateLimit.store;
        const nodeEnv = cfg.nodeEnv ?? 'development';
        const shouldSuppressRedisErrors = nodeEnv !== 'production';

        const chooseMemory = () => new InMemoryRateLimitStore();
        const chooseRedis = () => {
          if (!cfg.redis.url) {
            throw new Error('RATE_LIMIT_STORE=redis requires REDIS_URL');
          }
          return new RedisRateLimitStore({
            url: cfg.redis.url,
            keyPrefix: 'sentinel:rl:',
            suppressConnectionErrors: shouldSuppressRedisErrors,
            logger: {
              warn: (msg, meta) => Logger.warn(JSON.stringify({ msg, ...meta }), 'RateLimit'),
            },
          });
        };

        if (storeMode === 'memory') return chooseMemory();
        if (storeMode === 'redis') return chooseRedis();

        // auto
        if (cfg.redis.enabled && cfg.redis.url) return chooseRedis();
        return chooseMemory();
      },
      inject: [AGENT_CORE_CONFIG],
    },
    {
      provide: RATE_LIMITER,
      useFactory: (store: RateLimitStore): RateLimiter => new RateLimiter(store),
      inject: [RATE_LIMIT_STORE],
    },
    RateLimitGuard,
  ],
  exports: [RateLimitGuard],
})
export class RateLimitModule implements OnModuleDestroy {
  constructor(
    @Inject(AGENT_CORE_CONFIG) cfg: AgentCoreConfig,
    @Inject(RATE_LIMIT_STORE) private readonly store: RateLimitStore
  ) {
    Logger.log(
      JSON.stringify({
        msg: 'rate_limit_initialized',
        enabled: cfg.rateLimit.enabled,
        store: cfg.rateLimit.store,
        limit: cfg.rateLimit.perIp.limit,
        windowMs: cfg.rateLimit.perIp.windowMs,
      }),
      'RateLimit'
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.store.close();
    } catch {
      // best-effort
    }
  }
}

