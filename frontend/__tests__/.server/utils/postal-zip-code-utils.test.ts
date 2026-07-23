import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatPostalCode, isValidCanadianPostalCode, isValidPostalCode } from '~/.server/utils/postal-zip-code-utils';

vi.mock('~/.server/utils/env-utils', () => ({
  getEnv: vi.fn().mockReturnValue({
    CANADA_COUNTRY_ID: 'CA',
    USA_COUNTRY_ID: 'US',
    ALBERTA_PROVINCE_ID: 'AB',
    BRITISH_COLUMBIA_PROVINCE_ID: 'BC',
    MANITOBA_PROVINCE_ID: 'MB',
    NEW_BRUNSWICK_PROVINCE_ID: 'NB',
    NOVA_SCOTIA_PROVINCE_ID: 'NS',
    ONTARIO_PROVINCE_ID: 'ON',
    QUEBEC_PROVINCE_ID: 'QC',
    SASKATCHEWAN_PROVINCE_ID: 'SK',
    NEWFOUNDLAND_PROVINCE_ID: 'NL',
    PRINCE_EDWARD_ISLAND_PROVINCE_ID: 'PE',
    NUNAVUT_PROVINCE_ID: 'NU',
    NORTHWEST_TERRITORIES_PROVINCE_ID: 'NW',
    YUKON_PROVINCE_ID: 'YU',
  }),
}));

describe('~/.server/utils/postal-zip-code-utils.ts', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidPostalCode()', () => {
    // Canadian Postal Codes
    it('should return true for Canadian postal code without space', () => {
      expect(isValidPostalCode('CA', 'H0H0W0')).toEqual(true);
    });

    it('should return true Canadian postal code with space', () => {
      expect(isValidPostalCode('CA', 'H0H 0Z0')).toEqual(true);
    });

    it('should return false for Canadian postal code with too many spaces', () => {
      expect(isValidPostalCode('CA', 'H0H  0H0')).toEqual(false);
    });

    it('should return false for Canadian postal code of invalid format', () => {
      expect(isValidPostalCode('CA', 'H0H0')).toEqual(false);
    });

    it.each([...'DFIOQUdfioqu'].map((ch) => [ch]))('should return false when Canadian postal code contains invalid character "%s"', (ch) => {
      expect(isValidPostalCode('CA', `H0${ch} 0W0`)).toEqual(false);
    });

    it.each([...'WZwz'].map((ch) => [ch]))('should return false when Canadian postal code starts with invalid character "%s"', (ch) => {
      expect(isValidPostalCode('CA', `${ch}0H 0H0`)).toEqual(false);
    });

    // American Zip Code
    it('should return true for American zip code without space', () => {
      expect(isValidPostalCode('US', '12345')).toEqual(true);
    });

    it('should return true for American zip code with 9 digits', () => {
      expect(isValidPostalCode('US', '123456789')).toEqual(true);
    });

    it('should return true for American zip code with 9 digits and hyphen', () => {
      expect(isValidPostalCode('US', '12345-6789')).toEqual(true);
    });

    it('should return false for American zip code of invalid format', () => {
      expect(isValidPostalCode('US', '123')).toEqual(false);
    });

    it('should return true for country codes that are not Canadian or American codes', () => {
      expect(isValidPostalCode('XYZ', 'ABC 123')).toEqual(true);
    });
  });

  describe('isValidCanadianPostalCode', () => {
    const testParams = [
      ['BC', 'v0h0h0', true],
      ['AB', 't0h0h0', true],
      ['SK', 's0h0h0', true],
      ['MB', 'r0h0h0', true],
      ['ON', 'k0h0h0', true],
      ['ON', 'l0h0h0', true],
      ['ON', 'm0h0h0', true],
      ['ON', 'n0h0h0', true],
      ['ON', 'p0h0h0', true],
      ['QC', 'g0h0h0', true],
      ['QC', 'h0h0h0', true],
      ['QC', 'j0h0h0', true],
      ['NB', 'e0h0h0', true],
      ['NS', 'b0h0h0', true],
      ['PE', 'c0h0h0', true],
      ['NL', 'a0h0h0', true],
      ['YU', 'y0h0h0', true],
      ['NW', 'x0h0h0', true],
      ['BC', 'i0h0h0', false],
      ['AB', 'i0h0h0', false],
      ['SK', 'i0h0h0', false],
      ['MB', 'i0h0h0', false],
      ['ON', 'i0h0h0', false],
      ['ON', 'i0h0h0', false],
      ['ON', 'i0h0h0', false],
      ['ON', 'i0h0h0', false],
      ['ON', 'i0h0h0', false],
      ['QC', 'i0h0h0', false],
      ['QC', 'i0h0h0', false],
      ['NB', 'i0h0h0', false],
      ['NS', 'i0h0h0', false],
      ['PE', 'i0h0h0', false],
      ['NL', 'i0h0h0', false],
      ['YU', 'i0h0h0', false],
      ['XX', 'h0h0h0', false],
      ['AB', 't0h 0h0', true],
      ['AB', 't0h  0h0', false],
      ['AB', 'T0h  0H0', false],
      ['AB', 'T0h 0H0', true],
      ['AB', '  T0h 0H0 ', false],
    ] as const;

    it.each(testParams)('isValidCanadianPostalCode(%j,%j) should return "%s"', (provinceCode, postalCode, expected) => {
      expect(isValidCanadianPostalCode(provinceCode, postalCode)).toEqual(expected);
    });
  });

  describe('formatPostalCode()', () => {
    it('should format Canadian postal code without space in middle', () => {
      expect(formatPostalCode('CA', 'H0H0H0')).toEqual('H0H 0H0');
    });

    it('should format Canadian postal code with space in middle', () => {
      expect(formatPostalCode('CA', 'H0H 0H0')).toEqual('H0H 0H0');
    });

    it('should return the input if country code is American and the zip code is valid', () => {
      expect(formatPostalCode('US', '12345')).toEqual('12345');
    });

    it.each([['123456789'], ['12345-6789']])('should return the formatted zip code if country code is American and the input is valid, for [%s]', (input) => {
      expect(formatPostalCode('US', '123456789')).toEqual('12345-6789');
    });

    it('should throw an error if the country code is Canadian and the format is invalid', () => {
      expect(() => formatPostalCode('CA', 'H0H  0H0')).toThrowError();
    });

    it('should throw an error if the country code is American and the format is invalid', () => {
      expect(() => formatPostalCode('US', '123')).toThrowError();
    });
  });
});
