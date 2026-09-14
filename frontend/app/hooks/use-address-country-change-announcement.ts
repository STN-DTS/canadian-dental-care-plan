import { useCallback } from 'react';

import { announce } from '@react-aria/live-announcer';
import { useTranslation } from 'react-i18next';

import { buildAddressCountryChangeAnnouncement } from '~/utils/address-utils';

interface AnnounceAddressCountryChangeParams {
  /** The newly selected country id. */
  countryId: string;
  /** The list of countries used to resolve the selected country's display name. */
  countryList: ReadonlyArray<{ id: string; name: string }>;
  /** The list of regions used to determine whether the selected country has provinces/states. */
  regionList: ReadonlyArray<{ countryId: string }>;
  /** The country ids for which a postal/zip code is required (e.g. Canada, USA). */
  postalCodeRequiredCountryIds: ReadonlyArray<string>;
}

/**
 * Returns a callback that announces—via an assistive-technology live region—how the
 * address form changes when the selected country changes.
 *
 * Changing the country updates the province/state field visibility and the postal
 * code field's required state, both of which are otherwise silent DOM changes. The
 * announcement text is resolved from the shared `common` namespace so every address
 * route (application spokes and profile) produces a consistent message without
 * wiring up its own translation keys.
 *
 * @returns A stable callback that builds and politely announces the country-change message.
 */
export function useAddressCountryChangeAnnouncement(): (params: AnnounceAddressCountryChangeParams) => void {
  const { t } = useTranslation('common');

  return useCallback(
    ({ countryId, countryList, regionList, postalCodeRequiredCountryIds }: AnnounceAddressCountryChangeParams) => {
      const announcement = buildAddressCountryChangeAnnouncement({
        countryId,
        countryList,
        regionList,
        postalCodeRequiredCountryIds,
        messages: {
          countryChanged: (country) => t(($) => $.address.countryChangedAnnouncement, { country }),
          provinceFieldRequired: t(($) => $.address.provinceFieldRequiredAnnouncement),
          provinceFieldNotRequired: t(($) => $.address.provinceFieldNotRequiredAnnouncement),
          postalCodeRequired: t(($) => $.address.postalCodeRequiredAnnouncement),
          postalCodeOptional: t(($) => $.address.postalCodeOptionalAnnouncement),
        },
      });

      announce(announcement, 'polite');
    },
    [t],
  );
}
