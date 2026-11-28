import { createElement, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

import { useTranslation } from 'react-i18next';

import type { AppErrorHandlerMap } from '~/components/app-error-messages';
import { AppErrorMessageLayout, resolveAppErrorMessage } from '~/components/app-error-messages';
import { getActionAppError, getCorrelationId } from '~/errors/error-predicates';
import { cn } from '~/utils/tw-utils';

export type AppErrorAlertProps = Readonly<{
  /** The current route `actionData` or `fetcher.data`. */
  actionData: unknown;
  /** Simple per-page heading override (bypasses `handlers` when `heading` or `children` is supplied). */
  heading?: string;
  /** Simple per-page body content override rendered inside the standard alert layout. */
  children?: ReactNode;
  /** Optional per-page `ErrorCode` overrides layered over global defaults. */
  handlers?: AppErrorHandlerMap;
  /** When true, hides the alert while a retry submission is in flight. */
  isSubmitting?: boolean;
  className?: string;
}>;

/**
 * Top-of-page accessible alert for inline `AppError` responses returned from
 * route actions wrapped with `withActionAppError`.
 *
 * Uses the GOV.UK split-element pattern (`tabIndex={-1}` on the focused outer
 * `<section>` and `role="alert"` on an inner container) so programmatic focus
 * does not race with live-region screen-reader announcements.
 */
export function AppErrorAlert({ actionData, heading, children, handlers, isSubmitting = false, className }: AppErrorAlertProps) {
  const { t } = useTranslation('gcweb');
  const headingId = useId();
  const alertRef = useRef<HTMLElement>(null);
  const lastFocusedActionDataRef = useRef<unknown>(undefined);

  const appError = getActionAppError(actionData);
  const isVisible = appError !== undefined && !isSubmitting;

  useEffect(() => {
    if (!isVisible) {
      lastFocusedActionDataRef.current = undefined;
      return;
    }

    if (lastFocusedActionDataRef.current === actionData) {
      return;
    }

    lastFocusedActionDataRef.current = actionData;
    alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    alertRef.current?.focus({ preventScroll: true });
  }, [actionData, isVisible]);

  if (!isVisible) {
    return null;
  }

  const hasInlineOverride = heading !== undefined || children !== undefined;
  const messageComponent = resolveAppErrorMessage(appError.errorCode, handlers);
  const correlationId = getCorrelationId(appError);

  return (
    <section
      ref={alertRef}
      tabIndex={-1}
      aria-labelledby={headingId}
      className={cn('overflow-hidden rounded-lg border border-t-4 border-gray-300 border-t-red-700 bg-white text-gray-900 shadow-xs focus:ring-2 focus:ring-red-700 focus:ring-offset-2 focus:outline-hidden', className)}
    >
      <div role="alert" aria-atomic="true">
        {hasInlineOverride ? (
          <AppErrorMessageLayout heading={heading ?? t(($) => $.actionError.default.heading)} headingId={headingId}>
            {children ?? (
              <>
                <p className="text-base leading-relaxed text-gray-900">{t(($) => $.actionError.default.body)}</p>
                <p className="mt-2 text-base leading-relaxed text-gray-900">{t(($) => $.actionError.contact)}</p>
              </>
            )}
          </AppErrorMessageLayout>
        ) : (
          createElement(messageComponent, { error: appError, headingId })
        )}
        <dl className="space-y-1 border-t border-gray-200 bg-gray-50 px-5 py-3 text-sm text-gray-700">
          {correlationId !== undefined && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <dt className="font-semibold text-gray-800">{t(($) => $.serverError.correlationId)}</dt>
              <dd className="min-w-0 font-mono wrap-anywhere text-gray-900">{correlationId}</dd>
            </div>
          )}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <dt className="font-semibold text-gray-800">{t(($) => $.serverError.errorCode)}</dt>
            <dd className="min-w-0 font-mono wrap-anywhere text-gray-900">{appError.errorCode}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
