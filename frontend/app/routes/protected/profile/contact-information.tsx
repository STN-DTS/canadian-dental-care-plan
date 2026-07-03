import { faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';

import type { Route } from './+types/contact-information';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { Address } from '~/components/address';
import type { AddressDetails } from '~/components/address';
import { AppPageTitle } from '~/components/app-page-title';
import { Badge } from '~/components/badge';
import { ButtonLink } from '~/components/buttons';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { InlineLink } from '~/components/inline-link';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['protectedProfile', 'gcweb'],
  pageIdentifier: pageIds.protected.profile.contactInformation,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, request, session });

  const t = await getFixedT(request, ['protectedProfile', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.contactInformation.pageTitle) }),
  };
  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const locale = getLocale(request);

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.profile.contact-information', { userId: idToken.sub });

  const provinceTerritoryStateService = appContainer.get(TYPES.ProvinceTerritoryStateService);
  const countryService = appContainer.get(TYPES.CountryService);

  const mailingAddressProvince = clientApplication.contactInformation.mailingAddress.province ? await provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById(clientApplication.contactInformation.mailingAddress.province, locale) : undefined;
  const mailingAddressCountry = clientApplication.contactInformation.mailingAddress.country ? await countryService.getLocalizedCountryById(clientApplication.contactInformation.mailingAddress.country, locale) : undefined;
  const mailingAddressDetails: AddressDetails = {
    address: clientApplication.contactInformation.mailingAddress.address,
    apartment: clientApplication.contactInformation.mailingAddress.apartment,
    city: clientApplication.contactInformation.mailingAddress.city,
    provinceState: mailingAddressProvince?.name,
    postalZipCode: clientApplication.contactInformation.mailingAddress.postalCode,
    country: mailingAddressCountry?.name ?? '',
  };

  const homeAddressProvince = clientApplication.contactInformation.homeAddress?.province ? await provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById(clientApplication.contactInformation.homeAddress.province, locale) : undefined;
  const homeAddressCountry = clientApplication.contactInformation.homeAddress?.country ? await countryService.getLocalizedCountryById(clientApplication.contactInformation.homeAddress.country, locale) : undefined;
  const homeAddressDetails: AddressDetails | undefined = clientApplication.contactInformation.homeAddress
    ? {
        address: clientApplication.contactInformation.homeAddress.address,
        apartment: clientApplication.contactInformation.homeAddress.apartment,
        city: clientApplication.contactInformation.homeAddress.city,
        provinceState: homeAddressProvince?.name,
        postalZipCode: clientApplication.contactInformation.homeAddress.postalCode,
        country: homeAddressCountry?.name ?? '',
      }
    : undefined;

  return {
    meta,
    phoneNumber: clientApplication.contactInformation.phoneNumber,
    altPhoneNumber: clientApplication.contactInformation.phoneNumberAlt,
    emailAddress: clientApplication.contactInformation.email,
    emailAddressVerified: clientApplication.contactInformation.emailVerified,
    mailingAddressDetails,
    homeAddressDetails,
    SCCH_BASE_URI,
  };
}

export default function ViewContactInformation({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedProfile', 'gcweb']);
  const { phoneNumber, altPhoneNumber, emailAddress, mailingAddressDetails, homeAddressDetails, SCCH_BASE_URI } = loaderData;

  const emailVerificationStatus = loaderData.emailAddress ? (loaderData.emailAddressVerified ? 'verified' : 'unverified') : undefined;

  return (
    <>
      <AppPageTitle>{t(($) => $.contactInformation.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-10">
        <DefinitionList border>
          <DefinitionListItem term={t(($) => $.contactInformation.phoneNumber)} className="border-none pb-0 sm:pb-0">
            {phoneNumber ?? t(($) => $.none)}
          </DefinitionListItem>
          <DefinitionListItem term={t(($) => $.contactInformation.altPhoneNumber)}>
            <p>{altPhoneNumber ?? t(($) => $.none)}</p>
            <div className="mt-4 sm:mt-6">
              <InlineLink id="update-contact-information-phone" routeId="protected/profile/contact/phone" params={params}>
                {t(($) => $.contactInformation.updatePhoneLinkText)}
              </InlineLink>
            </div>
          </DefinitionListItem>
          <DefinitionListItem term={t(($) => $.contactInformation.email)}>
            <p>{emailAddress ?? t(($) => $.none)}</p>
            {emailVerificationStatus && (
              <Badge asChild size="lg" variant={emailVerificationStatus === 'unverified' ? 'warning' : 'success'}>
                <p className="mt-3">
                  <FontAwesomeIcon icon={emailVerificationStatus === 'unverified' ? faExclamationTriangle : faCheckCircle} />
                  {t(($) => $.contactInformation.emailVerificationStatus[emailVerificationStatus])}
                </p>
              </Badge>
            )}
            <div className="mt-4 sm:mt-6">
              <InlineLink id="update-contact-information-email" routeId="protected/profile/contact/email-address" params={params}>
                {t(($) => $.contactInformation.updateEmailLinkText)}
              </InlineLink>
            </div>
          </DefinitionListItem>
          <DefinitionListItem term={t(($) => $.contactInformation.mailingAddress)}>
            <Address address={mailingAddressDetails} />
            <div className="mt-4 sm:mt-6">
              <InlineLink id="update-contact-information-mailing-address" routeId="protected/profile/contact/mailing-address" params={params}>
                {t(($) => $.contactInformation.updateMailingAddressLinkText)}
              </InlineLink>
            </div>
          </DefinitionListItem>
          <DefinitionListItem term={t(($) => $.contactInformation.homeAddress)}>
            {homeAddressDetails && <Address address={homeAddressDetails} />}
            <div className="mt-4 sm:mt-6">
              <InlineLink id="update-contact-information-home-address" routeId="protected/profile/contact/home-address" params={params}>
                {t(($) => $.contactInformation.updateHomeAddressLinkText)}
              </InlineLink>
            </div>
          </DefinitionListItem>
        </DefinitionList>
        <ButtonLink
          variant="primary"
          id="back-button"
          to={t(($) => $.header.menuDashboardHref, {
            baseUri: SCCH_BASE_URI,
            ns: 'gcweb',
          })}
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Return to dashboard - My contact information return button click"
        >
          {t(($) => $.contactInformation.returnButton)}
        </ButtonLink>
      </div>
    </>
  );
}
