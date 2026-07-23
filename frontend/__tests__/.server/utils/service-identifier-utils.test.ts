import { describe, expect, it } from 'vitest';

import type { ServiceIdentifier } from '~/.server/constants';
import { assignServiceIdentifiers, serviceIdentifier } from '~/.server/utils/service-identifier-utils';

describe('serviceIdentifier function', () => {
  it('should return a unique symbol when called with an identifier', () => {
    const result = serviceIdentifier('TestService');
    expect(result).toBeTypeOf('symbol');
    expect(String(result)).toBe('Symbol(TestService)');
  });

  it('should return a default symbol when no identifier is provided', () => {
    const result = serviceIdentifier();
    expect(result).toBeTypeOf('symbol');
    expect(String(result)).toBe('Symbol(unknown)');
  });
});

describe('assignServiceIdentifiers function', () => {
  it('should recursively assign unique service identifiers to each key in the types object', () => {
    type CsrfTokenValidatorMock = unknown;
    const TYPES = {
      web: {
        validators: {
          CsrfTokenValidator: Symbol.for('CsrfTokenValidator') as unknown as ServiceIdentifier<CsrfTokenValidatorMock>,
        },
      },
    };

    const serviceIdentifiers = assignServiceIdentifiers(TYPES);

    expect(serviceIdentifiers.web.validators.CsrfTokenValidator).toBeTypeOf('symbol');
    expect(String(serviceIdentifiers.web.validators.CsrfTokenValidator)).toBe('Symbol(web.validators.CsrfTokenValidator)');
  });
});
