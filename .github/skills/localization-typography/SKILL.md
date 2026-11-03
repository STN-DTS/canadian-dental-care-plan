---
name: localization-typography
description: '**UTILITY SKILL** Normalize typography in English and French locale strings. USE FOR: editing translations, pasting writer or translator content, French non-breaking spaces, phone-number hyphens, curly apostrophes or quotes, punctuation appended after t() in JSX, typography.test.ts failures. DO NOT USE FOR: rewording, translating, grammar, Power Platform JSON.'
---

# Localization typography

Applies to `frontend/app/.server/locales/{en,fr}/*.ts`. Tables: [rules](references/rules.md). Citations: [sources](references/sources.md).

## Workflow

1. Edit the string in both `en` and `fr`.
2. Normalize it:
   - `’` `‘` `“ ”` become `'` `"`; French quotes are `«\u00A0…\u00A0»`.
   - French: `\u00A0` before `:` and inside `« »`, no space before `; ! ?`.
   - Phone numbers: `1\u2011833\u2011537\u20114342`.
   - [Invisible characters](references/rules.md#escapes) as `\uXXXX` escapes.
3. Keep punctuation in the translation, not JSX, since it differs by language.
4. From the repository root, run `pnpm test frontend/__tests__/.server/locales/typography.test.ts`.
5. List typography fixes to supplied content in the PR description.

## Examples

`{t(($) => $.uploadedOn)}: ` is wrong; put `Téléversé le\u00A0:` in `fr`.
More in [rules](references/rules.md#examples).

## Supplied content

Writers use Word and sometimes AI. Word adds `’`, `“ ”` and raw spaces before
`; ! ?`. Fix characters, spacing and punctuation marks; an em dash may become a
comma since the words stay the same. Flag wording, meaning or grammar issues
in the PR instead of changing them.

## Troubleshooting

- Rule failure: fix that key in the named language.
- `write U+XXXX as an escape`: replace the raw character with `\uXXXX`.
- False phone-number match: ask a maintainer to adjust the pattern; do not
  weaken the test.

## Out of scope

Power Platform JSON resources copy API responses.
