import { describe, expect, it } from 'vitest';

import { expandTemplate, formatAddress, formatPercent, hasDigits, isAllValidInputCharacters, isEmail, isEmpty, isURL, normalizeHyphens, padWithZero, randomHexString, randomString, removeInvalidInputCharacters } from '~/utils/string-utils';

describe('validator wrappers', () => {
  it('validates email addresses', () => {
    expect(isEmail('person@example.ca')).toBe(true);
    expect(isEmail('invalid-email')).toBe(false);
  });

  it('validates empty strings with options', () => {
    expect(isEmpty('')).toBe(true);
    expect(isEmpty(' ', { ignore_whitespace: true })).toBe(true);
    expect(isEmpty('value')).toBe(false);
  });

  it('validates URLs', () => {
    expect(isURL('https://www.canada.ca')).toBe(true);
    expect(isURL('not a url')).toBe(false);
  });
});

describe('expandTemplate', () => {
  it('should expand a template', () => {
    const template = '{greeting}, {subject}!';
    const variables = { greeting: 'Hello', subject: 'world' };

    expect(expandTemplate(template, variables)).toEqual('Hello, world!');
  });

  it('should expand a template and not throw an error if a variable is not defined', () => {
    const template = '{greeting}, {subject}!';
    const variables = { greeting: 'Hello' };

    expect(expandTemplate(template, variables)).toEqual('Hello, {subject}!');
  });

  it('should expand a template and not throw an error if extra variables are defined', () => {
    const template = '{greeting}, {subject}!';
    const variables = { greeting: 'Hello', subject: 'world', extra: 'variable' };

    expect(expandTemplate(template, variables)).toEqual('Hello, world!');
  });

  describe('randomHexString', () => {
    it('should generate a random hex string of specified length with the correct characters', () => {
      const str = randomHexString(8192);

      expect(str.length).toEqual(8192);
      expect(str).toMatch(/[0-9a-f]+/);
    });
  });

  describe('randomString', () => {
    it('should generate a random alphanumeric string of specified length with the correct characters', () => {
      const str = randomString(8192);

      expect(str.length).toEqual(8192);
      expect(str).toMatch(/[0-9a-z]+/);
    });
  });
});

describe('padWithZero', () => {
  it('should pad a number with zeros to reach the specified length', () => {
    expect(padWithZero(123, 5)).toBe('00123');
    expect(padWithZero(7, 3)).toBe('007');
    expect(padWithZero(1000, 5)).toBe('01000');
  });

  it('should return the value as a string if it is not a number', () => {
    expect(padWithZero(Number.NaN, 5)).toBe('NaN');
  });

  it('should return the value as a string if its length is greater than or equal to maxLength', () => {
    expect(padWithZero(12_345, 5)).toBe('12345');
    expect(padWithZero(123_456, 5)).toBe('123456');
  });
});

describe('isAllValidInputCharacters', () => {
  it('should return true for input containing the entire valid character set', () => {
    expect(isAllValidInputCharacters("a-zA-Z0-9'’ \u00A0(),-.ÀÁÂÄÇÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÝàáâäçèéêëìíîïòóôöùúûüýÿ")).toEqual(true);
  });

  it('should return false for input containing invalid characters', () => {
    expect(isAllValidInputCharacters('!"#$%&*+/:;<=>?@[\\]^_`{|}~¡¢£¤¥¦§¨©ª«¬\u00AD®¯±²³\u00B4µ-m¶·\u00B8¹º»¼½¾¿ÃãÅåÆæÐðÑñÕõ\u00D7ØøÞþẞß\u00F7')).toEqual(false);
  });
});

describe('removeInvalidInputCharacters', () => {
  it.each([
    ['abc123!@#', 'abc123'],
    ['abcdef123', 'abcdef123'],
    ['', ''],
    ['!@#', ''],
    ['a b c', 'a b c'],
    ['a1b!c2@d#e3f', 'a1bc2de3f'],
  ])('should remove invalid characters from "%s" to "%s"', (input, expectedOutput) => {
    expect(removeInvalidInputCharacters(input)).toBe(expectedOutput);
  });
});

describe('hasDigits', () => {
  it.each([
    ['', false],
    ['abc', false],
    ['abcABC', false],
    ['1', true],
    ['abc1', true],
    ['a1b2c3', true],
  ])('%s should return %s', (input, expected) => {
    expect(hasDigits(input)).toEqual(expected);
  });
});

describe('normalizeHyphens', () => {
  it.each([
    ['a--b---c', 'a-b-c'],
    ['a-b-c', 'a-b-c'],
    ['', ''],
    ['----', '-'],
    ['-abc--def-', '-abc-def-'],
  ])('should normalize hyphens in "%s" to "%s"', (input, expectedOutput) => {
    expect(normalizeHyphens(input)).toBe(expectedOutput);
  });
});

describe('formatPercent', () => {
  it.each([
    [0, '0%'],
    [50, '50%'],
    [100, '100%'],
  ])('should format percentage in English', (input, expected) => {
    expect(formatPercent(input, 'en')).toEqual(expected);
  });

  it.each([
    [0, '0\u00A0%'],
    [50, '50\u00A0%'],
    [100, '100\u00A0%'],
  ])('should format percentage in French', (input, expected) => {
    expect(formatPercent(input, 'fr')).toEqual(expected);
  });

  it('should throw an error for invalid Canadian locale', () => {
    expect(() => formatPercent(0, 'xy')).toThrowError();
  });
});

describe('formatAddress', () => {
  it('should format an address with all components', () => {
    const address = formatAddress({
      address: '123 Main St',
      city: 'Anytown',
      provinceState: 'ON',
      postalZipCode: 'K1A 0B1',
      country: 'Canada',
      apartment: 'Apt 4',
    });
    expect(address).toBe(`123 Main St Apt 4\nAnytown ON  K1A 0B1\nCanada`);
  });

  it('should format an address with missing components', () => {
    const address = formatAddress({
      address: '123 Main St',
      city: 'Anytown',
      country: 'Canada',
    });
    expect(address).toBe(`123 Main St\nAnytown\nCanada`);
  });

  it('should format an address with an apartment number that is not all alphanumeric', () => {
    const address = formatAddress({
      address: '123 Main St',
      city: 'Anytown',
      country: 'Canada',
      apartment: 'Unit 4B',
    });
    expect(address).toBe(`123 Main St Unit 4B\nAnytown\nCanada`);
  });

  it('should format an address with an alternate format', () => {
    const address = formatAddress({
      address: '123 Main St',
      city: 'Anytown',
      provinceState: 'ON',
      postalZipCode: 'K1A 0B1',
      country: 'Canada',
      apartment: 'Apt 4',
      format: 'alternative',
    });
    expect(address).toBe(`123 Main St Apt 4\nAnytown, ON\nK1A 0B1\nCanada`);
  });
});
