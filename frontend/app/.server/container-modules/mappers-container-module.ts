import { ContainerModule } from 'inversify';

import { TYPES } from '~/.server/constants';
import {
  DefaultAddressValidationDtoMapper,
  DefaultApplicantDtoMapper,
  DefaultApplicationStatusDtoMapper,
  DefaultApplicationYearDtoMapper,
  DefaultBenefitApplicationDtoMapper,
  DefaultBenefitRenewalDtoMapper,
  DefaultClientApplicationDtoMapper,
  DefaultClientApplicationRenewalEligibilityDtoMapper,
  DefaultClientEligibilityDtoMapper,
  DefaultClientFriendlyStatusDtoMapper,
  DefaultCountryDtoMapper,
  DefaultDocumentUploadDtoMapper,
  DefaultDocumentUploadReasonDtoMapper,
  DefaultEvidentiaryDocumentDtoMapper,
  DefaultEvidentiaryDocumentTypeDtoMapper,
  DefaultFederalGovernmentInsurancePlanDtoMapper,
  DefaultGCCommunicationMethodDtoMapper,
  DefaultLanguageDtoMapper,
  DefaultLetterDtoMapper,
  DefaultLetterTypeDtoMapper,
  DefaultMaritalStatusDtoMapper,
  DefaultProfileDtoMapper,
  DefaultProvinceTerritoryStateDtoMapper,
  DefaultProvincialGovernmentInsurancePlanDtoMapper,
  DefaultSunLifeCommunicationMethodDtoMapper,
  DefaultVerificationCodeDtoMapper,
} from '~/.server/domain/mappers';
import { DefaultBenefitApplicationStateMapper, DefaultBenefitRenewalStateMapper } from '~/.server/routes/mappers';
import { DefaultDynatraceDtoMapper, DefaultHCaptchaDtoMapper } from '~/.server/web/mappers';

/**
 * Defines the container module for mapper bindings.
 */
export function createMappersContainerModule(): ContainerModule {
  return new ContainerModule((options) => {
    options.bind(TYPES.AddressValidationDtoMapper).to(DefaultAddressValidationDtoMapper);
    options.bind(TYPES.ApplicantDtoMapper).to(DefaultApplicantDtoMapper);
    options.bind(TYPES.ApplicationStatusDtoMapper).to(DefaultApplicationStatusDtoMapper);
    options.bind(TYPES.ApplicationYearDtoMapper).to(DefaultApplicationYearDtoMapper);
    options.bind(TYPES.BenefitApplicationDtoMapper).to(DefaultBenefitApplicationDtoMapper);
    options.bind(TYPES.BenefitApplicationStateMapper).to(DefaultBenefitApplicationStateMapper);
    options.bind(TYPES.BenefitRenewalStateMapper).to(DefaultBenefitRenewalStateMapper);
    options.bind(TYPES.BenefitRenewalDtoMapper).to(DefaultBenefitRenewalDtoMapper);
    options.bind(TYPES.ClientApplicationDtoMapper).to(DefaultClientApplicationDtoMapper);
    options.bind(TYPES.ClientApplicationRenewalEligibilityDtoMapper).to(DefaultClientApplicationRenewalEligibilityDtoMapper);
    options.bind(TYPES.ClientEligibilityDtoMapper).to(DefaultClientEligibilityDtoMapper);
    options.bind(TYPES.ClientFriendlyStatusDtoMapper).to(DefaultClientFriendlyStatusDtoMapper);
    options.bind(TYPES.CountryDtoMapper).to(DefaultCountryDtoMapper);
    options.bind(TYPES.DocumentUploadDtoMapper).to(DefaultDocumentUploadDtoMapper);
    options.bind(TYPES.DocumentUploadReasonDtoMapper).to(DefaultDocumentUploadReasonDtoMapper);
    options.bind(TYPES.DynatraceDtoMapper).to(DefaultDynatraceDtoMapper);
    options.bind(TYPES.EvidentiaryDocumentDtoMapper).to(DefaultEvidentiaryDocumentDtoMapper);
    options.bind(TYPES.EvidentiaryDocumentTypeDtoMapper).to(DefaultEvidentiaryDocumentTypeDtoMapper);
    options.bind(TYPES.FederalGovernmentInsurancePlanDtoMapper).to(DefaultFederalGovernmentInsurancePlanDtoMapper);
    options.bind(TYPES.GCCommunicationMethodDtoMapper).to(DefaultGCCommunicationMethodDtoMapper);
    options.bind(TYPES.HCaptchaDtoMapper).to(DefaultHCaptchaDtoMapper);
    options.bind(TYPES.LanguageDtoMapper).to(DefaultLanguageDtoMapper);
    options.bind(TYPES.LetterDtoMapper).to(DefaultLetterDtoMapper);
    options.bind(TYPES.LetterTypeDtoMapper).to(DefaultLetterTypeDtoMapper);
    options.bind(TYPES.ProfileDtoMapper).to(DefaultProfileDtoMapper);
    options.bind(TYPES.ProvinceTerritoryStateDtoMapper).to(DefaultProvinceTerritoryStateDtoMapper);
    options.bind(TYPES.ProvincialGovernmentInsurancePlanDtoMapper).to(DefaultProvincialGovernmentInsurancePlanDtoMapper);
    options.bind(TYPES.SunLifeCommunicationMethodDtoMapper).to(DefaultSunLifeCommunicationMethodDtoMapper);
    options.bind(TYPES.VerificationCodeDtoMapper).to(DefaultVerificationCodeDtoMapper);
    options.bind(TYPES.MaritalStatusDtoMapper).to(DefaultMaritalStatusDtoMapper);
  });
}
