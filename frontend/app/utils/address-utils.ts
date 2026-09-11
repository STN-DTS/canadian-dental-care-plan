/**
 * Minimal shape of the i18next selector-style `t` function required to build the
 * address country-change announcement.
 *
 * It is declared as an interface call signature (rather than a function-type
 * property) so it is checked bivariantly. This lets the concrete,
 * namespace-typed `t` functions from different namespaces (e.g. `applicationSpokes`
 * and `protectedApplicationSpokes`), which share the identical
 * `address.addressField` announcement subtree, be passed in without casting.
 */
interface AddressAnnouncementTFunction {
  <TReturn>(
    selector: (resources: {
      address: {
        addressField: {
          countryChangedAnnouncement: string;
          provinceFieldRequiredAnnouncement: string;
          provinceFieldNotRequiredAnnouncement: string;
          postalCodeRequiredAnnouncement: string;
          postalCodeOptionalAnnouncement: string;
        };
      };
    }) => TReturn,
    options?: { country: string },
  ): TReturn;
}

interface BuildAddressCountryChangeAnnouncementParams {
  /** The newly selected country id. */
  countryId: string;
  /** The list of countries used to resolve the selected country's display name. */
  countryList: ReadonlyArray<{ id: string; name: string }>;
  /** The list of regions used to determine whether the selected country has provinces/states. */
  regionList: ReadonlyArray<{ countryId: string }>;
  /** The country ids for which a postal/zip code is required (e.g. Canada, USA). */
  postalCodeRequiredCountryIds: ReadonlyArray<string>;
  /** The namespace-scoped i18next selector `t` function. */
  t: AddressAnnouncementTFunction;
}

/**
 * Builds the assistive-technology announcement describing how the address form
 * changes when the selected country changes.
 *
 * Changing the country updates the province/state field visibility and the
 * postal code field's required state, both of which are otherwise silent DOM
 * changes. Centralizing this logic keeps the translation keys and the business
 * rules (which countries have regions / require a postal code) in a single place
 * shared by every address route.
 *
 * @returns The composed, space-joined announcement string.
 */
export function buildAddressCountryChangeAnnouncement({ countryId, countryList, regionList, postalCodeRequiredCountryIds, t }: BuildAddressCountryChangeAnnouncementParams): string {
  const countryName = countryList.find(({ id }) => id === countryId)?.name;
  const hasRegions = regionList.some((region) => region.countryId === countryId);
  const postalCodeRequired = postalCodeRequiredCountryIds.includes(countryId);

  return [
    t(($) => $.address.addressField.countryChangedAnnouncement, { country: countryName ?? '' }),
    hasRegions ? t(($) => $.address.addressField.provinceFieldRequiredAnnouncement) : t(($) => $.address.addressField.provinceFieldNotRequiredAnnouncement),
    postalCodeRequired ? t(($) => $.address.addressField.postalCodeRequiredAnnouncement) : t(($) => $.address.addressField.postalCodeOptionalAnnouncement),
  ]
    .filter(Boolean)
    .join(' ');
}
