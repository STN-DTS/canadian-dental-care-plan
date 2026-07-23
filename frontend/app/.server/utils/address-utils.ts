/**
 * Normalizes an address field string by removing accents, special characters, and extra whitespace.
 *
 * The normalization process includes:
 * - Converting Unicode characters to NFD (Canonical Decomposition) form to separate base characters from diacritics
 * - Removing all diacritic marks (accents)
 * - Removing all punctuation and symbols, keeping only letters, numbers, and spaces
 * - Collapsing multiple consecutive spaces into a single space
 * - Trimming leading and trailing whitespace
 * - Converting the result to lowercase
 *
 * @param str - The address field string to normalize
 * @returns The normalized address string in lowercase with accents and special characters removed
 *
 * @example
 * ```typescript
 * normalizeAddressField("123 Rue Saint-André"); // returns "123 rue saint andre"
 * normalizeAddressField("Montréal,  QC"); // returns "montreal qc"
 * ```
 */
export function normalizeAddressField(str: string): string {
  return str
    .normalize('NFD') // separate base + accent
    .replaceAll(/\p{Diacritic}/gu, '') // remove accents
    .replaceAll(/[^\p{L}\p{N}\s]/gu, '') // remove punctuation/symbols
    .replaceAll(/\s+/g, ' ') // collapse multiple spaces
    .trim()
    .toLowerCase();
}
