import { useId } from 'react';
import type { ComponentProps } from 'react';

import { AuthenticityTokenInput } from 'remix-utils/csrf/react';

import { CSRF_FORM_DATA_KEY } from '~/constants/csrf-token';

/**
 * Renders a CSRF token input using the field name expected by server-side validation.
 * Additional input props are passed to the underlying `AuthenticityTokenInput`.
 */
export function CsrfTokenInput(props: OmitStrict<ComponentProps<'input'>, 'type' | 'value'>) {
  const id = useId();
  return <AuthenticityTokenInput id={id} {...props} name={CSRF_FORM_DATA_KEY} />;
}
