import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  ErrorResponseSchema,
  type ErrorIssue,
  type ErrorResponse,
  type SentinelErrorCode,
  type JsonValue,
  jsonValueSchema,
} from '@sentinel/contracts';
import { ProviderConfigError, ProviderNotFoundError, ProviderRegistryError } from '@sentinel/providers';
import { ToolNotFoundError, ToolPolicyError, ToolUserError } from '@sentinel/tools';
import { AgentBusyError } from '@sentinel/agent';
import { MetricsService } from '../metrics/metrics.service';

function asRequestId(req: Request): string {
  const rid = (req as Request & { requestId?: string }).requestId;
  return typeof rid === 'string' && rid.length > 0 ? rid : randomUUID();
}

function toIssuesFromUnknown(input: unknown): ErrorIssue[] | undefined {
  if (!input || typeof input !== 'object') return undefined;
  if (!('issues' in input)) return undefined;
  const issues = (input as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return undefined;

  const out: ErrorIssue[] = [];
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') continue;
    const rec = issue as Record<string, unknown>;
    const path = typeof rec.path === 'string' ? rec.path : undefined;
    const message = typeof rec.message === 'string' ? rec.message : undefined;
    const code = typeof rec.code === 'string' ? rec.code : undefined;
    if (path && message) out.push({ path, message, code });
  }
  return out.length ? out : undefined;
}

function normalizeCode(input: { statusCode: number; rawCode?: string }): SentinelErrorCode {
  if (input.rawCode === 'VALIDATION_ERROR') return 'INVALID_INPUT';
  if (input.rawCode && ErrorResponseSchema.shape.code.safeParse(input.rawCode).success) {
    return input.rawCode as SentinelErrorCode;
  }
  if (input.statusCode === HttpStatus.BAD_REQUEST) return 'INVALID_INPUT';
  if (input.statusCode === HttpStatus.TOO_MANY_REQUESTS) return 'RATE_LIMITED';
  return 'INTERNAL_ERROR';
}

function isZodErrorLike(err: unknown): err is { issues: unknown[] } {
  if (!err || typeof err !== 'object') return false;
  const rec = err as Record<string, unknown>;
  if (rec.name !== 'ZodError') return false;
  if (!Array.isArray(rec.issues)) return false;
  return true;
}

@Catch()
@Injectable()
export class SentinelExceptionFilter implements ExceptionFilter {
  constructor(private readonly metrics: MetricsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const requestId = asRequestId(req);

    // Default values.
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: SentinelErrorCode = 'INTERNAL_ERROR';
    let message = 'Internal error';
    let retryAfterMs: number | undefined;
    let issues: ErrorIssue[] | undefined;
    let details: JsonValue | undefined;

    if (exception instanceof AgentBusyError) {
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      code = exception.code as SentinelErrorCode;
      message = exception.message;
      retryAfterMs = exception.retryAfterMs;
    } else if (
      exception instanceof ProviderNotFoundError ||
      exception instanceof ProviderRegistryError ||
      exception instanceof ProviderConfigError
    ) {
      statusCode = HttpStatus.BAD_GATEWAY;
      code = 'PROVIDER_ERROR';
      message = exception.message || 'Provider error';
    } else if (exception instanceof ToolNotFoundError) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'TOOL_NOT_FOUND';
      message = exception.message || 'Tool not found';
    } else if (exception instanceof ToolPolicyError) {
      statusCode = HttpStatus.FORBIDDEN;
      code = 'POLICY_DENIED';
      message = exception.message || 'Tool policy denied';
    } else if (exception instanceof ToolUserError) {
      statusCode = HttpStatus.BAD_REQUEST;
      // Preserve user-facing codes, but normalize to TOOL_* when possible.
      code = (String(exception.code).startsWith('TOOL_')
        ? (exception.code as SentinelErrorCode)
        : ('INVALID_INPUT' as SentinelErrorCode)) as SentinelErrorCode;
      message = exception.message || 'Invalid tool input';
      details = exception.details;
    } else if (isZodErrorLike(exception)) {
      statusCode = HttpStatus.BAD_GATEWAY;
      code = 'INVALID_PLAN';
      message = 'Invalid provider plan';
      const outIssues: ErrorIssue[] = [];
      for (const rawIssue of exception.issues) {
        if (!rawIssue || typeof rawIssue !== 'object') continue;
        const rec = rawIssue as Record<string, unknown>;
        const pathParts = Array.isArray(rec.path) ? rec.path.map((p) => String(p)) : [];
        const path = pathParts.length ? pathParts.join('.') : '(root)';
        const msg = typeof rec.message === 'string' ? rec.message : 'Invalid';
        const c = typeof rec.code === 'string' ? rec.code : undefined;
        outIssues.push({ path, message: msg, code: c });
      }
      issues = outIssues.length ? outIssues : undefined;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const raw = exception.getResponse();

      let rawObj: Record<string, unknown> | undefined;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) rawObj = raw as Record<string, unknown>;

      const rawCode = rawObj && typeof rawObj.code === 'string' ? rawObj.code : undefined;
      code = normalizeCode({ statusCode, rawCode });

      // Prefer explicit message from response body; fall back to exception message.
      message =
        rawObj && typeof rawObj.message === 'string'
          ? rawObj.message
          : exception.message || 'Request failed';

      if (rawObj && typeof rawObj.retryAfterMs === 'number') {
        retryAfterMs = rawObj.retryAfterMs;
      }

      issues = toIssuesFromUnknown(rawObj);

      if (rawObj && rawObj.details !== undefined) {
        const parsed = jsonValueSchema.safeParse(rawObj.details);
        if (parsed.success) details = parsed.data;
      }
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = exception.message || 'Internal error';
    }

    const body: ErrorResponse = {
      statusCode,
      code,
      message,
      requestId,
      retryAfterMs,
      issues,
      details,
    };

    // Remove undefined keys to satisfy strict schema + avoid noisy JSON.
    const cleaned = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));

    // Final defense: ensure we always emit a schema-valid error response.
    const parsed = ErrorResponseSchema.safeParse(cleaned);
    const out = parsed.success
      ? parsed.data
      : ({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'INTERNAL_ERROR',
          message: 'Internal error',
          requestId,
        } satisfies ErrorResponse);

    // Metrics: record the normalized error code (bounded label set).
    this.metrics.incError({ code: out.code, statusCode: out.statusCode });

    res.status(out.statusCode).json(out);
  }
}

