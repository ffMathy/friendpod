import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * react-hook-form resolver for the shared core schemas. A local adapter instead of @hookform/resolvers,
 * whose optional `ajv@8` peer conflicts with ESLint's `ajv@6` in the root workspace (`npm ls` fails).
 */
export function zodResolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      if (issue.path.length === 0) continue;
      let node = errors;
      issue.path.forEach((key, i) => {
        const k = String(key);
        if (i === issue.path.length - 1) {
          node[k] ??= { type: issue.code, message: issue.message };
        } else {
          node[k] ??= {};
          node = node[k] as Record<string, unknown>;
        }
      });
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}
