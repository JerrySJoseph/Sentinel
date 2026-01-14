import {
  agentTraceSchema,
  chatRequestSchema,
  chatResponseSchema,
  isValid,
  parseOrThrow,
  toolCallSchema,
  toolResultSchema,
} from '../src';

const UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const UUID_2 = '3fa85f64-5717-4562-b3fc-2c963f66afa7';
const ISO = '2026-01-11T00:00:00.000Z';

describe('@sentinel/contracts schemas', () => {
  describe('ToolCall', () => {
    it('valid passes', () => {
      const input = {
        id: UUID,
        name: 'search',
        args: { query: 'hello' },
      };

      expect(toolCallSchema.parse(input)).toEqual(input);
    });

    it('invalid fails', () => {
      const input = {
        id: 'not-a-uuid',
        name: '',
        args: { query: 'hello' },
      };

      expect(() => toolCallSchema.parse(input)).toThrow();
    });
  });

  describe('ToolResult', () => {
    it('valid passes (ok=true)', () => {
      const input = {
        toolCallId: UUID,
        name: 'search',
        ok: true,
        result: { items: [] },
        durationMs: 12,
      };

      expect(toolResultSchema.parse(input)).toEqual(input);
    });

    it('invalid fails (ok=true but missing result)', () => {
      const input = {
        toolCallId: UUID,
        name: 'search',
        ok: true,
      };

      expect(() => toolResultSchema.parse(input)).toThrow();
    });

    it('invalid fails (ok=false but missing error)', () => {
      const input = {
        toolCallId: UUID,
        name: 'search',
        ok: false,
        result: { items: [] },
      };

      expect(() => toolResultSchema.parse(input)).toThrow();
    });
  });

  describe('AgentTrace', () => {
    it('valid passes', () => {
      const input = {
        requestId: UUID,
        sessionId: UUID_2,
        steps: [
          {
            id: UUID_2,
            kind: 'plan',
            name: 'planner',
            startedAt: ISO,
            durationMs: 5,
            input: { message: 'hi' },
            output: { toolCalls: [] },
          },
        ],
      };

      expect(agentTraceSchema.parse(input)).toEqual(input);
    });

    it('invalid fails', () => {
      const input = {
        requestId: 'not-a-uuid',
        steps: [],
      };

      expect(() => agentTraceSchema.parse(input)).toThrow();
    });
  });

  describe('ChatRequest', () => {
    it('valid passes', () => {
      const input = {
        sessionId: UUID,
        message: 'hello',
        history: [
          {
            role: 'user',
            content: 'previous message',
            createdAt: ISO,
          },
        ],
      };

      expect(chatRequestSchema.parse(input)).toEqual(input);
    });

    it('invalid fails', () => {
      const input = {
        message: '',
      };

      expect(() => chatRequestSchema.parse(input)).toThrow();
    });
  });

  describe('ChatResponse', () => {
    it('valid passes', () => {
      const input = {
        requestId: UUID,
        sessionId: UUID,
        latencyMs: 25,
        finalResponse: 'done',
        toolCalls: [
          {
            id: UUID_2,
            name: 'search',
            args: { query: 'hello' },
          },
        ],
        toolResults: [
          {
            toolCallId: UUID_2,
            name: 'search',
            ok: true,
            result: { items: [] },
            durationMs: 12,
          },
        ],
        trace: {
          requestId: UUID,
          sessionId: UUID,
          steps: [
            {
              id: UUID,
              kind: 'final',
              name: 'finalize',
              startedAt: ISO,
            },
          ],
        },
      };

      expect(chatResponseSchema.parse(input)).toEqual(input);
    });

    it('invalid fails', () => {
      const input = {
        requestId: UUID,
        sessionId: UUID,
        finalResponse: 'done',
        toolCalls: 'not-an-array',
        toolResults: [],
        trace: { requestId: UUID, steps: [] },
      };

      expect(() => chatResponseSchema.parse(input)).toThrow();
    });
  });

  describe('validation helpers', () => {
    it('parseOrThrow returns typed data', () => {
      const input = { id: UUID, name: 'noop', args: {} };
      const parsed = parseOrThrow(toolCallSchema, input);
      expect(parsed).toEqual(input);
    });

    it('isValid returns false for invalid data', () => {
      const input = { message: '' };
      expect(isValid(chatRequestSchema, input)).toBe(false);
    });
  });
});
