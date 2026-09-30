import { useId } from 'react';
import type { ComponentPropsWithoutRef, JSX } from 'react';

import { useTranslation } from 'react-i18next';

import { AnchorLink } from '~/components/anchor-link';
import { useErrorSummaryContext } from '~/components/error-summary-context';
import { cn } from '~/utils/tw-utils';

/**
 * Renders links to the nearest provider's currently registered field errors.
 *
 * Preserves the provider's display order and uses registration IDs as list keys,
 * so several messages can link to the same field. The localized heading counts
 * messages rather than distinct fields. Nothing renders without a provider or
 * when its registry is empty.
 *
 * The section is programmatically focusable without adding a tab stop. Its
 * provider data attribute remains independent of a caller-supplied DOM ID,
 * allowing validation effects to locate it regardless of that ID.
 *
 * @param className Additional CSS classes merged with the summary's styles.
 * @param id Optional section DOM ID; defaults to a React-generated ID.
 * @param props Other native section attributes forwarded to the root element.
 * @returns The error summary section, or null when no registered errors exist.
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
