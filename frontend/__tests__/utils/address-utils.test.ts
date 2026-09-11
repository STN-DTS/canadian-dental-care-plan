import { describe, expect, it } from 'vitest';

import { buildAddressCountryChangeAnnouncement } from '~/utils/address-utils';

const CANADA = 'canada';
const USA = 'usa';
const FRANCE = 'france';
const UNKNOWN = 'atlantis';

const countryList = [
  { id: CANADA, name: 'Canada' },
  { id: USA, name: 'United States' },
  { id: FRANCE, name: 'France' },
];

const regionList = [
  { countryId: CANADA },
  { countryId: USA },
  // note: no regions for FRANCE
];

const postalCodeRequiredCountryIds = [CANADA, USA];

const messages = {
  countryChanged: (country: string) => `Updated for ${country}.`,
  provinceFieldRequired: 'Province required.',
  provinceFieldNotRequired: 'Province not required.',
  postalCodeRequired: 'Postal code required.',
  postalCodeOptional: 'Postal code optional.',
};

describe('buildAddressCountryChangeAnnouncement', () => {
  it('resolves the selected country name for the country-changed message', () => {
    const result = buildAddressCountryChangeAnnouncement({
      countryId: CANADA,
      countryList,
      regionList,
      postalCodeRequiredCountryIds,
      messages,
    });

    expect(result).toContain('Updated for Canada.');
  });

  it('uses an empty country name when the country id is not found', () => {
    const result = buildAddressCountryChangeAnnouncement({
      countryId: UNKNOWN,
      countryList,
      regionList,
      postalCodeRequiredCountryIds,
      messages,
    });

    expect(result).toContain('Updated for .');
  });

  it('announces the province field as required when the country has regions', () => {
    const result = buildAddressCountryChangeAnnouncement({
      countryId: CANADA,
      countryList,
      regionList,
      postalCodeRequiredCountryIds,
      messages,
    });

    expect(result).toContain('Province required.');
    expect(result).not.toContain('Province not required.');
  });

  it('announces the province field as not required when the country has no regions', () => {
    const result = buildAddressCountryChangeAnnouncement({
      countryId: FRANCE,
      countryList,
      regionList,
      postalCodeRequiredCountryIds,
      messages,
    });

    expect(result).toContain('Province not required.');
    expect(result).not.toContain('Province required.');
  });

  it('announces the postal code as required when the country is in the postal-required list', () => {
    const result = buildAddressCountryChangeAnnouncement({
      countryId: USA,
      countryList,
      regionList,
      postalCodeRequiredCountryIds,
      messages,
    });

    expect(result).toContain('Postal code required.');
    expect(result).not.toContain('Postal code optional.');
  });

  it('announces the postal code as optional when the country is not in the postal-required list', () => {
    const result = buildAddressCountryChangeAnnouncement({
      countryId: FRANCE,
      countryList,
      regionList,
      postalCodeRequiredCountryIds,
      messages,
    });

    expect(result).toContain('Postal code optional.');
    expect(result).not.toContain('Postal code required.');
  });

  it('composes the three messages in order, space-joined', () => {
    const result = buildAddressCountryChangeAnnouncement({
      countryId: CANADA,
      countryList,
      regionList,
      postalCodeRequiredCountryIds,
      messages,
    });

    expect(result).toBe('Updated for Canada. Province required. Postal code required.');
  });

  it('composes the not-required branches for a country with no regions and no postal code', () => {
    const result = buildAddressCountryChangeAnnouncement({
      countryId: FRANCE,
      countryList,
      regionList,
      postalCodeRequiredCountryIds,
      messages,
    });

    expect(result).toBe('Updated for France. Province not required. Postal code optional.');
  });

  it('omits empty messages from the composed announcement', () => {
    const result = buildAddressCountryChangeAnnouncement({
      countryId: FRANCE,
      countryList,
      regionList,
      postalCodeRequiredCountryIds,
      messages: {
        ...messages,
        provinceFieldNotRequired: '',
      },
    });

    expect(result).toBe('Updated for France. Postal code optional.');
  });
});
