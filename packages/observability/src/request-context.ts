import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  requestId: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
};

const als = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

export function setRequestContext(patch: Partial<RequestContext>): void {
  const current = als.getStore();
  if (!current) return;
  als.enterWith({ ...current, ...patch });
}

export function getRequestId(): string | undefined {
  return als.getStore()?.requestId;
}

