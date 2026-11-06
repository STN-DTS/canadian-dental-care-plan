import { expect, test } from 'vitest';

import { maskApplicationConfirmationCode } from '~/.server/logging/mask-application-confirmation-code';

test.each([
  ['12345678', '1234****'],
  ['1234 5678', '1234 ****'],
  ['1234-56-78', '1234-**-**'],
  ['APP-12345678-X', 'APP-1234****-X'],
  ['1234', '****'],
  ['123', '***'],
  ['1', '*'],
  ['', ''],
])('masks the last four confirmation-code digits: %s', (code, expected) => {
  expect(maskApplicationConfirmationCode(code)).toBe(expected);
});
