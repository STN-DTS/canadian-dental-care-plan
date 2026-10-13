import { useMatches, useParams, useSearchParams } from 'react-router';

import type { InlineLinkProps } from '~/components/inline-link';
import { InlineLink } from '~/components/inline-link';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { useCurrentLanguage } from '~/hooks';
import { isI18nPageRoute } from '~/routes/routes';
import { findRouteById, getPathById } from '~/utils/route-utils';

type LanguageSwitcherProps = OmitStrict<InlineLinkProps, 'to' | 'reloadDocument'>;

/**
 * Component that can be used to switch from one language to another.
 * (ie: 'en' → 'fr'; 'fr' → 'en')
 */
export function LanguageSwitcher({ children, ...props }: LanguageSwitcherProps) {
  const { altLanguage } = useCurrentLanguage();
  const matches = useMatches();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const currentRoute = matches.at(-1);

  if (!currentRoute) {
    throw new AppError(`No current route found (this should never happen)`, ErrorCodes.ROUTE_NOT_FOUND);
  }

  const routeId = currentRoute.id.replace(/-(en|fr)$/, '');
  const route = findRouteById(routeId);
  const pathname = isI18nPageRoute(route) //
    ? getPathById(routeId, { ...params, lang: altLanguage })
    : switchLanguage(currentRoute.pathname);

  const search = searchParams.toString();

  return (
    <InlineLink reloadDocument to={{ pathname, search }} {...props}>
      {children}
    </InlineLink>
  );
}

/**
 * Switches /en → /fr and vice versa.
 */
function switchLanguage(pathname: string): string {
  return pathname.replace(/^\/(en|fr)/, (substring) => `${substring === '/en' ? '/fr' : '/en'}`);
}
