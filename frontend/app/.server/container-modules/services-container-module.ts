import { ContainerModule } from 'inversify';
import type { BindingConstraints } from 'inversify';

import { DefaultRaoidcService } from '~/.server/auth/raoidc-service';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { DefaultBuildInfoService } from '~/.server/core';
import { DefaultRedisService } from '~/.server/data';
import {
  DefaultAddressValidationService,
  DefaultApplicantService,
  DefaultApplicationStatusService,
  DefaultApplicationYearService,
  DefaultAuditService,
  DefaultBenefitApplicationService,
  DefaultBenefitRenewalService,
  DefaultClientApplicationRenewalEligibilityService,
  DefaultClientApplicationService,
  DefaultClientEligibilityService,
  DefaultClientFriendlyStatusService,
  DefaultCountryService,
  DefaultCoverageService,
  DefaultDocumentUploadReasonService,
  DefaultDocumentUploadService,
  DefaultEvidentiaryDocumentService,
  DefaultEvidentiaryDocumentTypeService,
  DefaultFederalGovernmentInsurancePlanService,
  DefaultGCCommunicationMethodService,
  DefaultLanguageService,
  DefaultLetterService,
  DefaultLetterTypeService,
  DefaultMaritalStatusService,
  DefaultProfileService,
  DefaultProvinceTerritoryStateService,
  DefaultProvincialGovernmentInsurancePlanService,
  DefaultSunLifeCommunicationMethodService,
  DefaultVerificationCodeService,
  StubVerificationCodeService,
} from '~/.server/domain/services';
import { DefaultHttpClient } from '~/.server/http';
import { DefaultInstrumentationService } from '~/.server/observability';
import type { MockName } from '~/.server/utils/env-utils';
import { DefaultDynatraceService, DefaultHCaptchaService } from '~/.server/web/services';

function isMockEnabled(serverConfig: Pick<ServerConfig, 'ENABLED_MOCKS'>, mockName: MockName, shouldEnable: boolean) {
  return (metadata: BindingConstraints) => {
    const isMockIncluded = serverConfig.ENABLED_MOCKS.includes(mockName);
    return shouldEnable ? isMockIncluded : !isMockIncluded;
  };
}

function sessionTypeIs(serverConfig: Pick<ServerConfig, 'SESSION_STORAGE_TYPE'>, sessionType: ServerConfig['SESSION_STORAGE_TYPE']) {
  return (metadata: BindingConstraints) => {
    return serverConfig.SESSION_STORAGE_TYPE === sessionType;
  };
}

/**
 * Defines the container module for service bindings.
 */
export function createServicesContainerModule(serverConfig: Pick<ServerConfig, 'ENABLED_MOCKS' | 'SESSION_STORAGE_TYPE'>): ContainerModule {
  // prettier-ignore
  return new ContainerModule((options) => {
    options.bind(TYPES.AddressValidationService).to(DefaultAddressValidationService);
    options.bind(TYPES.ApplicantService).to(DefaultApplicantService);
    options.bind(TYPES.ApplicationStatusService).to(DefaultApplicationStatusService);
    options.bind(TYPES.ApplicationYearService).to(DefaultApplicationYearService);
    options.bind(TYPES.AuditService).to(DefaultAuditService);
    options.bind(TYPES.BenefitApplicationService).to(DefaultBenefitApplicationService);
    options.bind(TYPES.BenefitRenewalService).to(DefaultBenefitRenewalService);
    options.bind(TYPES.BuildInfoService).to(DefaultBuildInfoService);
    options.bind(TYPES.ClientApplicationService).to(DefaultClientApplicationService);
    options.bind(TYPES.ClientApplicationRenewalEligibilityService).to(DefaultClientApplicationRenewalEligibilityService);
    options.bind(TYPES.ClientEligibilityService).to(DefaultClientEligibilityService);
    options.bind(TYPES.ClientFriendlyStatusService).to(DefaultClientFriendlyStatusService);
    options.bind(TYPES.CountryService).to(DefaultCountryService);
    options.bind(TYPES.CoverageService).to(DefaultCoverageService);
    options.bind(TYPES.DocumentUploadService).to(DefaultDocumentUploadService);
    options.bind(TYPES.DocumentUploadReasonService).to(DefaultDocumentUploadReasonService);
    options.bind(TYPES.DynatraceService).to(DefaultDynatraceService);
    options.bind(TYPES.EvidentiaryDocumentService).to(DefaultEvidentiaryDocumentService);
    options.bind(TYPES.EvidentiaryDocumentTypeService).to(DefaultEvidentiaryDocumentTypeService);
    options.bind(TYPES.FederalGovernmentInsurancePlanService).to(DefaultFederalGovernmentInsurancePlanService);
    options.bind(TYPES.GCCommunicationMethodService).to(DefaultGCCommunicationMethodService);
    options.bind(TYPES.HCaptchaService).to(DefaultHCaptchaService);
    options.bind(TYPES.HttpClient).to(DefaultHttpClient);
    options.bind(TYPES.InstrumentationService).to(DefaultInstrumentationService);
    options.bind(TYPES.LanguageService).to(DefaultLanguageService);
    options.bind(TYPES.LetterService).to(DefaultLetterService);
    options.bind(TYPES.LetterTypeService).to(DefaultLetterTypeService);
    options.bind(TYPES.MaritalStatusService).to(DefaultMaritalStatusService);
    options.bind(TYPES.ProfileService).to(DefaultProfileService);
    options.bind(TYPES.ProvinceTerritoryStateService).to(DefaultProvinceTerritoryStateService);
    options.bind(TYPES.ProvincialGovernmentInsurancePlanService).to(DefaultProvincialGovernmentInsurancePlanService);
    options.bind(TYPES.RaoidcService).to(DefaultRaoidcService);
    // RedisService bindings depend on the SESSION_STORAGE_TYPE configuration string
    options.bind(TYPES.RedisService).to(DefaultRedisService).when(sessionTypeIs(serverConfig, 'redis'));
    options.bind(TYPES.SunLifeCommunicationMethodService).to(DefaultSunLifeCommunicationMethodService);
    options.bind(TYPES.VerificationCodeService).to(DefaultVerificationCodeService).when(isMockEnabled(serverConfig, 'verification-code', false));
    options.bind(TYPES.VerificationCodeService).to(StubVerificationCodeService).when(isMockEnabled(serverConfig, 'verification-code', true));
  });
}
