import { z } from 'zod';
import { JsonValue } from '@sentinel/contracts';
import { Tool, ToolContext } from '../types';

export const echoArgsSchema = z
  .object({
    text: z.string().min(1).max(10_000),
  })
  .strict();

const echoResultSchema = z
  .object({
    echoed: z.string(),
    length: z.number().int().nonnegative(),
  })
  .strict();

/**
 * A safe, deterministic tool that returns its input.
 * Useful as a template for adding new tools.
 */
export class EchoTool implements Tool<z.infer<typeof echoArgsSchema>> {
  readonly name = 'echo';
  readonly description = 'Echo back the provided text (safe, deterministic).';
  readonly risk = 'safe' as const;
  readonly argsSchema = echoArgsSchema;

  execute(args: z.infer<typeof echoArgsSchema>, _ctx: ToolContext): Promise<JsonValue> {
    // Validate output shape as defense-in-depth.
    return Promise.resolve(echoResultSchema.parse({ echoed: args.text, length: args.text.length }));
  }
}
