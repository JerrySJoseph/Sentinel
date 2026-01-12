import { describe, expect, it, vi } from 'vitest';
import { createChatClient } from '../lib/chat-client';

function okResponse(obj: unknown) {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify(obj);
    },
  };
}

function badResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
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

      return okResponse({
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
      });
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
      badResponse(400, { message: 'Invalid request body', code: 'VALIDATION_ERROR' }),
    );
    const client = createChatClient({ fetchFn, timeoutMs: 50 });

    const result = await client.sendMessage({ message: 'hello' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('http');
      expect(result.error.message).toContain('Invalid request body');
    }
  });
});


