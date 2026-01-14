import { z } from 'zod';

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

export function safeParse<T>(schema: z.ZodType<T>, data: unknown): z.ZodSafeParseResult<T> {
  return schema.safeParse(data);
}

export function isValid<T>(schema: z.ZodType<T>, data: unknown): data is T {
  return schema.safeParse(data).success;
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
}
