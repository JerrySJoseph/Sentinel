import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AgentCoreConfig } from '@sentinel/config';
import type { RateLimiter } from '@sentinel/observability';
import { AGENT_CORE_CONFIG } from '../config/config.module';
import { RATE_LIMITER } from './rate-limit.constants';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(AGENT_CORE_CONFIG) private readonly config: AgentCoreConfig
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.rateLimit.enabled) return true;

    const req = context.switchToHttp().getRequest<Request & { requestId?: string }>();

    const ip = this.getClientIp(req);
    const key = `rl:ip:${ip}`;

    const decision = await this.limiter.consume({
      key,
      limit: this.config.rateLimit.perIp.limit,
      windowMs: this.config.rateLimit.perIp.windowMs,
    });

    if (decision.allowed) return true;

    const requestId = req.requestId ?? 'unknown';

    // Best-effort retry-after header in seconds (common convention).
    const res = context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>();
    if (Number.isFinite(decision.retryAfterMs) && decision.retryAfterMs > 0) {
      res.setHeader('retry-after', String(Math.ceil(decision.retryAfterMs / 1000)));
    }

    throw new HttpException(
      {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        requestId,
        retryAfterMs: decision.retryAfterMs > 0 ? decision.retryAfterMs : undefined,
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private getClientIp(req: Request): string {
    const xff = req.header('x-forwarded-for');
    if (typeof xff === 'string' && xff.trim().length > 0) {
      return xff.split(',')[0].trim();
    }
    // Express computes req.ip (may be "::ffff:127.0.0.1" locally)
    if (typeof req.ip === 'string' && req.ip.length > 0) return req.ip;
    const ra = req.socket?.remoteAddress;
    return typeof ra === 'string' && ra.length > 0 ? ra : 'unknown';
  }
}

