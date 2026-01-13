import { describe, expect, it, vi } from 'vitest';
import { createChatClient } from '../lib/chat-client';

function okResponse(obj: unknown) {
  return {
    ok: true,
    status: 200,
    headers: {
      get() {
        return null;
      },
    },
    async text() {
      return JSON.stringify(obj);
    },
  };
}

function badResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
    headers: {
      get(name: string) {
        if (name.toLowerCase() === 'x-request-id') return 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
        return null;
      },
    },
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
  };
}

describe('chat client', () => {
  it('sends correct request and returns parsed ChatResponse on success', async () => {
    const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const fetchFn = vi.fn(async (url: string, init?: { body?: string }) => {
      expect(url).toContain('/v1/chat');
      expect(init?.body).toBeTruthy();

      const body = JSON.parse(init?.body ?? '{}') as { sessionId?: string; message?: string };
      expect(body.message).toBe('hello');
      expect(body.sessionId).toBe(sessionId);

      return {
        ...okResponse({
        requestId,
        sessionId,
        latencyMs: 5,
        finalResponse: 'hi!',
        toolCalls: [],
        toolResults: [],
        trace: {
          requestId,
          sessionId,
          steps: [],
        },
        }),
        headers: {
          get(name: string) {
            if (name.toLowerCase() === 'x-trace-id') return 'trace-abc';
            if (name.toLowerCase() === 'x-span-id') return 'span-xyz';
            return null;
          },
        },
      };
    });

    const client = createChatClient({ fetchFn, timeoutMs: 50 });
    const result = await client.sendMessage({
      sessionId,
      message: 'hello',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.finalResponse).toBe('hi!');
      expect(result.data.sessionId).toBe(sessionId);
      expect(result.meta?.traceId).toBe('trace-abc');
      expect(result.meta?.spanId).toBe('span-xyz');
    }
  });

  it('returns a readable error when response schema validation fails', async () => {
    const fetchFn = vi.fn(async () => okResponse({ nope: true }));
    const client = createChatClient({ fetchFn, timeoutMs: 50 });

    const result = await client.sendMessage({ message: 'hello' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
      expect(result.error.message).toContain('Invalid response from agent-core');
    }
  });

  it('returns a readable error on non-2xx http responses', async () => {
    const fetchFn = vi.fn(async () =>
      badResponse(400, {
        statusCode: 400,
        code: 'INVALID_INPUT',
        message: 'Invalid request body',
        requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    );
    const client = createChatClient({ fetchFn, timeoutMs: 50 });

    const result = await client.sendMessage({ message: 'hello' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('http');
      expect(result.error.message).toContain('Invalid request body');
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(result.error.requestId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    }
  });
});


