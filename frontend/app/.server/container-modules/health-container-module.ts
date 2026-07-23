import { ContainerModule } from 'inversify';
import type { BindingConstraints } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import {
  AddressValidationHealthCheck,
  ApplicantHealthCheck,
  ApplicationStatusHealthCheck,
  ClientFriendlyStatusHealthCheck,
  CountryHealthCheck,
  GovernmentInsurancePlanHealthCheck,
  HCaptchaHealthCheck,
  LetterHealthCheck,
  LetterTypeHealthCheck,
  NotificationHealthCheck,
  ProvinceTerritoryStateHealthCheck,
  RedisHealthCheck,
} from '~/.server/health';

function featureEnabled(serverConfig: Pick<ServerConfig, 'ENABLED_FEATURES'>, feature: ServerConfig['ENABLED_FEATURES'][number]) {
  return (metadata: BindingConstraints) => {
    return serverConfig.ENABLED_FEATURES.includes(feature);
  };
}

function sessionTypeIs(serverConfig: Pick<ServerConfig, 'SESSION_STORAGE_TYPE'>, sessionType: ServerConfig['SESSION_STORAGE_TYPE']) {
  return (metadata: BindingConstraints) => {
    return serverConfig.SESSION_STORAGE_TYPE === sessionType;
  };
}

/**
 * Defines the container module for health bindings.
 */
export function createHealthContainerModule(serverConfig: Pick<ServerConfig, 'ENABLED_FEATURES' | 'SESSION_STORAGE_TYPE'>): ContainerModule {
  return new ContainerModule((options) => {
    options.bind(TYPES.HealthCheck).to(AddressValidationHealthCheck);
    options.bind(TYPES.HealthCheck).to(ApplicantHealthCheck);
    options.bind(TYPES.HealthCheck).to(ApplicationStatusHealthCheck);
    options.bind(TYPES.HealthCheck).to(CountryHealthCheck);
    options.bind(TYPES.HealthCheck).to(ClientFriendlyStatusHealthCheck);
    options.bind(TYPES.HealthCheck).to(ProvinceTerritoryStateHealthCheck);
    options.bind(TYPES.HealthCheck).to(LetterTypeHealthCheck);
    options.bind(TYPES.HealthCheck).to(GovernmentInsurancePlanHealthCheck);
    options.bind(TYPES.HealthCheck).to(HCaptchaHealthCheck).when(featureEnabled(serverConfig, 'hcaptcha'));
    options.bind(TYPES.HealthCheck).to(LetterHealthCheck);
    options.bind(TYPES.HealthCheck).to(NotificationHealthCheck);
    options.bind(TYPES.HealthCheck).to(RedisHealthCheck).when(sessionTypeIs(serverConfig, 'redis'));
  });
}
