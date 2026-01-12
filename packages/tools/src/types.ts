import { z } from 'zod';
import { JsonObject, JsonValue } from '@sentinel/contracts';

export type ToolName = string;

export type ToolRisk = 'safe' | 'developer';

export type ToolPolicy = {
  mode: 'safe' | 'developer';
};

export type ToolContext = {
  requestId: string;
  sessionId?: string;
  policy: ToolPolicy;
};

export interface Tool<Args extends JsonObject = JsonObject> {
  readonly name: ToolName;
  readonly description: string;
  readonly risk: ToolRisk;
  readonly argsSchema: z.ZodType<Args>;
  execute(args: Args, ctx: ToolContext): Promise<JsonValue>;
}

