import { useEffect, useId } from 'react';
import type { ComponentProps } from 'react';

import { useErrorSummaryContext } from '~/components/error-summary-context';
import { cn } from '~/utils/tw-utils';

interface InputErrorProps extends OmitStrict<ComponentProps<'div'>, 'children'> {
  /** The ID of the input field associated with the error message. */
  fieldId: string;

  /** The error message to be displayed. */
  message: string;
}

export function InputError({ className, fieldId, message, id, ...props }: InputErrorProps) {
  const errorSummaryContext = useErrorSummaryContext();
  const registrationId = useId();
  const rootId = id ?? registrationId;
  const registerError = errorSummaryContext?.registerError;
  const unregisterError = errorSummaryContext?.unregisterError;

  useEffect(() => {
    registerError?.(registrationId, { fieldId, message });
    return () => {
      unregisterError?.(registrationId);
    };
  }, [fieldId, message, registerError, registrationId, unregisterError]);

  return (
    <div id={rootId} className={cn('w-fit max-w-prose border-l-2 border-red-600 bg-red-50 px-3 py-1', className)} role="alert" {...props}>
      {message}
    </div>
  );
}
