import { flatKeys } from 'moderndash';
import { describe, expect, it } from 'vitest';

import { TYPES } from '~/.server/constants';

/**
 * Generic tests for the `TYPES` constant
 */
describe('TYPES constant', () => {
  it('should contain unique service identifiers', () => {
    const flattenedKeys = flatKeys(TYPES);
    const allIdentifiers = Object.values(flattenedKeys);
    const uniqueIdentifiers = new Set(allIdentifiers);
    expect(uniqueIdentifiers.size).toBe(allIdentifiers.length);
  });

  it('should contain unique service identifiers for each entry', () => {
    const flattenedKeys = flatKeys(TYPES);
    expect.hasAssertions();
    for (const identifierKey of Object.keys(flattenedKeys)) {
      const identifier = flattenedKeys[identifierKey as keyof typeof flattenedKeys];
      expect(identifier).toBeTypeOf('symbol');
      expect((identifier as symbol).description).toBe(identifierKey);
    }
  });
});
