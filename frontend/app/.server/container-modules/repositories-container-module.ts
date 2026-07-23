import { ContainerModule } from 'inversify';
import type { BindingConstraints } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import {
  DefaultAddressValidationRepository,
  DefaultApplicantRepository,
  DefaultApplicationStatusRepository,
  DefaultApplicationYearRepository,
  DefaultBenefitApplicationRepository,
  DefaultBenefitRenewalRepository,
  DefaultClientApplicationRepository,
  DefaultClientEligibilityRepository,
  DefaultClientFriendlyStatusRepository,
  DefaultCountryRepository,
  DefaultDocumentUploadReasonRepository,
  DefaultDocumentUploadRepository,
  DefaultEvidentiaryDocumentRepository,
  DefaultEvidentiaryDocumentTypeRepository,
  DefaultGovernmentInsurancePlanRepository,
  DefaultLetterRepository,
  DefaultLetterTypeRepository,
  DefaultProfileRepository,
  DefaultProvinceTerritoryStateRepository,
  DefaultVerificationCodeRepository,
  MockAddressValidationRepository,
  MockApplicantRepository,
  MockApplicationStatusRepository,
  MockApplicationYearRepository,
  MockBenefitApplicationRepository,
  MockBenefitRenewalRepository,
  MockClientApplicationRepository,
  MockClientEligibilityRepository,
  MockClientFriendlyStatusRepository,
  MockCountryRepository,
  MockDocumentUploadReasonRepository,
  MockDocumentUploadRepository,
  MockEvidentiaryDocumentRepository,
  MockEvidentiaryDocumentTypeRepository,
  MockGovernmentInsurancePlanRepository,
  MockLetterRepository,
  MockLetterTypeRepository,
  MockProfileRepository,
  MockProvinceTerritoryStateRepository,
  MockVerificationCodeRepository,
} from '~/.server/domain/repositories';
import type { MockName } from '~/.server/utils/env-utils';
import { DefaultDynatraceRepository, DefaultHCaptchaRepository } from '~/.server/web/repositories';

/**
 * Determines if a service implementation should be injected based on server configuration.
 * Used for conditional binding of implementations (e.g., enabling/disabling mocks).
 *
 * @param mockName - The name of the mock to check in the server configuration.
 * @param shouldEnable - If `true`, returns `true` if the mock is enabled in the configuration;
 * if `false`, returns `true` if the mock is not enabled.
 * @returns A function that takes an `BindingConstraints` and returns a boolean indicating
 * whether the service implementation should be injected based on the server configuration
 * and the `shouldEnable` parameter.
 *
 * @example
 * // Binds AddressValidationRepository to a mock if the mock is enabled in server config,
 * // otherwise binds to the actual implementation.
 * options.bind(TYPES.AddressValidationRepository).to(DefaultAddressValidationRepository).when(isMockEnabled(serverConfig, 'wsaddress', false));
 * options.bind(TYPES.AddressValidationRepository).to(MockAddressValidationRepository).when(isMockEnabled(serverConfig, 'wsaddress', true));
 */
function isMockEnabled(serverConfig: Pick<ServerConfig, 'ENABLED_MOCKS'>, mockName: MockName, shouldEnable: boolean) {
  return (metadata: BindingConstraints) => {
    const isMockIncluded = serverConfig.ENABLED_MOCKS.includes(mockName);
    return shouldEnable ? isMockIncluded : !isMockIncluded;
  };
}

/**
 * Defines the container module for repository bindings.
 */
export function createRepositoriesContainerModule(serverConfig: Pick<ServerConfig, 'ENABLED_MOCKS'>): ContainerModule {
  // prettier-ignore
  return new ContainerModule((options) => {
    options.bind(TYPES.AddressValidationRepository).to(DefaultAddressValidationRepository).when(isMockEnabled(serverConfig, 'wsaddress', false));
    options.bind(TYPES.AddressValidationRepository).to(MockAddressValidationRepository).when(isMockEnabled(serverConfig, 'wsaddress', true));

    options.bind(TYPES.ApplicantRepository).to(DefaultApplicantRepository).when(isMockEnabled(serverConfig, 'power-platform', false));
    options.bind(TYPES.ApplicantRepository).to(MockApplicantRepository).when(isMockEnabled(serverConfig, 'power-platform', true));

    options.bind(TYPES.ApplicationStatusRepository).to(DefaultApplicationStatusRepository).when(isMockEnabled(serverConfig, 'status-check', false));
    options.bind(TYPES.ApplicationStatusRepository).to(MockApplicationStatusRepository).when(isMockEnabled(serverConfig, 'status-check', true));

    options.bind(TYPES.ApplicationYearRepository).to(DefaultApplicationYearRepository).when(isMockEnabled(serverConfig, 'power-platform', false));
    options.bind(TYPES.ApplicationYearRepository).to(MockApplicationYearRepository).when(isMockEnabled(serverConfig, 'power-platform', true));

    options.bind(TYPES.BenefitApplicationRepository).to(DefaultBenefitApplicationRepository).when(isMockEnabled(serverConfig, 'power-platform', false));
    options.bind(TYPES.BenefitApplicationRepository).to(MockBenefitApplicationRepository).when(isMockEnabled(serverConfig, 'power-platform', true));

    options.bind(TYPES.BenefitRenewalRepository).to(DefaultBenefitRenewalRepository).when(isMockEnabled(serverConfig, 'power-platform', false));
    options.bind(TYPES.BenefitRenewalRepository).to(MockBenefitRenewalRepository).when(isMockEnabled(serverConfig, 'power-platform', true));

    options.bind(TYPES.ClientApplicationRepository).to(DefaultClientApplicationRepository).when(isMockEnabled(serverConfig, 'power-platform', false));
    options.bind(TYPES.ClientApplicationRepository).to(MockClientApplicationRepository).when(isMockEnabled(serverConfig, 'power-platform', true));

    options.bind(TYPES.ClientEligibilityRepository).to(DefaultClientEligibilityRepository).when(isMockEnabled(serverConfig, 'power-platform', false));
    options.bind(TYPES.ClientEligibilityRepository).to(MockClientEligibilityRepository).when(isMockEnabled(serverConfig, 'power-platform', true));

    options.bind(TYPES.ClientFriendlyStatusRepository).to(DefaultClientFriendlyStatusRepository).when(isMockEnabled(serverConfig, 'code-tables', false));
    options.bind(TYPES.ClientFriendlyStatusRepository).to(MockClientFriendlyStatusRepository).when(isMockEnabled(serverConfig, 'code-tables', true));

    options.bind(TYPES.CountryRepository).to(DefaultCountryRepository).when(isMockEnabled(serverConfig, 'code-tables', false));
    options.bind(TYPES.CountryRepository).to(MockCountryRepository).when(isMockEnabled(serverConfig, 'code-tables', true));


    options.bind(TYPES.DocumentUploadRepository).to(DefaultDocumentUploadRepository).when(isMockEnabled(serverConfig, 'document-upload', false));
    options.bind(TYPES.DocumentUploadRepository).to(MockDocumentUploadRepository).when(isMockEnabled(serverConfig, 'document-upload', true));

    options.bind(TYPES.DocumentUploadReasonRepository).to(DefaultDocumentUploadReasonRepository).when(isMockEnabled(serverConfig, 'code-tables', false));
    options.bind(TYPES.DocumentUploadReasonRepository).to(MockDocumentUploadReasonRepository).when(isMockEnabled(serverConfig, 'code-tables', true));

    options.bind(TYPES.EvidentiaryDocumentRepository).to(DefaultEvidentiaryDocumentRepository).when(isMockEnabled(serverConfig, 'evidentiary-document', false));
    options.bind(TYPES.EvidentiaryDocumentRepository).to(MockEvidentiaryDocumentRepository).when(isMockEnabled(serverConfig, 'evidentiary-document', true));

    options.bind(TYPES.EvidentiaryDocumentTypeRepository).to(DefaultEvidentiaryDocumentTypeRepository).when(isMockEnabled(serverConfig, 'evidentiary-document', false));
    options.bind(TYPES.EvidentiaryDocumentTypeRepository).to(MockEvidentiaryDocumentTypeRepository).when(isMockEnabled(serverConfig, 'evidentiary-document', true));

    options.bind(TYPES.GovernmentInsurancePlanRepository).to(DefaultGovernmentInsurancePlanRepository).when(isMockEnabled(serverConfig, 'code-tables', false));
    options.bind(TYPES.GovernmentInsurancePlanRepository).to(MockGovernmentInsurancePlanRepository).when(isMockEnabled(serverConfig, 'code-tables', true));

    options.bind(TYPES.LetterRepository).to(DefaultLetterRepository).when(isMockEnabled(serverConfig, 'cct', false));
    options.bind(TYPES.LetterRepository).to(MockLetterRepository).when(isMockEnabled(serverConfig, 'cct', true));

    options.bind(TYPES.LetterTypeRepository).to(DefaultLetterTypeRepository).when(isMockEnabled(serverConfig, 'code-tables', false));
    options.bind(TYPES.LetterTypeRepository).to(MockLetterTypeRepository).when(isMockEnabled(serverConfig, 'code-tables', true));

    options.bind(TYPES.VerificationCodeRepository).to(DefaultVerificationCodeRepository).when(isMockEnabled(serverConfig, 'gc-notify', false));
    options.bind(TYPES.VerificationCodeRepository).to(MockVerificationCodeRepository).when(isMockEnabled(serverConfig, 'gc-notify', true));

    options.bind(TYPES.ProvinceTerritoryStateRepository).to(DefaultProvinceTerritoryStateRepository).when(isMockEnabled(serverConfig, 'code-tables', false));
    options.bind(TYPES.ProvinceTerritoryStateRepository).to(MockProvinceTerritoryStateRepository).when(isMockEnabled(serverConfig, 'code-tables', true));

    options.bind(TYPES.DynatraceRepository).to(DefaultDynatraceRepository);
    options.bind(TYPES.HCaptchaRepository).to(DefaultHCaptchaRepository);

    options.bind(TYPES.ProfileRepository).to(DefaultProfileRepository).when(isMockEnabled(serverConfig, 'profile', false));
    options.bind(TYPES.ProfileRepository).to(MockProfileRepository).when(isMockEnabled(serverConfig, 'profile', true));
  });
}
