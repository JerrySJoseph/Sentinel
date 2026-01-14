import { z } from 'zod';
import { jsonObjectSchema, jsonValueSchema } from './json';

const uuidSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime();

export const toolErrorSchema = z
  .object({
    message: z.string().min(1),
    code: z.string().min(1).optional(),
    details: jsonValueSchema.optional(),
  })
  .strict();
export type ToolError = z.infer<typeof toolErrorSchema>;

export const toolCallSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1),
    args: jsonObjectSchema,
  })
  .strict();
export type ToolCall = z.infer<typeof toolCallSchema>;

export const toolResultSchema = z
  .object({
    toolCallId: uuidSchema,
    name: z.string().min(1),
    ok: z.boolean(),
    result: jsonValueSchema.optional(),
    error: toolErrorSchema.optional(),
    startedAt: isoDateTimeSchema.optional(),
    endedAt: isoDateTimeSchema.optional(),
    durationMs: z.number().int().nonnegative().optional(),
    truncated: z.boolean().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.ok) {
      if (val.error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['error'],
          message: 'error must be omitted when ok=true',
        });
      }
      if (val.result === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['result'],
          message: 'result is required when ok=true',
        });
      }
      return;
    }

    if (!val.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['error'],
        message: 'error is required when ok=false',
      });
    }
  });
export type ToolResult = z.infer<typeof toolResultSchema>;

export const agentTraceStepSchema = z
  .object({
    id: uuidSchema,
    kind: z.enum(['plan', 'provider', 'tool', 'memory', 'final']),
    name: z.string().min(1),
    startedAt: isoDateTimeSchema,
    endedAt: isoDateTimeSchema.optional(),
    durationMs: z.number().int().nonnegative().optional(),
    input: jsonValueSchema.optional(),
    output: jsonValueSchema.optional(),
    error: toolErrorSchema.optional(),
  })
  .strict();
export type AgentTraceStep = z.infer<typeof agentTraceStepSchema>;

export const agentTraceSchema = z
  .object({
    requestId: uuidSchema,
    sessionId: uuidSchema.optional(),
    steps: z.array(agentTraceStepSchema),
  })
  .strict();
export type AgentTrace = z.infer<typeof agentTraceSchema>;

export const chatMessageSchema = z
  .object({
    id: uuidSchema.optional(),
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.string(),
    createdAt: isoDateTimeSchema.optional(),
    toolCallId: uuidSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.role !== 'tool' && val.toolCallId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toolCallId'],
        message: 'toolCallId is only valid for role="tool"',
      });
    }
  });
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z
  .object({
    sessionId: uuidSchema.optional(),
    message: z.string().min(1),
    history: z.array(chatMessageSchema).optional(),
  })
  .strict();
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z
  .object({
    requestId: uuidSchema,
    sessionId: uuidSchema,
    latencyMs: z.number().int().nonnegative(),
    finalResponse: z.string(),
    toolCalls: z.array(toolCallSchema),
    toolResults: z.array(toolResultSchema),
    trace: agentTraceSchema,
  })
  .strict();
export type ChatResponse = z.infer<typeof chatResponseSchema>;

export const planOutputSchema = z
  .object({
    toolCalls: z.array(toolCallSchema),
    finalResponse: z.string(),
    trace: agentTraceSchema,
  })
  .strict();
export type PlanOutput = z.infer<typeof planOutputSchema>;

// -----------------------------
// Error model (API error envelope)
// -----------------------------

export const sentinelErrorCodeSchema = z.union([
  z.enum([
    'INVALID_INPUT',
    'INVALID_PLAN',
    'PROVIDER_ERROR',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
    'PROVIDER_BUSY',
    'TOOL_BUSY',
    // Common tool-level codes that can surface as API errors (misconfiguration, policy, etc.)
    'POLICY_DENIED',
    'TIMEOUT',
  ]),
  // Allow future tool codes without changing the envelope schema.
  z.string().regex(/^TOOL_[A-Z0-9_]+$/),
]);
export type SentinelErrorCode = z.infer<typeof sentinelErrorCodeSchema>;

export const errorIssueSchema = z
  .object({
    path: z.string().min(1),
    message: z.string().min(1),
    code: z.string().min(1).optional(),
  })
  .strict();
export type ErrorIssue = z.infer<typeof errorIssueSchema>;

export const errorResponseSchema = z
  .object({
    statusCode: z.number().int(),
    code: sentinelErrorCodeSchema,
    message: z.string().min(1),
    requestId: uuidSchema,
    retryAfterMs: z.number().int().nonnegative().optional(),
    issues: z.array(errorIssueSchema).optional(),
    details: jsonValueSchema.optional(),
  })
  .strict();
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// PascalCase aliases for ergonomic imports
export const ToolCallSchema = toolCallSchema;
export const ToolResultSchema = toolResultSchema;
export const AgentTraceSchema = agentTraceSchema;
export const AgentTraceStepSchema = agentTraceStepSchema;
export const ChatMessageSchema = chatMessageSchema;
export const ChatRequestSchema = chatRequestSchema;
export const ChatResponseSchema = chatResponseSchema;
export const PlanOutputSchema = planOutputSchema;
export const ErrorResponseSchema = errorResponseSchema;
