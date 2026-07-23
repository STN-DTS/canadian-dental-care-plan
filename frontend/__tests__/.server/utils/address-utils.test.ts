import { describe, expect, it } from 'vitest';

import { normalizeAddressField } from '~/.server/utils/address-utils';

describe('normalizeAddressField', () => {
  it('should remove accents from characters', () => {
    expect(normalizeAddressField('Montréal')).toBe('montreal');
    expect(normalizeAddressField('São Paulo')).toBe('sao paulo');
    expect(normalizeAddressField('Zürich')).toBe('zurich');
  });

  it('should remove punctuation and symbols', () => {
    expect(normalizeAddressField('123-Main St.')).toBe('123main st');
    expect(normalizeAddressField('Unit #5, Building A')).toBe('unit 5 building a');
    expect(normalizeAddressField("O'Connor Street")).toBe('oconnor street');
  });

  it('should collapse multiple spaces into single space', () => {
    expect(normalizeAddressField('123   Main    Street')).toBe('123 main street');
    expect(normalizeAddressField('Suite  100')).toBe('suite 100');
  });

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeAddressField('  Main Street  ')).toBe('main street');
    expect(normalizeAddressField('\t123 Main St\n')).toBe('123 main st');
  });

  it('should convert to lowercase', () => {
    expect(normalizeAddressField('MAIN STREET')).toBe('main street');
    expect(normalizeAddressField('Main Street')).toBe('main street');
  });

  it('should preserve letters and numbers', () => {
    expect(normalizeAddressField('123 Main Street')).toBe('123 main street');
    expect(normalizeAddressField('Unit 4B')).toBe('unit 4b');
  });

  it('should handle empty string', () => {
    expect(normalizeAddressField('')).toBe('');
  });

  it('should handle complex addresses with multiple transformations', () => {
    expect(normalizeAddressField('  123-A, Rue Saint-François  ')).toBe('123a rue saintfrancois');
    expect(normalizeAddressField('Appartement #10, Côté-des-Neiges')).toBe('appartement 10 cotedesneiges');
  });
});
