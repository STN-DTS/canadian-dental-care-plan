/**
 * The resolved (already-translated) announcement messages used to describe how the
 * address form changes when the selected country changes.
 *
 * Callers supply these from their own i18next namespace, which decouples the
 * business logic below from any particular translation structure. This lets every
 * address route reuse the helper even though they live in different namespaces with
 * different key layouts (e.g. the application spokes use `address.addressField.*`
 * while the profile routes use `homeAddress.*` / `mailingAddress.*`).
 */
interface AddressCountryChangeAnnouncementMessages {
  /** Resolves the "form updated for {country}" message for the given country name. */
  countryChanged: (country: string) => string;
  /** Announced when the selected country has provinces/states (field is shown/required). */
  provinceFieldRequired: string;
  /** Announced when the selected country has no provinces/states (field is removed). */
  provinceFieldNotRequired: string;
  /** Announced when the selected country requires a postal/zip code. */
  postalCodeRequired: string;
  /** Announced when the selected country does not require a postal/zip code. */
  postalCodeOptional: string;
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
  /** The resolved, namespace-specific announcement messages. */
  messages: AddressCountryChangeAnnouncementMessages;
}

/**
 * Builds the assistive-technology announcement describing how the address form
 * changes when the selected country changes.
 *
 * Changing the country updates the province/state field visibility and the
 * postal code field's required state, both of which are otherwise silent DOM
 * changes. Centralizing this logic keeps the business rules (which countries have
 * regions / require a postal code) and the message ordering in a single place
 * shared by every address route.
 *
 * @returns The composed, space-joined announcement string.
 */
export function buildAddressCountryChangeAnnouncement({ countryId, countryList, regionList, postalCodeRequiredCountryIds, messages }: BuildAddressCountryChangeAnnouncementParams): string {
  const countryName = countryList.find(({ id }) => id === countryId)?.name ?? '';
  const hasRegions = regionList.some((region) => region.countryId === countryId);
  const postalCodeRequired = postalCodeRequiredCountryIds.includes(countryId);

  return [
    messages.countryChanged(countryName),
    hasRegions ? messages.provinceFieldRequired : messages.provinceFieldNotRequired,
    postalCodeRequired ? messages.postalCodeRequired : messages.postalCodeOptional,
  ]
    .filter(Boolean)
    .join(' ');
}
