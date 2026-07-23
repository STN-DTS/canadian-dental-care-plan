import { describe, expect, it } from 'vitest';

import { moveToTop } from '~/.server/utils/collection-utils';

describe('moveToTop', () => {
  it('should move the targeted element to the top of the array', () => {
    const array = [1, 2, 3, 4, 5];
    const result = moveToTop(array, (num) => num === 3);
    expect(result).toEqual([3, 1, 2, 4, 5]);
  });

  it('should return the original array if no element matches the predicate', () => {
    const array = [1, 2, 3, 4, 5];
    const result = moveToTop(array, (num) => num === 10);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should not modify the original array', () => {
    const array = [1, 2, 3, 4, 5];
    const result = moveToTop(array, (num) => num === 6);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should preserve the order of matching elements', () => {
    const array = [1, 5, 6, 10, 11, 20, 100];
    const result = moveToTop(array, (num) => num > 10);
    expect(result).toEqual([11, 20, 100, 1, 5, 6, 10]);
  });
});
