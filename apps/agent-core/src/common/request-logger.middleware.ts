import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { getRequestContext } from '@sentinel/observability';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const ctx = getRequestContext();
      const requestId = ctx?.requestId ?? 'unknown';
      const idempotencyKey =
        typeof req.header('idempotency-key') === 'string'
          ? req.header('idempotency-key')
          : typeof req.header('x-idempotency-key') === 'string'
            ? req.header('x-idempotency-key')
            : undefined;

      this.logger.log(
        JSON.stringify({
          msg: 'request_completed',
          requestId,
          sessionId: ctx?.sessionId,
          traceId: ctx?.traceId,
          spanId: ctx?.spanId,
          idempotencyKey,
          method: req.method,
          path: req.originalUrl ?? req.url,
          statusCode: res.statusCode,
          durationMs,
        })
      );
    });

    next();
  }
}

