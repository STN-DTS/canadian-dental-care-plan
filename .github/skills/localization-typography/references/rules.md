# Character and spacing rules

"Tested" means `typography.test.ts` fails when the rule is broken.

## Escapes

Write invisible or look-alike characters as `\uXXXX` escapes so reviewers can
see them. Raw ones fail the test. Never use `&nbsp;`; i18next renders it
literally.

| Character                                      | Escape                       | Use                                            |
| ---------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| Non-breaking space                             | `\u00A0`                     | Every non-breaking space                       |
| Non-breaking hyphen                            | `\u2011`                     | Phone numbers; short units that must not break |
| En dash                                        | `\u2013`                     | Ranges, if a dash is needed at all             |
| Em dash                                        | `\u2014`                     | Allowed; check whether a comma reads better    |
| Narrow non-breaking space                      | `\u202F`                     | Do not use                                     |
| Thin space, figure space                       | `\u2009`, `\u2007`           | Do not use                                     |
| Soft hyphen                                    | `\u00AD`                     | Do not use                                     |
| Zero-width space, word joiner, byte order mark | `\u200B`, `\u2060`, `\uFEFF` | Do not use                                     |
| Minus sign                                     | `\u2212`                     | Do not use; write `-`                          |

Write a leading or trailing space that matters as `\u0020`
(`"\u0020completed"`). Visible characters with no look-alike (`«`, `»`, `…`,
accented letters) stay raw.

## Both languages

| Context                   | Write                                                              | Tested |
| ------------------------- | ------------------------------------------------------------------ | ------ |
| Apostrophe                | `'`, never `’` or `‘`                                              | Yes    |
| English quotation         | `"…"`, nested `'…'`, never `“ ”`                                   | Yes    |
| Displayed phone number    | `1\u2011833\u2011537\u20114342`; `tel:` targets stay plain         | Yes    |
| Other hyphens             | Plain `-`; `\u2011` only for short units such as `ci\u2011dessous` | No     |
| Number and unit or noun   | `20\u00A0years`, `5\u00A0km`                                       | No     |
| Month and day             | `November\u00A03`, `3\u00A0novembre`                               | No     |
| Label and number          | `Section\u00A05`, `article\u00A05`, `ext.\u00A0123`                | No     |
| Initial or title and name | `M.\u00A0Tremblay`, `J.\u00A0Smith`                                | No     |

## French

| Context           | Write                                           | Tested     |
| ----------------- | ----------------------------------------------- | ---------- |
| Colon             | `Format\u00A0: 12345`                           | Yes        |
| Guillemets        | `«\u00A0Mon dossier\u00A0»`                     | Yes        |
| `;` `!` `?`       | No space before: `Êtes-vous sûr?`               | Yes        |
| Quotation         | `«\u00A0…\u00A0»`, never `"…"` or `“…”`         | `“ ”` only |
| Percent, currency | `25\u00A0%`, `25\u00A0$`                        | No         |
| Thousands         | `1\u00A0000`, but not SIN, years or identifiers | No         |
| Time              | `13\u00A0h\u00A030`                             | No         |

## Examples

| Supplied             | Write                                                            |
| -------------------- | ---------------------------------------------------------------- |
| `Vous avez soumis :` | `Vous avez soumis\u00A0:`                                        |
| `« Mon dossier »`    | `«\u00A0Mon dossier\u00A0»`                                      |
| `Êtes-vous sûr ?`    | `Êtes-vous sûr?`                                                 |
| `Click “Back”`       | `Click "Back"`                                                   |
| `l’adresse`          | `l'adresse`                                                      |
| `{{amount}} $`       | `{{amount}}\u00A0$`                                              |
| `1-833-537-4342`     | `1\u2011833\u2011537\u20114342`                                  |
| `<dt>{t(…)}: </dt>`  | Colon in the string: en `Uploaded on:`, fr `Téléversé le\u00A0:` |
