import { None, Some } from 'oxide.ts';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type {
  CountryLocalizedDto,
  FederalGovernmentInsurancePlanLocalizedDto,
  GCCommunicationMethodLocalizedDto,
  LanguageLocalizedDto,
  ProvinceTerritoryStateLocalizedDto,
  ProvincialGovernmentInsurancePlanLocalizedDto,
  SunLifeCommunicationMethodLocalizedDto,
} from '~/.server/domain/dtos';
import type {
  CountryService,
  FederalGovernmentInsurancePlanService,
  GCCommunicationMethodService,
  LanguageService,
  ProvinceTerritoryStateService,
  ProvincialGovernmentInsurancePlanService,
  SunLifeCommunicationMethodService,
} from '~/.server/domain/services';
import { DefaultPublicApplicationStateResolver } from '~/.server/routes/resolvers';

function buildResolver({
  countryService = mock<CountryService>(),
  federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>(),
  gcCommunicationMethodService = mock<GCCommunicationMethodService>(),
  languageService = mock<LanguageService>(),
  provinceTerritoryStateService = mock<ProvinceTerritoryStateService>(),
  provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>(),
  sunLifeCommunicationMethodService = mock<SunLifeCommunicationMethodService>(),
} = {}) {
  return new DefaultPublicApplicationStateResolver(
    countryService,
    federalGovernmentInsurancePlanService,
    gcCommunicationMethodService,
    languageService,
    provinceTerritoryStateService,
    provincialGovernmentInsurancePlanService,
    sunLifeCommunicationMethodService,
  );
}

describe('DefaultPublicApplicationStateResolver', () => {
  describe('resolveCommunicationPreferencesValue', () => {
    const mockLanguage: LanguageLocalizedDto = { id: 'lang-1', code: 'en', name: 'English' };
    const mockSunLifeMethod: SunLifeCommunicationMethodLocalizedDto = { id: 'sl-1', code: 'email', name: 'Email' };
    const mockGCMethod: GCCommunicationMethodLocalizedDto = { id: 'gc-1', code: 'mail', name: 'Mail' };

    it('returns state values with hasChanged=true when user changed preferences', () => {
      const state = {
        communicationPreferences: {
          hasChanged: true,
          value: { preferredLanguage: 'lang-1', preferredMethod: 'sl-1', preferredNotificationMethod: 'gc-1' },
        },
        clientApplication: { communicationPreferences: {} },
      } as const;

      const languageService = mock<LanguageService>();
      const sunLifeCommunicationMethodService = mock<SunLifeCommunicationMethodService>();
      const gcCommunicationMethodService = mock<GCCommunicationMethodService>();

      languageService.getLocalizedLanguageById.mockReturnValue(mockLanguage);
      sunLifeCommunicationMethodService.getLocalizedSunLifeCommunicationMethodById.mockReturnValue(mockSunLifeMethod);
      gcCommunicationMethodService.getLocalizedGCCommunicationMethodById.mockReturnValue(mockGCMethod);

      const resolver = buildResolver({ languageService, sunLifeCommunicationMethodService, gcCommunicationMethodService });
      const result = resolver.resolveCommunicationPreferencesValue(state, 'en');

      expect(result).toEqual({ hasChanged: true, preferredLanguage: mockLanguage, preferredMethodSunLife: mockSunLifeMethod, preferredMethodGovernmentOfCanada: mockGCMethod });
      expect(languageService.getLocalizedLanguageById).toHaveBeenCalledWith('lang-1', 'en');
      expect(sunLifeCommunicationMethodService.getLocalizedSunLifeCommunicationMethodById).toHaveBeenCalledWith('sl-1', 'en');
      expect(gcCommunicationMethodService.getLocalizedGCCommunicationMethodById).toHaveBeenCalledWith('gc-1', 'en');
    });

    it('returns client application values with hasChanged=false when user did not change preferences', () => {
      const state = {
        communicationPreferences: { hasChanged: false },
        clientApplication: {
          communicationPreferences: {
            preferredLanguage: 'lang-2',
            preferredMethodSunLife: 'sl-2',
            preferredMethodGovernmentOfCanada: 'gc-2',
          },
        },
      } as const;

      const languageService = mock<LanguageService>();
      const sunLifeCommunicationMethodService = mock<SunLifeCommunicationMethodService>();
      const gcCommunicationMethodService = mock<GCCommunicationMethodService>();

      languageService.getLocalizedLanguageById.mockReturnValue(mockLanguage);
      sunLifeCommunicationMethodService.getLocalizedSunLifeCommunicationMethodById.mockReturnValue(mockSunLifeMethod);
      gcCommunicationMethodService.getLocalizedGCCommunicationMethodById.mockReturnValue(mockGCMethod);

      const resolver = buildResolver({ languageService, sunLifeCommunicationMethodService, gcCommunicationMethodService });
      const result = resolver.resolveCommunicationPreferencesValue(state, 'en');

      expect(result).toEqual({ hasChanged: false, preferredLanguage: mockLanguage, preferredMethodSunLife: mockSunLifeMethod, preferredMethodGovernmentOfCanada: mockGCMethod });
      expect(languageService.getLocalizedLanguageById).toHaveBeenCalledWith('lang-2', 'en');
      expect(sunLifeCommunicationMethodService.getLocalizedSunLifeCommunicationMethodById).toHaveBeenCalledWith('sl-2', 'en');
      expect(gcCommunicationMethodService.getLocalizedGCCommunicationMethodById).toHaveBeenCalledWith('gc-2', 'en');
    });
  });

  describe('resolvePhoneNumberValue', () => {
    it('returns state phone numbers with hasChanged=true when user changed phone number', () => {
      const state = {
        phoneNumber: { hasChanged: true, value: { primary: '555-1234', alternate: '555-5678' } },
        clientApplication: { contactInformation: { phoneNumber: '555-0000', phoneNumberAlt: '555-0001' } },
      } as const;

      const resolver = buildResolver();
      expect(resolver.resolvePhoneNumberValue(state)).toEqual({ hasChanged: true, primary: '555-1234', alternate: '555-5678' });
    });

    it('returns client application phone numbers with hasChanged=false when user did not change phone number', () => {
      const state = {
        phoneNumber: { hasChanged: false },
        clientApplication: { contactInformation: { phoneNumber: '555-0000', phoneNumberAlt: '555-0001' } },
      } as const;

      const resolver = buildResolver();
      expect(resolver.resolvePhoneNumberValue(state)).toEqual({ hasChanged: false, primary: '555-0000', alternate: '555-0001' });
    });

    it('returns client application phone number without alternate when alt is undefined', () => {
      const state = {
        phoneNumber: { hasChanged: false },
        clientApplication: { contactInformation: { phoneNumber: '555-0000', phoneNumberAlt: undefined } },
      } as const;

      const resolver = buildResolver();
      expect(resolver.resolvePhoneNumberValue(state)).toEqual({ hasChanged: false, primary: '555-0000', alternate: undefined });
    });
  });

  describe('resolveMailingAddressValue', () => {
    const mockCountry: CountryLocalizedDto = { id: 'CA', name: 'Canada' };
    const mockProvince: ProvinceTerritoryStateLocalizedDto = { id: 'ON', countryId: 'CA', abbr: 'ON', name: 'Ontario' };

    it('returns state mailing address with hasChanged=true when user changed address', async () => {
      const state = {
        mailingAddress: {
          hasChanged: true,
          value: { address: '123 Main St', city: 'Ottawa', country: 'CA', postalCode: 'K1A 0A9', province: 'ON' },
        },
        clientApplication: { contactInformation: { mailingAddress: { address: '', city: '', country: '', postalCode: undefined, province: undefined } } },
      } as const;

      const countryService = mock<CountryService>();
      const provinceTerritoryStateService = mock<ProvinceTerritoryStateService>();
      countryService.getLocalizedCountryById.mockResolvedValue(mockCountry);
      provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById.mockResolvedValue(mockProvince);

      const resolver = buildResolver({ countryService, provinceTerritoryStateService });
      const result = await resolver.resolveMailingAddressValue(state, 'en');

      expect(result).toEqual({ hasChanged: true, address: '123 Main St', city: 'Ottawa', country: mockCountry, postalCode: 'K1A 0A9', province: mockProvince });
    });

    it('returns state mailing address without province when province is undefined', async () => {
      const state = {
        mailingAddress: {
          hasChanged: true,
          value: { address: '123 Main St', city: 'Ottawa', country: 'CA', postalCode: undefined, province: undefined },
        },
        clientApplication: { contactInformation: { mailingAddress: { address: '', city: '', country: '', postalCode: undefined, province: undefined } } },
      } as const;

      const countryService = mock<CountryService>();
      const provinceTerritoryStateService = mock<ProvinceTerritoryStateService>();
      countryService.getLocalizedCountryById.mockResolvedValue(mockCountry);

      const resolver = buildResolver({ countryService, provinceTerritoryStateService });
      const result = await resolver.resolveMailingAddressValue(state, 'en');

      expect(result).toEqual({ hasChanged: true, address: '123 Main St', city: 'Ottawa', country: mockCountry, postalCode: undefined, province: undefined });
      expect(provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById).not.toHaveBeenCalled();
    });

    it('returns client application mailing address with hasChanged=false when user did not change address', async () => {
      const state = {
        mailingAddress: { hasChanged: false },
        clientApplication: {
          contactInformation: { mailingAddress: { address: '456 Elm St', city: 'Toronto', country: 'CA', postalCode: 'M5G 2C8', province: 'ON' } },
        },
      } as const;

      const countryService = mock<CountryService>();
      const provinceTerritoryStateService = mock<ProvinceTerritoryStateService>();
      countryService.getLocalizedCountryById.mockResolvedValue(mockCountry);
      provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById.mockResolvedValue(mockProvince);

      const resolver = buildResolver({ countryService, provinceTerritoryStateService });
      const result = await resolver.resolveMailingAddressValue(state, 'en');

      expect(result).toEqual({ hasChanged: false, address: '456 Elm St', city: 'Toronto', country: mockCountry, postalCode: 'M5G 2C8', province: mockProvince });
    });

    it('returns client application mailing address without province when province is undefined', async () => {
      const state = {
        mailingAddress: { hasChanged: false },
        clientApplication: {
          contactInformation: { mailingAddress: { address: '456 Elm St', city: 'Toronto', country: 'CA', postalCode: undefined, province: undefined } },
        },
      } as const;

      const countryService = mock<CountryService>();
      const provinceTerritoryStateService = mock<ProvinceTerritoryStateService>();
      countryService.getLocalizedCountryById.mockResolvedValue(mockCountry);

      const resolver = buildResolver({ countryService, provinceTerritoryStateService });
      const result = await resolver.resolveMailingAddressValue(state, 'en');

      expect(result).toEqual({ hasChanged: false, address: '456 Elm St', city: 'Toronto', country: mockCountry, postalCode: undefined, province: undefined });
      expect(provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById).not.toHaveBeenCalled();
    });
  });

  describe('resolveHomeAddressValue', () => {
    const mockCountry: CountryLocalizedDto = { id: 'CA', name: 'Canada' };
    const mockProvince: ProvinceTerritoryStateLocalizedDto = { id: 'BC', countryId: 'CA', abbr: 'BC', name: 'British Columbia' };

    it('returns state home address with hasChanged=true when user changed address', async () => {
      const state = {
        homeAddress: {
          hasChanged: true,
          value: { address: '789 Oak Ave', city: 'Vancouver', country: 'CA', postalCode: 'V6B 1A1', province: 'BC' },
        },
        clientApplication: { contactInformation: { homeAddress: { address: '', city: '', country: '', postalCode: undefined, province: undefined } } },
      } as const;

      const countryService = mock<CountryService>();
      const provinceTerritoryStateService = mock<ProvinceTerritoryStateService>();
      countryService.getLocalizedCountryById.mockResolvedValue(mockCountry);
      provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById.mockResolvedValue(mockProvince);

      const resolver = buildResolver({ countryService, provinceTerritoryStateService });
      const result = await resolver.resolveHomeAddressValue(state, 'en');

      expect(result).toEqual({ hasChanged: true, address: '789 Oak Ave', city: 'Vancouver', country: mockCountry, postalCode: 'V6B 1A1', province: mockProvince });
    });

    it('returns state home address without province when province is undefined', async () => {
      const state = {
        homeAddress: {
          hasChanged: true,
          value: { address: '789 Oak Ave', city: 'Vancouver', country: 'CA', postalCode: undefined, province: undefined },
        },
        clientApplication: { contactInformation: { homeAddress: { address: '', city: '', country: '', postalCode: undefined, province: undefined } } },
      } as const;

      const countryService = mock<CountryService>();
      const provinceTerritoryStateService = mock<ProvinceTerritoryStateService>();
      countryService.getLocalizedCountryById.mockResolvedValue(mockCountry);

      const resolver = buildResolver({ countryService, provinceTerritoryStateService });
      const result = await resolver.resolveHomeAddressValue(state, 'en');

      expect(result).toEqual({ hasChanged: true, address: '789 Oak Ave', city: 'Vancouver', country: mockCountry, postalCode: undefined, province: undefined });
      expect(provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById).not.toHaveBeenCalled();
    });

    it('returns client application home address with hasChanged=false when user did not change address', async () => {
      const state = {
        homeAddress: { hasChanged: false },
        clientApplication: {
          contactInformation: { homeAddress: { address: '321 Pine Rd', city: 'Calgary', country: 'CA', postalCode: 'T2P 1J9', province: 'BC' } },
        },
      } as const;

      const countryService = mock<CountryService>();
      const provinceTerritoryStateService = mock<ProvinceTerritoryStateService>();
      countryService.getLocalizedCountryById.mockResolvedValue(mockCountry);
      provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById.mockResolvedValue(mockProvince);

      const resolver = buildResolver({ countryService, provinceTerritoryStateService });
      const result = await resolver.resolveHomeAddressValue(state, 'en');

      expect(result).toEqual({ hasChanged: false, address: '321 Pine Rd', city: 'Calgary', country: mockCountry, postalCode: 'T2P 1J9', province: mockProvince });
    });

    it('returns client application home address without province when province is undefined', async () => {
      const state = {
        homeAddress: { hasChanged: false },
        clientApplication: {
          contactInformation: { homeAddress: { address: '321 Pine Rd', city: 'Calgary', country: 'CA', postalCode: undefined, province: undefined } },
        },
      } as const;

      const countryService = mock<CountryService>();
      const provinceTerritoryStateService = mock<ProvinceTerritoryStateService>();
      countryService.getLocalizedCountryById.mockResolvedValue(mockCountry);

      const resolver = buildResolver({ countryService, provinceTerritoryStateService });
      const result = await resolver.resolveHomeAddressValue(state, 'en');

      expect(result).toEqual({ hasChanged: false, address: '321 Pine Rd', city: 'Calgary', country: mockCountry, postalCode: undefined, province: undefined });
      expect(provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById).not.toHaveBeenCalled();
    });
  });

  describe('resolveEmailValue', () => {
    it('returns state email when it is a valid email and emailVerified is true', () => {
      const state = {
        email: 'user@example.com',
        emailVerified: true,
        clientApplication: { contactInformation: { email: 'client@example.com' } },
      } as const;

      const resolver = buildResolver();
      expect(resolver.resolveEmailValue(state)).toBe('user@example.com');
    });

    it('falls back to client application email when state email is undefined', () => {
      const state = {
        email: undefined,
        emailVerified: undefined,
        clientApplication: { contactInformation: { email: 'client@example.com' } },
      } as const;

      const resolver = buildResolver();
      expect(resolver.resolveEmailValue(state)).toBe('client@example.com');
    });

    it('falls back to client application email when state email is invalid', () => {
      const state = {
        email: 'not-a-valid-email',
        emailVerified: true,
        clientApplication: { contactInformation: { email: 'client@example.com' } },
      } as const;

      const resolver = buildResolver();
      expect(resolver.resolveEmailValue(state)).toBe('client@example.com');
    });

    it('falls back to client application email when emailVerified is false', () => {
      const state = {
        email: 'user@example.com',
        emailVerified: false,
        clientApplication: { contactInformation: { email: 'client@example.com' } },
      } as const;

      const resolver = buildResolver();
      expect(resolver.resolveEmailValue(state)).toBe('client@example.com');
    });

    it('returns undefined when both state and client application emails are undefined', () => {
      const state = {
        email: undefined,
        emailVerified: undefined,
        clientApplication: { contactInformation: { email: undefined } },
      } as const;

      const resolver = buildResolver();
      expect(resolver.resolveEmailValue(state)).toBeUndefined();
    });

    it('returns undefined when clientApplication is undefined', () => {
      const state = {
        email: undefined,
        emailVerified: undefined,
        clientApplication: undefined,
      } as const;

      const resolver = buildResolver();
      expect(resolver.resolveEmailValue(state)).toBeUndefined();
    });
  });

  describe('resolveDentalBenefitsValue', () => {
    const mockFederalPlan: FederalGovernmentInsurancePlanLocalizedDto = { id: 'fed-1', name: 'Federal Plan A' };
    const mockProvincialPlan: ProvincialGovernmentInsurancePlanLocalizedDto = { id: 'prov-1', name: 'Provincial Plan B', provinceTerritoryStateId: 'ON' };

    it('returns federal and provincial plans with hasChanged=true when user changed benefits', async () => {
      const state = {
        dentalBenefits: {
          hasChanged: true,
          value: { hasFederalBenefits: true, federalSocialProgram: 'fed-1', hasProvincialTerritorialBenefits: true, provincialTerritorialSocialProgram: 'prov-1', province: 'ON' },
        },
        clientApplication: { dentalBenefits: [] },
      } as const;

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();
      federalGovernmentInsurancePlanService.getLocalizedFederalGovernmentInsurancePlanById.mockResolvedValue(mockFederalPlan);
      provincialGovernmentInsurancePlanService.getLocalizedProvincialGovernmentInsurancePlanById.mockResolvedValue(mockProvincialPlan);

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveDentalBenefitsValue(state, 'en');

      expect(result).toEqual({ hasChanged: true, federalGovernmentInsurancePlan: mockFederalPlan, provincialGovernmentInsurancePlan: mockProvincialPlan });
    });

    it('returns undefined plans with hasChanged=true when both programs are undefined', async () => {
      const state = {
        dentalBenefits: {
          hasChanged: true,
          value: { hasFederalBenefits: false, federalSocialProgram: undefined, hasProvincialTerritorialBenefits: false, provincialTerritorialSocialProgram: undefined, province: undefined },
        },
        clientApplication: { dentalBenefits: [] },
      } as const;

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveDentalBenefitsValue(state, 'en');

      expect(result).toEqual({ hasChanged: true, federalGovernmentInsurancePlan: undefined, provincialGovernmentInsurancePlan: undefined });
      expect(federalGovernmentInsurancePlanService.getLocalizedFederalGovernmentInsurancePlanById).not.toHaveBeenCalled();
      expect(provincialGovernmentInsurancePlanService.getLocalizedProvincialGovernmentInsurancePlanById).not.toHaveBeenCalled();
    });

    it('finds federal plan by benefit ID from client application when hasChanged is false', async () => {
      const state = {
        dentalBenefits: { hasChanged: false },
        clientApplication: { dentalBenefits: ['fed-1'] },
      } as const;

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();
      federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById.mockResolvedValue(Some(mockFederalPlan));
      provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById.mockResolvedValue(None);

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveDentalBenefitsValue(state, 'en');

      expect(result).toEqual({ hasChanged: false, federalGovernmentInsurancePlan: mockFederalPlan, provincialGovernmentInsurancePlan: undefined });
    });

    it('finds provincial plan by benefit ID from client application when hasChanged is false', async () => {
      const state = {
        dentalBenefits: { hasChanged: false },
        clientApplication: { dentalBenefits: ['prov-1'] },
      } as const;

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();
      federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById.mockResolvedValue(None);
      provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById.mockResolvedValue(Some(mockProvincialPlan));

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveDentalBenefitsValue(state, 'en');

      expect(result).toEqual({ hasChanged: false, federalGovernmentInsurancePlan: undefined, provincialGovernmentInsurancePlan: mockProvincialPlan });
    });

    it('returns no plans when benefit ID matches neither federal nor provincial', async () => {
      const state = {
        dentalBenefits: { hasChanged: false },
        clientApplication: { dentalBenefits: ['unknown-1'] },
      } as const;

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();
      federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById.mockResolvedValue(None);
      provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById.mockResolvedValue(None);

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveDentalBenefitsValue(state, 'en');

      expect(result).toEqual({ hasChanged: false, federalGovernmentInsurancePlan: undefined, provincialGovernmentInsurancePlan: undefined });
    });

    it('returns both plans when client application has both federal and provincial benefit IDs', async () => {
      const state = {
        dentalBenefits: { hasChanged: false },
        clientApplication: { dentalBenefits: ['fed-1', 'prov-1'] },
      } as const;

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();
      federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById.mockResolvedValueOnce(Some(mockFederalPlan)).mockResolvedValueOnce(None);
      provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById.mockResolvedValue(Some(mockProvincialPlan));

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveDentalBenefitsValue(state, 'en');

      expect(result).toEqual({ hasChanged: false, federalGovernmentInsurancePlan: mockFederalPlan, provincialGovernmentInsurancePlan: mockProvincialPlan });
    });
  });

  describe('resolveChildDentalBenefitsValue', () => {
    const mockFederalPlan: FederalGovernmentInsurancePlanLocalizedDto = { id: 'fed-1', name: 'Federal Plan A' };
    const mockProvincialPlan: ProvincialGovernmentInsurancePlanLocalizedDto = { id: 'prov-1', name: 'Provincial Plan B', provinceTerritoryStateId: 'ON' };

    it('returns federal and provincial plans with hasChanged=true when user changed child benefits', async () => {
      const childState = {
        dentalBenefits: {
          hasChanged: true,
          value: { hasFederalBenefits: true, federalSocialProgram: 'fed-1', hasProvincialTerritorialBenefits: true, provincialTerritorialSocialProgram: 'prov-1', province: 'ON' },
        },
      } as const;
      const childClientApplication = { dentalBenefits: [] as string[] };

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();
      federalGovernmentInsurancePlanService.getLocalizedFederalGovernmentInsurancePlanById.mockResolvedValue(mockFederalPlan);
      provincialGovernmentInsurancePlanService.getLocalizedProvincialGovernmentInsurancePlanById.mockResolvedValue(mockProvincialPlan);

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveChildDentalBenefitsValue(childState, childClientApplication, 'en');

      expect(result).toEqual({ hasChanged: true, federalGovernmentInsurancePlan: mockFederalPlan, provincialGovernmentInsurancePlan: mockProvincialPlan });
    });

    it('returns undefined plans with hasChanged=true when both programs are undefined', async () => {
      const childState = {
        dentalBenefits: {
          hasChanged: true,
          value: { hasFederalBenefits: false, federalSocialProgram: undefined, hasProvincialTerritorialBenefits: false, provincialTerritorialSocialProgram: undefined, province: undefined },
        },
      } as const;
      const childClientApplication = { dentalBenefits: [] as string[] };

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveChildDentalBenefitsValue(childState, childClientApplication, 'en');

      expect(result).toEqual({ hasChanged: true, federalGovernmentInsurancePlan: undefined, provincialGovernmentInsurancePlan: undefined });
      expect(federalGovernmentInsurancePlanService.getLocalizedFederalGovernmentInsurancePlanById).not.toHaveBeenCalled();
      expect(provincialGovernmentInsurancePlanService.getLocalizedProvincialGovernmentInsurancePlanById).not.toHaveBeenCalled();
    });

    it('finds federal plan by benefit ID from child client application when hasChanged is false', async () => {
      const childState = { dentalBenefits: { hasChanged: false } } as const;
      const childClientApplication = { dentalBenefits: ['fed-1'] };

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();
      federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById.mockResolvedValue(Some(mockFederalPlan));
      provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById.mockResolvedValue(None);

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveChildDentalBenefitsValue(childState, childClientApplication, 'en');

      expect(result).toEqual({ hasChanged: false, federalGovernmentInsurancePlan: mockFederalPlan, provincialGovernmentInsurancePlan: undefined });
    });

    it('finds provincial plan by benefit ID from child client application when hasChanged is false', async () => {
      const childState = { dentalBenefits: { hasChanged: false } } as const;
      const childClientApplication = { dentalBenefits: ['prov-1'] };

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();
      federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById.mockResolvedValue(None);
      provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById.mockResolvedValue(Some(mockProvincialPlan));

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveChildDentalBenefitsValue(childState, childClientApplication, 'en');

      expect(result).toEqual({ hasChanged: false, federalGovernmentInsurancePlan: undefined, provincialGovernmentInsurancePlan: mockProvincialPlan });
    });

    it('returns no plans when benefit ID matches neither federal nor provincial', async () => {
      const childState = { dentalBenefits: { hasChanged: false } } as const;
      const childClientApplication = { dentalBenefits: ['unknown-1'] };

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();
      federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById.mockResolvedValue(None);
      provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById.mockResolvedValue(None);

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveChildDentalBenefitsValue(childState, childClientApplication, 'en');

      expect(result).toEqual({ hasChanged: false, federalGovernmentInsurancePlan: undefined, provincialGovernmentInsurancePlan: undefined });
    });

    it('returns both plans when child client application has both federal and provincial benefit IDs', async () => {
      const childState = { dentalBenefits: { hasChanged: false } } as const;
      const childClientApplication = { dentalBenefits: ['fed-1', 'prov-1'] };

      const federalGovernmentInsurancePlanService = mock<FederalGovernmentInsurancePlanService>();
      const provincialGovernmentInsurancePlanService = mock<ProvincialGovernmentInsurancePlanService>();
      federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById.mockResolvedValueOnce(Some(mockFederalPlan)).mockResolvedValueOnce(None);
      provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById.mockResolvedValue(Some(mockProvincialPlan));

      const resolver = buildResolver({ federalGovernmentInsurancePlanService, provincialGovernmentInsurancePlanService });
      const result = await resolver.resolveChildDentalBenefitsValue(childState, childClientApplication, 'en');

      expect(result).toEqual({ hasChanged: false, federalGovernmentInsurancePlan: mockFederalPlan, provincialGovernmentInsurancePlan: mockProvincialPlan });
    });

    it('throws when childClientApplication is undefined and hasChanged is false', async () => {
      const childState = { dentalBenefits: { hasChanged: false } } as const;

      const resolver = buildResolver();
      await expect(resolver.resolveChildDentalBenefitsValue(childState, undefined, 'en')).rejects.toThrow('Expected child client application to be defined when child dentalBenefits.hasChanged is false');
    });
  });
});
