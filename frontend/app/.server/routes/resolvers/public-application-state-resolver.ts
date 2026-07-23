import { invariant } from '@dts-stn/invariant';
import { inject, injectable } from 'inversify';
import type { PickDeep, SetRequired } from 'type-fest';
import validator from 'validator';

import { TYPES } from '~/.server/constants';
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
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import type { PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';

export interface PublicApplicationStateResolver {
  /**
   * Resolves the effective communication preferences value for a public application state.
   * If the user has declared a change, the updated values from the state are used;
   * otherwise, the values are sourced from the client application data.
   *
   * @param state - The public application state containing communication preferences and client application data.
   * @param locale - The locale used to retrieve localized values.
   * @returns The resolved preferred language, Sun Life communication method, and Government of Canada communication method.
   */
  resolveCommunicationPreferencesValue(
    state: SetRequired<PickDeep<PublicApplicationState, 'communicationPreferences' | 'clientApplication.communicationPreferences'>, 'communicationPreferences'>,
    locale: AppLocale,
  ): {
    hasChanged: boolean;
    preferredLanguage: LanguageLocalizedDto;
    preferredMethodSunLife: SunLifeCommunicationMethodLocalizedDto;
    preferredMethodGovernmentOfCanada: GCCommunicationMethodLocalizedDto;
  };

  /**
   * Resolves the effective phone number value for a public application state.
   * If the user has declared a change, the updated values from the state are used;
   * otherwise, the values are sourced from the client application data.
   *
   * @param state - The public application state containing phone number and client application contact information.
   * @returns The resolved primary phone number and optional alternate phone number.
   */
  resolvePhoneNumberValue(state: SetRequired<PickDeep<PublicApplicationState, 'phoneNumber' | 'clientApplication.contactInformation.phoneNumber' | 'clientApplication.contactInformation.phoneNumberAlt'>, 'phoneNumber'>): {
    hasChanged: boolean;
    primary: string;
    alternate?: string;
  };

  /**
   * Resolves the effective mailing address value for a public application state.
   * If the user has declared a change, the updated values from the state are used;
   * otherwise, the values are sourced from the client application data.
   *
   * @param state - The public application state containing mailing address and client application contact information.
   * @param locale - The locale used to retrieve localized country and province/territory values.
   * @returns The resolved mailing address including address, city, country, and optional postal code and province.
   */
  resolveMailingAddressValue(
    state: SetRequired<
      PickDeep<
        PublicApplicationState,
        | 'mailingAddress'
        | 'clientApplication.contactInformation.mailingAddress.address'
        | 'clientApplication.contactInformation.mailingAddress.city'
        | 'clientApplication.contactInformation.mailingAddress.country'
        | 'clientApplication.contactInformation.mailingAddress.postalCode'
        | 'clientApplication.contactInformation.mailingAddress.province'
      >,
      'mailingAddress'
    >,
    locale: AppLocale,
  ): Promise<{
    hasChanged: boolean;
    address: string;
    city: string;
    country: CountryLocalizedDto;
    postalCode?: string;
    province?: ProvinceTerritoryStateLocalizedDto;
  }>;

  /**
   * Resolves the effective home address value for a public application state.
   * If the user has declared a change, the updated values from the state are used;
   * otherwise, the values are sourced from the client application data.
   *
   * @param state - The public application state containing home address and client application contact information.
   * @param locale - The locale used to retrieve localized country and province/territory values.
   * @returns The resolved home address including address, city, country, and optional postal code and province.
   */
  resolveHomeAddressValue(
    state: SetRequired<
      PickDeep<
        PublicApplicationState,
        | 'homeAddress'
        | 'clientApplication.contactInformation.homeAddress.address'
        | 'clientApplication.contactInformation.homeAddress.city'
        | 'clientApplication.contactInformation.homeAddress.country'
        | 'clientApplication.contactInformation.homeAddress.postalCode'
        | 'clientApplication.contactInformation.homeAddress.province'
      >,
      'homeAddress'
    >,
    locale: AppLocale,
  ): Promise<{
    hasChanged: boolean;
    address: string;
    city: string;
    country: CountryLocalizedDto;
    postalCode?: string;
    province?: ProvinceTerritoryStateLocalizedDto;
  }>;

  /**
   * Resolves the effective email value for a public application state.
   * The state email takes precedence over the client application email on file,
   * but only if it is a valid email address and has been verified by the user (`emailVerified === true`).
   * If the state email is absent, invalid, or unverified, the client application email is returned instead.
   *
   * @param state - The public application state containing the optional email, emailVerified flag, and client application contact information.
   * @returns The resolved email address, or `undefined` if neither is available.
   */
  resolveEmailValue(state: PickDeep<PublicApplicationState, 'email' | 'emailVerified' | 'clientApplication.contactInformation.email'>): string | undefined;

  /**
   * Resolves the effective dental benefits value for a public application state.
   * If the user has declared a change, the updated federal and provincial program selections from the state
   * are used; otherwise, the benefit IDs from the client application are matched against both federal
   * and provincial insurance plan services to determine the applicable plans.
   *
   * @param state - The public application state containing dental benefits and client application dental benefits.
   * @param locale - The locale used to retrieve localized insurance plan details.
   * @returns The resolved federal and provincial government insurance plans, each of which may be `undefined` if not applicable.
   */
  resolveDentalBenefitsValue(
    state: SetRequired<PickDeep<PublicApplicationState, 'dentalBenefits' | 'clientApplication.dentalBenefits'>, 'dentalBenefits'>,
    locale: AppLocale,
  ): Promise<{
    hasChanged: boolean;
    federalGovernmentInsurancePlan?: FederalGovernmentInsurancePlanLocalizedDto;
    provincialGovernmentInsurancePlan?: ProvincialGovernmentInsurancePlanLocalizedDto;
  }>;

  /**
   * Resolves the effective child dental benefits value for a public application state.
   * If the user has declared a change, the updated federal and provincial program selections from the state
   * are used; otherwise, the benefit IDs from the client application are matched against both federal
   * and provincial insurance plan services to determine the applicable plans.
   *
   * @param childState - The public application state containing child dental benefits and client application child dental benefits.
   * @param childClientApplication - The child's client application data containing dental benefit IDs, or `undefined` if not available.
   * @param locale - The locale used to retrieve localized insurance plan details.
   * @returns The resolved federal and provincial government insurance plans, each of which may be `undefined` if not applicable.
   */
  resolveChildDentalBenefitsValue(
    childState: Required<Pick<PublicApplicationState['children'][number], 'dentalBenefits'>>,
    childClientApplication: Pick<NonNullable<PublicApplicationState['clientApplication']>['children'][number], 'dentalBenefits'> | undefined,
    locale: AppLocale,
  ): Promise<{
    hasChanged: boolean;
    federalGovernmentInsurancePlan?: FederalGovernmentInsurancePlanLocalizedDto;
    provincialGovernmentInsurancePlan?: ProvincialGovernmentInsurancePlanLocalizedDto;
  }>;
}

@injectable()
export class DefaultPublicApplicationStateResolver implements PublicApplicationStateResolver {
  private readonly log: Logger;
  private readonly countryService: CountryService;
  private readonly federalGovernmentInsurancePlanService: FederalGovernmentInsurancePlanService;
  private readonly gcCommunicationMethodService: GCCommunicationMethodService;
  private readonly languageService: LanguageService;
  private readonly provinceTerritoryStateService: ProvinceTerritoryStateService;
  private readonly provincialGovernmentInsurancePlanService: ProvincialGovernmentInsurancePlanService;
  private readonly sunLifeCommunicationMethodService: SunLifeCommunicationMethodService;

  constructor(
    @inject(TYPES.CountryService) countryService: CountryService,
    @inject(TYPES.FederalGovernmentInsurancePlanService) federalGovernmentInsurancePlanService: FederalGovernmentInsurancePlanService,
    @inject(TYPES.GCCommunicationMethodService) gcCommunicationMethodService: GCCommunicationMethodService,
    @inject(TYPES.LanguageService) languageService: LanguageService,
    @inject(TYPES.ProvinceTerritoryStateService) provinceTerritoryStateService: ProvinceTerritoryStateService,
    @inject(TYPES.ProvincialGovernmentInsurancePlanService) provincialGovernmentInsurancePlanService: ProvincialGovernmentInsurancePlanService,
    @inject(TYPES.SunLifeCommunicationMethodService) sunLifeCommunicationMethodService: SunLifeCommunicationMethodService,
  ) {
    this.log = createLogger('DefaultPublicApplicationStateResolver');
    this.countryService = countryService;
    this.federalGovernmentInsurancePlanService = federalGovernmentInsurancePlanService;
    this.gcCommunicationMethodService = gcCommunicationMethodService;
    this.languageService = languageService;
    this.provinceTerritoryStateService = provinceTerritoryStateService;
    this.provincialGovernmentInsurancePlanService = provincialGovernmentInsurancePlanService;
    this.sunLifeCommunicationMethodService = sunLifeCommunicationMethodService;
  }

  resolveCommunicationPreferencesValue(
    state: SetRequired<PickDeep<PublicApplicationState, 'communicationPreferences' | 'clientApplication.communicationPreferences'>, 'communicationPreferences'>,
    locale: AppLocale,
  ): {
    hasChanged: boolean;
    preferredLanguage: LanguageLocalizedDto;
    preferredMethodSunLife: SunLifeCommunicationMethodLocalizedDto;
    preferredMethodGovernmentOfCanada: GCCommunicationMethodLocalizedDto;
  } {
    this.log.debug('Resolving communication preferences value');

    if (state.communicationPreferences.hasChanged) {
      return {
        hasChanged: true,
        preferredLanguage: this.languageService.getLocalizedLanguageById(state.communicationPreferences.value.preferredLanguage, locale),
        preferredMethodSunLife: this.sunLifeCommunicationMethodService.getLocalizedSunLifeCommunicationMethodById(state.communicationPreferences.value.preferredMethod, locale),
        preferredMethodGovernmentOfCanada: this.gcCommunicationMethodService.getLocalizedGCCommunicationMethodById(state.communicationPreferences.value.preferredNotificationMethod, locale),
      };
    }

    // If hasChanged is false, client application communication preferences must be defined, as the value would have
    // been set on the state when the user made a change to the communication preferences step, which requires client
    // application communication preferences to be defined.
    invariant(state.clientApplication, 'Expected clientApplication to be defined when communicationPreferences.hasChanged is false');
    invariant(state.clientApplication.communicationPreferences.preferredLanguage, 'Expected clientApplication.communicationPreferences.preferredLanguage to be defined when communicationPreferences.hasChanged is false');
    invariant(state.clientApplication.communicationPreferences.preferredMethodSunLife, 'Expected clientApplication.communicationPreferences.preferredMethodSunLife to be defined when communicationPreferences.hasChanged is false');
    invariant(state.clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada, 'Expected clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada to be defined when communicationPreferences.hasChanged is false');

    return {
      hasChanged: false,
      preferredLanguage: this.languageService.getLocalizedLanguageById(state.clientApplication.communicationPreferences.preferredLanguage, locale),
      preferredMethodSunLife: this.sunLifeCommunicationMethodService.getLocalizedSunLifeCommunicationMethodById(state.clientApplication.communicationPreferences.preferredMethodSunLife, locale),
      preferredMethodGovernmentOfCanada: this.gcCommunicationMethodService.getLocalizedGCCommunicationMethodById(state.clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada, locale),
    };
  }

  resolvePhoneNumberValue(state: SetRequired<PickDeep<PublicApplicationState, 'phoneNumber' | 'clientApplication.contactInformation.phoneNumber' | 'clientApplication.contactInformation.phoneNumberAlt'>, 'phoneNumber'>): {
    hasChanged: boolean;
    primary: string;
    alternate?: string;
  } {
    this.log.debug('Resolving phone number value');

    if (state.phoneNumber.hasChanged) {
      return {
        hasChanged: true,
        primary: state.phoneNumber.value.primary,
        alternate: state.phoneNumber.value.alternate,
      };
    }

    // If hasChanged is false, client application phone number must be defined, as the value would have been set on the
    // state when the user made a change to the phone number step, which requires client application phone number to be
    // defined.
    invariant(state.clientApplication, 'Expected clientApplication to be defined when phoneNumber.hasChanged is false');
    invariant(state.clientApplication.contactInformation.phoneNumber, 'Expected clientApplication.contactInformation.phoneNumber to be defined when phoneNumber.hasChanged is false');

    return {
      hasChanged: false,
      primary: state.clientApplication.contactInformation.phoneNumber,
      alternate: state.clientApplication.contactInformation.phoneNumberAlt,
    };
  }

  async resolveMailingAddressValue(
    state: SetRequired<
      PickDeep<
        PublicApplicationState,
        | 'mailingAddress'
        | 'clientApplication.contactInformation.mailingAddress.address'
        | 'clientApplication.contactInformation.mailingAddress.city'
        | 'clientApplication.contactInformation.mailingAddress.country'
        | 'clientApplication.contactInformation.mailingAddress.postalCode'
        | 'clientApplication.contactInformation.mailingAddress.province'
      >,
      'mailingAddress'
    >,
    locale: AppLocale,
  ): Promise<{
    hasChanged: boolean;
    address: string;
    city: string;
    country: CountryLocalizedDto;
    postalCode?: string;
    province?: ProvinceTerritoryStateLocalizedDto;
  }> {
    this.log.debug('Resolving mailing address value');

    if (state.mailingAddress.hasChanged) {
      return {
        hasChanged: true,
        address: state.mailingAddress.value.address,
        city: state.mailingAddress.value.city,
        country: await this.countryService.getLocalizedCountryById(state.mailingAddress.value.country, locale),
        postalCode: state.mailingAddress.value.postalCode,
        province: state.mailingAddress.value.province ? await this.provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById(state.mailingAddress.value.province, locale) : undefined,
      };
    }

    // If hasChanged is false, client application mailing address fields must be defined, as the value would have
    // been set on the state when the user made a change to the mailing address step, which requires client application
    // mailing address to be defined.
    invariant(state.clientApplication, 'Expected clientApplication to be defined when mailingAddress.hasChanged is false');

    return {
      hasChanged: false,
      address: state.clientApplication.contactInformation.mailingAddress.address,
      city: state.clientApplication.contactInformation.mailingAddress.city,
      country: await this.countryService.getLocalizedCountryById(state.clientApplication.contactInformation.mailingAddress.country, locale),
      postalCode: state.clientApplication.contactInformation.mailingAddress.postalCode,
      province: state.clientApplication.contactInformation.mailingAddress.province ? await this.provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById(state.clientApplication.contactInformation.mailingAddress.province, locale) : undefined,
    };
  }

  async resolveHomeAddressValue(
    state: SetRequired<
      PickDeep<
        PublicApplicationState,
        | 'homeAddress'
        | 'clientApplication.contactInformation.homeAddress.address'
        | 'clientApplication.contactInformation.homeAddress.city'
        | 'clientApplication.contactInformation.homeAddress.country'
        | 'clientApplication.contactInformation.homeAddress.postalCode'
        | 'clientApplication.contactInformation.homeAddress.province'
      >,
      'homeAddress'
    >,
    locale: AppLocale,
  ): Promise<{
    hasChanged: boolean;
    address: string;
    city: string;
    country: CountryLocalizedDto;
    postalCode?: string;
    province?: ProvinceTerritoryStateLocalizedDto;
  }> {
    this.log.debug('Resolving home address value');

    if (state.homeAddress.hasChanged) {
      return {
        hasChanged: true,
        address: state.homeAddress.value.address,
        city: state.homeAddress.value.city,
        country: await this.countryService.getLocalizedCountryById(state.homeAddress.value.country, locale),
        postalCode: state.homeAddress.value.postalCode,
        province: state.homeAddress.value.province ? await this.provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById(state.homeAddress.value.province, locale) : undefined,
      };
    }

    // If hasChanged is false, client application home address fields must be defined, as the value would have
    // been set on the state when the user made a change to the home address step, which requires client
    // application home address to be defined.
    invariant(state.clientApplication, 'Expected clientApplication to be defined when homeAddress.hasChanged is false');
    invariant(state.clientApplication.contactInformation.homeAddress, 'Expected clientApplication.contactInformation.homeAddress to be defined when homeAddress.hasChanged is false');

    return {
      hasChanged: false,
      address: state.clientApplication.contactInformation.homeAddress.address,
      city: state.clientApplication.contactInformation.homeAddress.city,
      country: await this.countryService.getLocalizedCountryById(state.clientApplication.contactInformation.homeAddress.country, locale),
      postalCode: state.clientApplication.contactInformation.homeAddress.postalCode,
      province: state.clientApplication.contactInformation.homeAddress.province ? await this.provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById(state.clientApplication.contactInformation.homeAddress.province, locale) : undefined,
    };
  }

  resolveEmailValue(state: PickDeep<PublicApplicationState, 'email' | 'emailVerified' | 'clientApplication.contactInformation.email'>): string | undefined {
    this.log.debug('Resolving email value');

    const hasValidEmailInState = typeof state.email === 'string' && validator.isEmail(state.email) && state.emailVerified === true;
    return hasValidEmailInState ? state.email : state.clientApplication?.contactInformation.email;
  }

  async resolveDentalBenefitsValue(
    state: SetRequired<PickDeep<PublicApplicationState, 'dentalBenefits' | 'clientApplication.dentalBenefits'>, 'dentalBenefits'>,
    locale: AppLocale,
  ): Promise<{
    hasChanged: boolean;
    federalGovernmentInsurancePlan?: FederalGovernmentInsurancePlanLocalizedDto;
    provincialGovernmentInsurancePlan?: ProvincialGovernmentInsurancePlanLocalizedDto;
  }> {
    this.log.debug('Resolving dental benefits value');

    if (state.dentalBenefits.hasChanged) {
      return {
        hasChanged: true,
        federalGovernmentInsurancePlan: state.dentalBenefits.value.federalSocialProgram //
          ? await this.federalGovernmentInsurancePlanService.getLocalizedFederalGovernmentInsurancePlanById(state.dentalBenefits.value.federalSocialProgram, locale)
          : undefined,
        provincialGovernmentInsurancePlan: state.dentalBenefits.value.provincialTerritorialSocialProgram //
          ? await this.provincialGovernmentInsurancePlanService.getLocalizedProvincialGovernmentInsurancePlanById(state.dentalBenefits.value.provincialTerritorialSocialProgram, locale)
          : undefined,
      };
    }

    // If hasChanged is false, client application dental benefits must be defined, as the value would have been set on the state when the user made a change to the dental benefits step, which requires client application dental benefits to be defined.
    invariant(state.clientApplication, 'Expected clientApplication to be defined when hasChanged is false');
    invariant(state.clientApplication.dentalBenefits, 'Expected clientApplication.dentalBenefits to be defined when hasChanged is false');

    let federalGovernmentInsurancePlan: FederalGovernmentInsurancePlanLocalizedDto | undefined;
    let provincialGovernmentInsurancePlan: ProvincialGovernmentInsurancePlanLocalizedDto | undefined;

    for (const benefitId of state.clientApplication.dentalBenefits) {
      const federalProgram = await this.federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById(benefitId, locale);
      if (federalProgram.isSome()) {
        federalGovernmentInsurancePlan = federalProgram.unwrap();
        continue;
      }

      const provincialProgram = await this.provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById(benefitId, locale);
      if (provincialProgram.isSome()) {
        provincialGovernmentInsurancePlan = provincialProgram.unwrap();
      }
    }

    return {
      hasChanged: false,
      federalGovernmentInsurancePlan,
      provincialGovernmentInsurancePlan,
    };
  }

  async resolveChildDentalBenefitsValue(
    childState: Required<Pick<PublicApplicationState['children'][number], 'dentalBenefits'>>,
    childClientApplication: Pick<NonNullable<PublicApplicationState['clientApplication']>['children'][number], 'dentalBenefits'> | undefined,
    locale: AppLocale,
  ): Promise<{
    hasChanged: boolean;
    federalGovernmentInsurancePlan?: FederalGovernmentInsurancePlanLocalizedDto;
    provincialGovernmentInsurancePlan?: ProvincialGovernmentInsurancePlanLocalizedDto;
  }> {
    this.log.debug('Resolving child dental benefits value');

    if (childState.dentalBenefits.hasChanged) {
      return {
        hasChanged: true,
        federalGovernmentInsurancePlan: childState.dentalBenefits.value.federalSocialProgram //
          ? await this.federalGovernmentInsurancePlanService.getLocalizedFederalGovernmentInsurancePlanById(childState.dentalBenefits.value.federalSocialProgram, locale)
          : undefined,
        provincialGovernmentInsurancePlan: childState.dentalBenefits.value.provincialTerritorialSocialProgram //
          ? await this.provincialGovernmentInsurancePlanService.getLocalizedProvincialGovernmentInsurancePlanById(childState.dentalBenefits.value.provincialTerritorialSocialProgram, locale)
          : undefined,
      };
    }

    // If hasChanged is false, child client application dental benefits must be defined, as the value would have been set on the
    // state when the user made a change to the child dental benefits step, which requires child client application child dental benefits to
    // be defined.
    invariant(childClientApplication, 'Expected child client application to be defined when child dentalBenefits.hasChanged is false');

    let federalGovernmentInsurancePlan: FederalGovernmentInsurancePlanLocalizedDto | undefined;
    let provincialGovernmentInsurancePlan: ProvincialGovernmentInsurancePlanLocalizedDto | undefined;

    for (const benefitId of childClientApplication.dentalBenefits) {
      const federalProgram = await this.federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById(benefitId, locale);
      if (federalProgram.isSome()) {
        federalGovernmentInsurancePlan = federalProgram.unwrap();
        continue;
      }

      const provincialProgram = await this.provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById(benefitId, locale);
      if (provincialProgram.isSome()) {
        provincialGovernmentInsurancePlan = provincialProgram.unwrap();
      }
    }

    return {
      hasChanged: false,
      federalGovernmentInsurancePlan,
      provincialGovernmentInsurancePlan,
    };
  }
}
