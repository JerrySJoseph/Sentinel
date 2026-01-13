import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startNs = process.hrtime.bigint();

    res.on('finish', () => {
      const endNs = process.hrtime.bigint();
      const durationSeconds = Number(endNs - startNs) / 1e9;

      // Keep route label bounded: use matched route template when available.
      const routePath = (req as any)?.route?.path as string | undefined;
      const baseUrl = typeof (req as any)?.baseUrl === 'string' ? (req as any).baseUrl : '';
      const route = routePath ? `${baseUrl}${routePath}` : 'unknown';

      this.metrics.observeHttp({
        method: req.method,
        route,
        statusCode: res.statusCode,
        durationSeconds,
      });
    });

    next();
  }
}

