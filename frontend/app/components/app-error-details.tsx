import { useTranslation } from 'react-i18next';

import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { getAppError, getCorrelationId } from '~/errors/error-predicates';
import { cn } from '~/utils/tw-utils';

interface AppErrorDetailsProps {
  error: unknown;
  lng?: string;
  className?: string;
}

export function AppErrorDetails({ error, lng, className }: AppErrorDetailsProps) {
  const { t } = useTranslation('gcweb');
  const correlationId = getCorrelationId(error);
  const errorCode = getAppError(error)?.errorCode;

  if (correlationId === undefined && errorCode === undefined) {
    return null;
  }

  return (
    <DefinitionList layout="single-column" className={cn('mt-6 text-gray-800', className)}>
      {correlationId !== undefined && (
        <DefinitionListItem term={t(($) => $.serverError.correlationId, { lng })}>
          <span className="min-w-0 font-mono wrap-anywhere">{correlationId}</span>
        </DefinitionListItem>
      )}
      {errorCode !== undefined && (
        <DefinitionListItem term={t(($) => $.serverError.errorCode, { lng })}>
          <span className="min-w-0 font-mono wrap-anywhere">{errorCode}</span>
        </DefinitionListItem>
      )}
    </DefinitionList>
  );
}
