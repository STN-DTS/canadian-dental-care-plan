import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { i18nResources } from '~/.server/i18n-resources';

type LocaleString = { path: string; value: string };

type TypographyRule = { name: string; pattern: RegExp };

const LOCALES_DIR = join(import.meta.dirname, '../../../app/.server/locales');

const PHONE_NUMBER = String.raw`\d{1,3}(?:[-\u2011]\d{3,4}){2,}`;

// Invisible or look-alike characters that must be written as \uXXXX escapes so reviewers can see them.
const MUST_ESCAPE = /[\u00A0\u00AD\u2007\u2009\u200B\u2011\u2013\u2014\u2060\u202F\u2212\uFEFF]/gu;

const sharedRules: TypographyRule[] = [
  { name: "use straight apostrophe '", pattern: /[\u2018\u2019]/u },
  { name: 'use straight " in English and «\\u00A0…\\u00A0» in French', pattern: /[\u201C\u201D]/u },
  { name: 'use \\u2011 in phone numbers', pattern: new RegExp(String.raw`(?<![\d\u2011-])(?=${PHONE_NUMBER}(?![\d\u2011-]))[\d\u2011]*-`, 'u') },
];

const frenchRules: TypographyRule[] = [
  { name: 'use \\u00A0 before :', pattern: /[ \u202F]:/u },
  { name: 'use \\u00A0 inside « »', pattern: /«[ \u202F]|[ \u202F]»/u },
  { name: 'no space before ; ! ?', pattern: /\s[;!?]/u },
];

function collectStrings(value: unknown, path: string): LocaleString[] {
  if (typeof value === 'string') {
    return [{ path, value }];
  }

  if (value === null || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => collectStrings(child, `${path}.${key}`));
}

function findViolations(strings: LocaleString[], rules: readonly TypographyRule[]): string[] {
  return strings.flatMap(({ path, value }) =>
    rules.flatMap(({ name, pattern }) =>
      Array.from(value.matchAll(new RegExp(pattern, 'gu')), (match) => {
        const snippet = value.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20);
        return `${path} [${name}] ${JSON.stringify(snippet)}`;
      }),
    ),
  );
}

describe('locale typography', () => {
  it.each([
    { language: 'en', rules: sharedRules },
    { language: 'fr', rules: [...sharedRules, ...frenchRules] },
  ] as const)('$language strings follow the typography rules', ({ language, rules }) => {
    const strings = collectStrings(i18nResources[language], language);

    expect(findViolations(strings, rules)).toEqual([]);
  });

  it('locale sources escape invisible and look-alike characters', () => {
    const violations = readdirSync(LOCALES_DIR, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.ts'))
      .flatMap((file) =>
        readFileSync(join(LOCALES_DIR, file), 'utf8')
          .split('\n')
          .flatMap((line, index) => Array.from(line.matchAll(MUST_ESCAPE), ([char]) => `${file}:${index + 1} write U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')} as an escape`)),
      );

    expect(violations).toEqual([]);
  });
});
