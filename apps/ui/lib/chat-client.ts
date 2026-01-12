import {
    ChatRequestSchema,
    ChatResponseSchema,
    type ChatRequest,
    type ChatResponse,
} from '@sentinel/contracts';
import { buildAgentCoreUrl } from './api';

export type FetchLike = (
    input: string,
    init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        signal?: AbortSignal;
    },
) => Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
}>;

export type ChatClient = {
    sendMessage(input: { sessionId?: string; message: string }): Promise<
        | { ok: true; data: ChatResponse }
        | { ok: false; error: { message: string; kind: 'network' | 'http' | 'validation' } }
    >;
};

function formatZodIssues(issues: { path: PropertyKey[]; message: string }[]): string {
    return issues
        .slice(0, 5)
        .map((i) => `${i.path.length ? i.path.map(String).join('.') : '(root)'}: ${i.message}`)
        .join('; ');
}

export function createChatClient(opts?: { fetchFn?: FetchLike; timeoutMs?: number }): ChatClient {
    const fetchFn: FetchLike = opts?.fetchFn ?? (fetch as unknown as FetchLike);
    const timeoutMs = opts?.timeoutMs ?? 30_000;

    return {
        async sendMessage(input): Promise<
            | { ok: true; data: ChatResponse }
            | { ok: false; error: { message: string; kind: 'network' | 'http' | 'validation' } }
        > {
            let reqBody: ChatRequest;
            try {
                reqBody = ChatRequestSchema.parse({
                    sessionId: input.sessionId,
                    message: input.message,
                });
            } catch (e) {
                return {
                    ok: false,
                    error: {
                        kind: 'validation',
                        message: e instanceof Error ? e.message : 'Invalid request',
                    },
                };
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const res = await fetchFn(buildAgentCoreUrl('/v1/chat'), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(reqBody),
                    signal: controller.signal,
                });

                const rawText = await res.text().catch(() => '');
                const data: unknown = (() => {
                    if (!rawText) return undefined;
                    try {
                        return JSON.parse(rawText) as unknown;
                    } catch {
                        return rawText;
                    }
                })();

                if (!res.ok) {
                    const message =
                        typeof data === 'object' && data !== null && 'message' in data
                            ? String((data as { message?: unknown }).message)
                            : typeof data === 'string' && data.trim().length > 0
                                ? data.trim()
                                : `HTTP ${res.status}`;
                    return { ok: false, error: { kind: 'http', message } };
                }

                const parsed = ChatResponseSchema.safeParse(data);
                if (!parsed.success) {
                    return {
                        ok: false,
                        error: {
                            kind: 'validation',
                            message: `Invalid response from agent-core (${formatZodIssues(
                                parsed.error.issues as unknown as { path: PropertyKey[]; message: string }[],
                            )})`,
                        },
                    };
                }

                return { ok: true, data: parsed.data };
            } catch (e) {
                const message =
                    e instanceof DOMException && e.name === 'AbortError'
                        ? 'Request timed out'
                        : e instanceof Error
                            ? e.message
                            : 'Request failed';
                return { ok: false, error: { kind: 'network', message } };
            } finally {
                clearTimeout(timeout);
            }
        },
    };
}


