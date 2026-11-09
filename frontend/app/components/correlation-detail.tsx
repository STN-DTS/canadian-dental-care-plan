import { Trans } from 'react-i18next';

import { getCorrelationId } from '~/errors/error-predicates';
import { cn } from '~/utils/tw-utils';

interface CorrelationDetailProps {
  error: unknown;
  lng?: string;
  className?: string;
}

export function CorrelationDetail({ error, lng, className }: CorrelationDetailProps) {
  const correlationId = getCorrelationId(error);

  if (correlationId === undefined) {
    return null;
  }

  return (
    <p className={cn('mt-6 wrap-anywhere text-gray-800', className)}>
      <Trans ns="gcweb" tOptions={{ lng }} i18nKey={($) => $.serverError.correlationId} components={{ span: <span className="font-mono select-text" />, strong: <strong className="font-semibold" /> }} values={{ correlationId }} />
    </p>
  );
}
