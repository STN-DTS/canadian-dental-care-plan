import type { ComponentProps, PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import type { AlertType } from '~/components/contextual-alert';
import { ContextualAlert } from '~/components/contextual-alert';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';
import { cn } from '~/utils/tw-utils';

interface ErrorAlertProps extends ComponentProps<'section'> {
  /* Type of alert (eg. 'info', 'warning'; defaults to 'danger') */
  type?: AlertType;
}

export function ErrorAlert({ className, children, type = 'danger', tabIndex = -1, ...props }: ErrorAlertProps) {
  return (
    <section className={cn('mb-4', className)} {...props}>
      <ContextualAlert type={type} role="alert">
        {children}
      </ContextualAlert>
    </section>
  );
}

/**
 * Custom hook for managing the error alert and its focus/scroll behavior
 *
 * @param showErrorAlert Determines if the error alert should be shown. If true, the error alert component will be rendered.
 * @param errorAlertId The optional ID to be assigned to the error alert component used to focus and scroll to the alert (defaults to 'error-alert').
 */
export function useErrorAlert(showErrorAlert: boolean, errorAlertId: string = 'error-alert') {
  const alertRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (alertRef.current && showErrorAlert) {
      alertRef.current.scrollIntoView({ behavior: 'smooth' });
      alertRef.current.focus();

      if (adobeAnalytics.isConfigured()) {
        adobeAnalytics.pushValidationErrorEvent([errorAlertId]);
      }
    }
  }, [errorAlertId, showErrorAlert]);

  const errorAlertComponent = useCallback(
    ({ children }: PropsWithChildren) => {
      return (
        showErrorAlert && (
          <ErrorAlert id={errorAlertId} ref={alertRef}>
            {children}
          </ErrorAlert>
        )
      );
    },
    [errorAlertId, showErrorAlert],
  );

  return {
    errorAlertId,
    ErrorAlert: errorAlertComponent,
  };
}
