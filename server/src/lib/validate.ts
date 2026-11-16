import type { z } from 'zod';
import { ApiError } from './errors.ts';

/** Parse input with a Zod schema, converting issues into a field → message map. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw new ApiError('VALIDATION', 'Some details need your attention.', { fields });
}
