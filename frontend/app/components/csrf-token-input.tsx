import { useId } from 'react';
import type { ComponentProps } from 'react';

import { AuthenticityTokenInput } from 'remix-utils/csrf/react';

import { useCsrfToken } from '~/root';

export function CsrfTokenInput(props: OmitStrict<ComponentProps<'input'>, 'type' | 'value'>) {
  const id = useId();
  const csrfToken = useCsrfToken();
  return (
    <>
      <AuthenticityTokenInput />
      <input id={id} value={csrfToken} {...props} name="_csrf" type="hidden" />
    </>
  );
}
