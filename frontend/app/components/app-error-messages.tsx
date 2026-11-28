import { useId } from 'react';
import type { ComponentType, ReactNode } from 'react';

import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';

import type { AppErrorPayload } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import type { ErrorCode } from '~/errors/error-codes';

export type AppErrorMessageProps = Readonly<{
  error: AppErrorPayload;
  headingId?: string;
}>;

export type AppErrorMessageComponent = ComponentType<AppErrorMessageProps>;

export type AppErrorHandlerMap = Readonly<Partial<Record<ErrorCode, AppErrorMessageComponent>>>;

export type AppErrorMessageLayoutProps = Readonly<{
  heading: string;
  headingId?: string;
  children: ReactNode;
}>;

/**
 * Shared header + body layout for inline `AppErrorAlert` messages so custom
 * per-page handlers match the standard alert structure automatically.
 */
export function AppErrorMessageLayout({ heading, headingId, children }: AppErrorMessageLayoutProps) {
  const generatedHeadingId = useId();

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-red-100 bg-red-50 px-5 py-3.5">
        <FontAwesomeIcon icon={faExclamationCircle} aria-hidden="true" className="size-5 shrink-0 text-red-700" />
        <h2 id={headingId ?? generatedHeadingId} className="font-lato text-lg leading-snug font-bold text-gray-900 sm:text-xl">
          {heading}
        </h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </>
  );
}

function AppErrorMessageContent({ heading, body, headingId }: Readonly<{ heading: string; body: string; headingId?: string }>) {
  const { t } = useTranslation('gcweb');

  return (
    <AppErrorMessageLayout heading={heading} headingId={headingId}>
      <p className="text-base leading-relaxed text-gray-900">{body}</p>
      <p className="mt-2 text-base leading-relaxed text-gray-900">{t(($) => $.actionError.contact)}</p>
    </AppErrorMessageLayout>
  );
}

export function DefaultAppErrorMessage({ headingId }: AppErrorMessageProps) {
  const { t } = useTranslation('gcweb');

  return <AppErrorMessageContent heading={t(($) => $.actionError.default.heading)} body={t(($) => $.actionError.default.body)} headingId={headingId} />;
}

export function ApplicationSubmissionErrorMessage({ headingId }: AppErrorMessageProps) {
  const { t } = useTranslation('gcweb');

  return <AppErrorMessageContent heading={t(($) => $.actionError.applicationSubmissionFailed.heading)} body={t(($) => $.actionError.applicationSubmissionFailed.body)} headingId={headingId} />;
}

export function RenewalSubmissionErrorMessage({ headingId }: AppErrorMessageProps) {
  const { t } = useTranslation('gcweb');

  return <AppErrorMessageContent heading={t(($) => $.actionError.renewalSubmissionFailed.heading)} body={t(($) => $.actionError.renewalSubmissionFailed.body)} headingId={headingId} />;
}

/**
 * Global default handlers shared across routes. Per-page `handlers` passed to
 * `<AppErrorAlert>` override matching codes without shadowing entries registered here.
 */
export const defaultAppErrorHandlers: AppErrorHandlerMap = {
  [ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED]: ApplicationSubmissionErrorMessage,
  [ErrorCodes.API_BENEFIT_RENEWAL_CREATE_FAILED]: RenewalSubmissionErrorMessage,
};

/**
 * Resolves the message component for an `ErrorCode` in strict 3-tier order:
 * per-page overrides -> global default handlers -> generic fallback.
 */
export function resolveAppErrorMessage(errorCode: ErrorCode, handlers?: AppErrorHandlerMap, globalHandlers: AppErrorHandlerMap = defaultAppErrorHandlers): AppErrorMessageComponent {
  return handlers?.[errorCode] ?? globalHandlers[errorCode] ?? DefaultAppErrorMessage;
}
