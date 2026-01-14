'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAgentCoreUrl } from '@/lib/api';
import { type ChatResponse } from '@sentinel/contracts';
import { createChatClient, type ChatClientError, type ResponseMeta } from '@/lib/chat-client';
import { clearSessionId, loadSessionId, saveSessionId } from '@/lib/session';

type ChatUiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: ChatResponse;
  error?: ChatClientError;
  meta?: ResponseMeta;
  pending?: boolean;
};

function newId(): string {
  // `crypto.randomUUID` is available in modern browsers; fall back for safety.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function formatMs(ms: number | undefined): string {
  return typeof ms === 'number' && Number.isFinite(ms) ? `${ms}` : '—';
}

function deriveTraceSummary(response: ChatResponse): {
  providerDurationMs?: number;
  toolDurationMs?: number;
  toolDurations?: Array<{ name: string; durationMs: number }>;
} {
  const providerMs = sum(
    response.trace.steps
      .filter((s) => s.kind === 'provider' && typeof s.durationMs === 'number')
      .map((s) => s.durationMs as number),
  );

  const toolDurations = response.toolResults
    .filter((tr) => typeof tr.durationMs === 'number')
    .map((tr) => ({ name: tr.name, durationMs: tr.durationMs as number }));

  const toolMs = sum(toolDurations.map((t) => t.durationMs));

  return {
    providerDurationMs: providerMs || undefined,
    toolDurationMs: toolMs || undefined,
    toolDurations: toolDurations.length ? toolDurations : undefined,
  };
}

function updateMessageById(
  prev: ChatUiMessage[],
  id: string,
  updater: (msg: ChatUiMessage) => ChatUiMessage,
): ChatUiMessage[] {
  const idx = prev.findIndex((m) => m.id === id);
  if (idx === -1) return prev;
  const next = prev.slice();
  next[idx] = updater(prev[idx]);
  return next;
}

export default function Home() {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const chatClient = useMemo(() => createChatClient(), []);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  useEffect(() => {
    const stored = loadSessionId(localStorage);
    if (stored) setSessionId(stored);
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(): Promise<void> {
    const trimmed = input.trim();
    if (trimmed.length === 0 || isSending) return;

    setError(null);
    setIsSending(true);
    setInput('');

    const userMsg: ChatUiMessage = { id: newId(), role: 'user', content: trimmed };
    const thinkingId = newId();
    const thinkingMsg: ChatUiMessage = {
      id: thinkingId,
      role: 'assistant',
      content: 'Thinking…',
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);

    try {
      const result = await chatClient.sendMessage({
        sessionId: sessionId ?? undefined,
        message: trimmed,
      });

      if (!result.ok) {
        setError(result.error.message);
        setMessages((prev) =>
          updateMessageById(prev, thinkingId, (m) => ({
            ...m,
            pending: false,
            response: undefined,
            meta: result.meta,
            error: result.error,
            content: `Error: ${result.error.message}`,
          })),
        );
        return;
      }

      setSessionId(result.data.sessionId);
      saveSessionId(localStorage, result.data.sessionId);

      setMessages((prev) =>
        updateMessageById(prev, thinkingId, (msg) => ({
          ...msg,
          pending: false,
          content: result.data.finalResponse,
          response: result.data,
          meta: result.meta,
          error: undefined,
        })),
      );
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'AbortError'
          ? 'Request timed out'
          : e instanceof Error
            ? e.message
            : 'Request failed';
      setError(msg);
      setMessages((prev) =>
        updateMessageById(prev, thinkingId, (m) => ({
          ...m,
          pending: false,
          response: undefined,
          meta: undefined,
          error: { kind: 'network', message: msg },
          content: `Error: ${msg}`,
        })),
      );
    } finally {
      setIsSending(false);
    }
  }

  function newSession(): void {
    setMessages([]);
    setError(null);
    setSessionId(null);
    clearSessionId(localStorage);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold tracking-tight">Sentinel</h1>
          <p className="text-sm text-muted-foreground">
            {sessionId ? (
              <>
                Session: <span className="font-mono">{sessionId}</span>
              </>
            ) : (
              'No session yet'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={newSession}
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-black/5"
          disabled={isSending}
        >
          New session
        </button>
      </header>

      <section className="flex min-h-0 flex-1 flex-col rounded-lg border bg-white">
        <div className="flex-1 space-y-3 overflow-auto p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ask something to start. (Agent core: <span className="font-mono">{buildAgentCoreUrl('')}</span>)
            </p>
          ) : null}

          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'ml-auto' : 'mr-auto'}>
              <div
                className={[
                  'max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                  m.role === 'user' ? 'bg-black text-white' : 'bg-black/5 text-black',
                ].join(' ')}
              >
                <div className="whitespace-pre-wrap">
                  {m.pending ? <span className="text-black/70">Thinking…</span> : m.content}
                </div>
              </div>

              {m.role === 'assistant' && m.response ? (
                <details className="mt-2 max-w-[90%] rounded-md border bg-white px-3 py-2 text-xs">
                  <summary className="cursor-pointer select-none font-medium text-black/70">
                    Inspect
                  </summary>
                  <div className="mt-2 space-y-3">
                    <div className="grid grid-cols-1 gap-1">
                      <div>
                        <span className="font-medium">requestId:</span>{' '}
                        <span className="font-mono">
                          {m.meta?.requestId ?? m.response.requestId ?? '—'}
                        </span>
                      </div>
                      {m.meta?.traceId ? (
                        <div>
                          <span className="font-medium">traceId:</span>{' '}
                          <span className="font-mono">{m.meta.traceId}</span>
                        </div>
                      ) : null}
                      <div>
                        <span className="font-medium">latencyMs:</span>{' '}
                        <span className="font-mono">
                          {typeof m.response.latencyMs === 'number' ? m.response.latencyMs : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      <div className="font-medium text-black/70">Trace summary</div>
                      {(() => {
                        const s = deriveTraceSummary(m.response);
                        return (
                          <>
                            <div>
                              <span className="font-medium">providerDurationMs:</span>{' '}
                              <span className="font-mono">{formatMs(s.providerDurationMs)}</span>
                            </div>
                            <div>
                              <span className="font-medium">toolDurationMs:</span>{' '}
                              <span className="font-mono">{formatMs(s.toolDurationMs)}</span>
                            </div>
                            {s.toolDurations ? (
                              <div>
                                <span className="font-medium">tools:</span>{' '}
                                <span className="font-mono">
                                  {s.toolDurations
                                    .slice(0, 10)
                                    .map((t) => `${t.name}:${t.durationMs}ms`)
                                    .join(', ') || '—'}
                                </span>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>

                    <div>
                      <div className="mb-1 font-medium">toolCalls</div>
                      <pre className="max-h-48 overflow-auto rounded bg-black/5 p-2 font-mono">
                        {prettyJson(m.response.toolCalls)}
                      </pre>
                    </div>

                    <div>
                      <div className="mb-1 font-medium">toolResults</div>
                      <pre className="max-h-48 overflow-auto rounded bg-black/5 p-2 font-mono">
                        {prettyJson(m.response.toolResults)}
                      </pre>
                    </div>

                    <div>
                      <div className="mb-1 font-medium">trace</div>
                      <pre className="max-h-64 overflow-auto rounded bg-black/5 p-2 font-mono">
                        {prettyJson(m.response.trace)}
                      </pre>
                    </div>
                  </div>
                </details>
              ) : m.role === 'assistant' && m.error ? (
                <details className="mt-2 max-w-[90%] rounded-md border bg-white px-3 py-2 text-xs">
                  <summary className="cursor-pointer select-none font-medium text-black/70">
                    Inspect
                  </summary>
                  <div className="mt-2 space-y-3">
                    <div className="grid grid-cols-1 gap-1">
                      <div>
                        <span className="font-medium">requestId:</span>{' '}
                        <span className="font-mono">
                          {m.error.requestId ?? m.meta?.requestId ?? '—'}
                        </span>
                      </div>
                      {m.meta?.traceId ? (
                        <div>
                          <span className="font-medium">traceId:</span>{' '}
                          <span className="font-mono">{m.meta.traceId}</span>
                        </div>
                      ) : null}
                      <div>
                        <span className="font-medium">code:</span>{' '}
                        <span className="font-mono">{m.error.code ?? '—'}</span>
                      </div>
                      <div>
                        <span className="font-medium">message:</span> {m.error.message}
                      </div>
                      {typeof m.error.retryAfterMs === 'number' ? (
                        <div>
                          <span className="font-medium">retryAfterMs:</span>{' '}
                          <span className="font-mono">{m.error.retryAfterMs}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          ))}

          <div ref={listEndRef} />
        </div>

        <div className="border-t p-3">
          {error ? <p className="mb-2 text-sm text-red-600">Error: {error}</p> : null}

          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Type a message…"
              rows={3}
              className="flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              disabled={isSending}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!canSend}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSending ? 'Sending…' : 'Send'}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Enter to send • Shift+Enter for newline</p>
        </div>
      </section>
    </main>
  );
}
