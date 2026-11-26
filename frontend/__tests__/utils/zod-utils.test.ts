import { assert, describe, expect, it } from 'vitest';
import * as z from 'zod';

import { jsonCodec } from '~/utils/zod-utils';

describe('jsonCodec', () => {
  const schema = jsonCodec(
    z.object({
      name: z.string().trim().nonempty(),
      count: z.number().int().positive(),
    }),
  );

  it('decodes a valid JSON string and validates against the target schema', () => {
    const result = schema.safeParse('{"name":"  Ada  ","count":3}');

    assert(result.success);
    expect(result.data).toEqual({ name: 'Ada', count: 3 });
  });

  it('encodes structured values back into a JSON string', () => {
    expect(z.encode(schema, { name: 'Ada', count: 3 })).toBe('{"name":"Ada","count":3}');
  });

  it('returns an invalid_format json issue for malformed JSON without throwing', () => {
    const result = schema.safeParse('{invalid');

    assert(!result.success);
    expect(result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_format',
        format: 'json',
      }),
    ]);
  });

  it('rejects valid JSON that fails the target schema', () => {
    const result = schema.safeParse('{"name":"","count":0}');

    expect(result.success).toBe(false);
  });

  it('rejects non-string inputs', () => {
    expect(schema.safeParse({ name: 'Ada', count: 3 }).success).toBe(false);
  });
});
