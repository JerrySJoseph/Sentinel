import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { runWithRequestContext } from '@sentinel/observability';

function parseTraceparent(header: string): { traceId: string; spanId: string } | null {
  // W3C traceparent: version-traceid-spanid-flags
  // Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
  const m = header.trim().match(/^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-[\da-f]{2}$/i);
  if (!m) return null;
  return { traceId: m[1], spanId: m[2] };
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();

    (req as Request & { requestId?: string }).requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const traceparent =
      typeof req.header('traceparent') === 'string' ? req.header('traceparent') : undefined;
    const parsed = traceparent ? parseTraceparent(traceparent) : null;

    const traceId =
      parsed?.traceId ??
      (typeof req.header('x-trace-id') === 'string' ? req.header('x-trace-id') : undefined);
    const spanId =
      parsed?.spanId ??
      (typeof req.header('x-span-id') === 'string' ? req.header('x-span-id') : undefined);

    if (traceId) res.setHeader('x-trace-id', traceId);
    if (spanId) res.setHeader('x-span-id', spanId);

    runWithRequestContext(
      {
        requestId,
        traceId: traceId || undefined,
        spanId: spanId || undefined,
      },
      () => next()
    );
  }
}
