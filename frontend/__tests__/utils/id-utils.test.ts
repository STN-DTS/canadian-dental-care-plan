import { describe, expect, it } from 'vitest';

import { generateId, isValidId } from '~/utils/id-utils';

describe('id-utils', () => {
  describe('generateId', () => {
    it('should generate a UUID', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('isValidId', () => {
    it.each([['550e8400-e29b-41d4-a716-446655440000'], ['123e4567-e89b-12d3-a456-426614174000'], ['fab8df50-1df6-f011-8406-6045bdf97563'], ['0cb9df50-1df6-f011-8406-6045bdf97563']])('should return true for valid UUID: %s', (uuid) => {
      expect(isValidId(uuid)).toBe(true);
    });

    it('should return true for a generated ID', () => {
      const id = generateId();
      expect(isValidId(id)).toBe(true);
    });

    it.each([['not-a-uuid'], ['invalid'], [''], ['V1StGXR8_Z'], ['550e8400-e29b-41d4-a716'], ['550e8400-e29b-41d4-a716-446655440000-extra']])('should return false for invalid ID: %s', (id) => {
      expect(isValidId(id)).toBe(false);
    });
  });
});
