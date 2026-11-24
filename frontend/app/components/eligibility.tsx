import type { ReactNode } from 'react';

import { faCheckCircle, faTimesCircle, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans, useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/card';
import { InlineLink } from '~/components/inline-link';
import { cn } from '~/utils/tw-utils';

export type EligibilityType = 'eligible' | 'ineligible' | 'eligible-proof';

interface EligibilityProps {
  type: EligibilityType;
  title?: string;
  children?: ReactNode;
  className?: string;
}

const eligibilityIcons: Record<EligibilityType, ReactNode> = {
  eligible: <FontAwesomeIcon icon={faCheckCircle} className="text-green-700" />,
  ineligible: <FontAwesomeIcon icon={faTimesCircle} className="text-red-700" />,
  'eligible-proof': <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-700" />,
};

const eligibilityBackgroundColors: Record<EligibilityType, string> = {
  eligible: 'bg-green-50',
  ineligible: 'bg-red-50',
  'eligible-proof': 'bg-amber-50',
};

export function Eligibility(props: EligibilityProps) {
  const { type, title, children, className } = props;
  const { t } = useTranslation('common');

  const mscaLink = <InlineLink to={t(($) => $.eligibility.mscaLink)} className="external-link" newTabIndicator target="_blank" />;

  const defaultContent: Record<EligibilityType, ReactNode> = {
    eligible: (
      <>
        <p>{t(($) => $.eligibility.eligible.description)}</p>
        <Trans ns="common" i18nKey={($) => $.eligibility.eligible.instructions} components={{ mscaLink }} />
      </>
    ),
    ineligible: <p>{t(($) => $.eligibility.ineligible.description)}</p>,
    'eligible-proof': (
      <>
        <p>{t(($) => $.eligibility.eligibleProof.description)}</p>
        <p>{t(($) => $.eligibility.eligibleProof.continue)}</p>
        <Trans ns="common" i18nKey={($) => $.eligibility.eligibleProof.instructions} components={{ mscaLink }} />
      </>
    ),
  };

  const defaultTitles: Record<EligibilityType, string> = {
    eligible: t(($) => $.eligibility.eligible.title),
    ineligible: t(($) => $.eligibility.ineligible.title),
    'eligible-proof': t(($) => $.eligibility.eligibleProof.title),
  };

  return (
    <Card className={cn('gap-2 p-0', className)}>
      <CardHeader className={cn('flex w-full items-center py-2', eligibilityBackgroundColors[type])}>
        <CardTitle className="mb-0 flex w-full items-center justify-between text-base">
          <span>{title ?? defaultTitles[type]}</span>
          {eligibilityIcons[type]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pb-2">{children ?? defaultContent[type]}</CardContent>
    </Card>
  );
}
