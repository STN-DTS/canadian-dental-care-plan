import * as z from 'zod';

/**
 * Parses a JSON string into a value validated by `schema` and serializes it back to JSON.
 *
 * `parse`/`decode`: JSON string -> `z.output<T>`.
 * `encode`: `z.output<T>` -> JSON string.
 */
export function jsonCodec<T extends z.core.$ZodType>(schema: T) {
  return z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        ctx.issues.push({
          code: 'invalid_format',
          format: 'json',
          input: jsonString,
          message: error instanceof Error ? error.message : 'Invalid JSON',
        });
        return z.NEVER;
      }
    },
    encode: (value) => JSON.stringify(value),
  });
}
