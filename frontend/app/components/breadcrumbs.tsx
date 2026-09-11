import type { ComponentProps, ReactNode } from 'react';

import { useParams } from 'react-router';
import type { To } from 'react-router';

import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import type { SetOptional } from 'type-fest';

import { InlineLink } from '~/components/inline-link';
import { getClientEnv } from '~/utils/env-utils';

interface BreadcrumbsProps {
  className?: string;
  items: Array<{ content: string; routeId?: string; to?: To }>;
}

export function Breadcrumbs({ className, items }: BreadcrumbsProps) {
  const { t } = useTranslation('gcweb');

  return (
    <nav id="wb-bc" className={className} property="breadcrumb" aria-labelledby="breadcrumbs">
      <h2 id="breadcrumbs" className="sr-only">
        {t(($) => $.breadcrumbs.youAreHere)}
      </h2>
      <div className="container">
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-1" typeof="BreadcrumbList">
          {items.map(({ content, routeId, to }, idx) => {
            return (
              <li key={content} property="itemListElement" typeof="ListItem" className="flex items-center">
                {idx !== 0 && <FontAwesomeIcon icon={faChevronRight} className="mr-2 size-3 text-slate-700" />}
                <Breadcrumb routeId={routeId} to={to}>
                  {content}
                </Breadcrumb>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

function Breadcrumb({ children, routeId, to }: { children: ReactNode; routeId?: string; to?: To }) {
  const params = useParams();

  // oxfmt-ignore
  return routeId === undefined && to === undefined
    ? <span property="name">{children}</span>
    : <InlineLink routeId={routeId} params={params} to={to} property="item" typeof="WebPage"><span property="name">{children}</span></InlineLink>;
}

export function ProtectedBreadcrumbs({ items, ...props }: SetOptional<ComponentProps<typeof Breadcrumbs>, 'items'>) {
  const { t } = useTranslation('gcweb');
  const { SCCH_BASE_URI } = getClientEnv();

  return (
    <Breadcrumbs
      {...props}
      items={[
        {
          content: t(($) => $.breadcrumbs.dashboard),
          to: t(($) => $.header.menuDashboardHref, { baseUri: SCCH_BASE_URI }),
        },
        ...(items ?? []),
      ]}
    />
  );
}

export function PublicBreadcrumbs(props: OmitStrict<ComponentProps<typeof Breadcrumbs>, 'items'>) {
  const { t } = useTranslation('gcweb');
  return (
    <Breadcrumbs
      {...props}
      items={[
        {
          content: t(($) => $.breadcrumbs.canadaCa),
          to: t(($) => $.breadcrumbs.canadaCaUrl),
        },
        {
          content: t(($) => $.breadcrumbs.benefits),
          to: t(($) => $.breadcrumbs.benefitsUrl),
        },
        {
          content: t(($) => $.breadcrumbs.dentalCoverage),
          to: t(($) => $.breadcrumbs.dentalCoverageUrl),
        },
        {
          content: t(($) => $.breadcrumbs.canadianDentalCarePlan),
          to: t(($) => $.breadcrumbs.canadianDentalCarePlanUrl),
        },
      ]}
    />
  );
}
