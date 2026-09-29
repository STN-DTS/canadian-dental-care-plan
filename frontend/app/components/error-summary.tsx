import { useId } from 'react';
import type { ComponentPropsWithoutRef, JSX } from 'react';

import { useTranslation } from 'react-i18next';

import { AnchorLink } from '~/components/anchor-link';
import { useErrorSummaryContext } from '~/components/error-summary-context';
import { cn } from '~/utils/tw-utils';

/**
 * A component that displays a summary of error messages.
 *
 * This component retrieves error messages from the error summary context
 * using the `useErrorSummaryContext` hook. If there are any errors, it renders
 * a section containing a header and a list of error messages, each linked to
 * the corresponding field using the `AnchorLink` component.
 *
 * @returns A JSX element rendering the error summary section, or `null`
 *          if there are no errors to display.
 */
export function ErrorSummary({ className, id, ...props }: OmitStrict<ComponentPropsWithoutRef<'section'>, 'children' | 'tabIndex'>): JSX.Element | null {
  const { t } = useTranslation('gcweb');
  const generatedId = useId();
  const rootId = id ?? generatedId;
  const errorSummaryContext = useErrorSummaryContext();
  const errors = errorSummaryContext?.errors;

  if (!errors || errors.length === 0) {
    // No errors to display, render nothing.
    return null;
  }

  return (
    <section id={rootId} data-error-summary-id={errorSummaryContext.summaryId} tabIndex={-1} className={cn('my-5 border-4 border-red-600 p-4', className)} {...props}>
      <h2 className="font-lato text-lg font-semibold">{t(($) => $.errorSummary.header, { count: errors.length })}</h2>
      <ul className="mt-1.5 list-disc space-y-2 pl-7">
        {errors.map(({ id, fieldId, message }) => (
          <li key={id}>
            <AnchorLink className="text-red-700 underline hover:decoration-2 focus:decoration-2" anchorElementId={fieldId}>
              {message}
            </AnchorLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
