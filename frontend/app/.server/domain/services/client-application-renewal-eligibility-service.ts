import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { ClientApplicationRenewalEligibilityBasicInfoAndSinRequestDto, ClientApplicationRenewalEligibilityDto, ClientApplicationRenewalEligibilitySinRequestDto } from '~/.server/domain/dtos';
import type { ClientApplicationRenewalEligibilityDtoMapper } from '~/.server/domain/mappers';
import type { ApplicantService, AuditService, ClientApplicationService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { sanitizeSin } from '~/utils/sin-utils';

/**
 * A service that provides access to client application data for renewal eligibility.
 */
export interface ClientApplicationRenewalEligibilityService {
  /**
   * Gets a client application renewal eligibility by basic info and SIN.
   *
   * @param request The basic info and SIN request dto.
   * @returns A Promise that resolves to client application renewal eligibility dto.
   */
  getClientApplicationRenewalEligibilityByBasicInfoAndSin(request: ClientApplicationRenewalEligibilityBasicInfoAndSinRequestDto): Promise<ClientApplicationRenewalEligibilityDto>;

  /**
   * Gets a client application renewal eligibility by SIN.
   *
   * @param request The SIN request dto.
   * @returns A Promise that resolves to client application renewal eligibility dto.
   */
  getClientApplicationRenewalEligibilityBySin(request: ClientApplicationRenewalEligibilitySinRequestDto): Promise<ClientApplicationRenewalEligibilityDto>;
}

@injectable()
export class DefaultClientApplicationRenewalEligibilityService implements ClientApplicationRenewalEligibilityService {
  private readonly log: Logger;
  private readonly applicantService: ApplicantService;
  private readonly clientApplicationRenewalEligibilityDtoMapper: ClientApplicationRenewalEligibilityDtoMapper;
  private readonly clientApplicationService: ClientApplicationService;
  private readonly auditService: AuditService;

  constructor(
    @inject(TYPES.ApplicantService) applicantService: ApplicantService,
    @inject(TYPES.ClientApplicationRenewalEligibilityDtoMapper) clientApplicationRenewalEligibilityDtoMapper: ClientApplicationRenewalEligibilityDtoMapper,
    @inject(TYPES.ClientApplicationService) clientApplicationService: ClientApplicationService,
    @inject(TYPES.AuditService) auditService: AuditService,
  ) {
    this.log = createLogger('DefaultClientApplicationRenewalEligibilityService');
    this.applicantService = applicantService;
    this.clientApplicationService = clientApplicationService;
    this.clientApplicationRenewalEligibilityDtoMapper = clientApplicationRenewalEligibilityDtoMapper;
    this.auditService = auditService;
    this.log.debug('DefaultClientApplicationRenewalEligibilityService initiated.');
  }

  async getClientApplicationRenewalEligibilityByBasicInfoAndSin(request: ClientApplicationRenewalEligibilityBasicInfoAndSinRequestDto): Promise<ClientApplicationRenewalEligibilityDto> {
    this.log.trace('Get client application renewal eligibility with basic info and sin: [%j]', request);

    const clientApplicationDto = await this.clientApplicationService.findClientApplicationByBasicInfoAndSin({
      clientNumber: request.clientNumber,
      dateOfBirth: request.dateOfBirth,
      firstName: request.firstName,
      lastName: request.lastName,
      applicationYearId: request.applicationYear.applicationYearId,
      sin: request.sin,
      userId: request.userId,
    });

    this.auditService.createAudit('client-application-renewal-eligibility.basic-info-and-sin.get', { userId: request.userId });

    if (clientApplicationDto.isSome()) {
      const clientApplicationRenewalEligibilityDto = await this.clientApplicationRenewalEligibilityDtoMapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(clientApplicationDto.unwrap(), request.applicationYear);

      this.log.trace('Returning client application renewal eligibility: [%j]', clientApplicationRenewalEligibilityDto);
      return clientApplicationRenewalEligibilityDto;
    }

    // If no client application is found with the provided basic info and SIN, we check if an
    // applicant exists with that basic info
    const applicantOption = await this.applicantService.findApplicantByBasicInfo({
      clientNumber: request.clientNumber,
      dateOfBirth: request.dateOfBirth,
      firstName: request.firstName,
      lastName: request.lastName,
      userId: request.userId,
    });

    if (applicantOption.isNone()) {
      this.log.debug('Applicant is None for provided basic info, returning not found result');
      return { result: 'INELIGIBLE-APPLICANT-NOT-FOUND' };
    }

    const applicant = applicantOption.unwrap();

    if (!applicant.socialInsuranceNumber) {
      this.log.trace('Applicant found with basic info, but no SIN on file to compare against, skipping SIN check. Basic info: [%j]', request);
    } else if (sanitizeSin(applicant.socialInsuranceNumber) !== sanitizeSin(request.sin)) {
      this.log.trace('Applicant found with basic info, but SIN does not match. Basic info: [%j], SIN: [***-***-%s]', request, request.sin.slice(-3));
      return { result: 'INELIGIBLE-APPLICANT-SIN-MISMATCH' };
    }

    const applicationYear = request.applicationYear;
    this.log.debug('Applicant found for provided basic info and SIN, returning eligibility result based on applicant');
    this.log.trace('Applicant found for provided basic info and SIN: [%j], applicationYear: [%j]', applicant, applicationYear);
    return await this.clientApplicationRenewalEligibilityDtoMapper.mapApplicantDtoToClientApplicationRenewalEligibilityDto(applicant, applicationYear);
  }

  async getClientApplicationRenewalEligibilityBySin(request: ClientApplicationRenewalEligibilitySinRequestDto): Promise<ClientApplicationRenewalEligibilityDto> {
    this.log.trace('Get client application renewal eligibility with sin: [%j]', request);

    const clientApplicationDto = await this.clientApplicationService.findClientApplicationBySin({
      sin: request.sin,
      applicationYearId: request.applicationYear.applicationYearId,
      userId: request.userId,
    });

    this.auditService.createAudit('client-application-renewal-eligibility.sin.get', { userId: request.userId });

    if (clientApplicationDto.isSome()) {
      const clientApplicationRenewalEligibilityDto = await this.clientApplicationRenewalEligibilityDtoMapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(clientApplicationDto.unwrap(), request.applicationYear);

      this.log.trace('Returning client application renewal eligibility: [%j]', clientApplicationRenewalEligibilityDto);
      return clientApplicationRenewalEligibilityDto;
    }

    // If no client application is found with the provided SIN, we check if an applicant exists with that SIN
    const applicantOption = await this.applicantService.findApplicantBySin({
      sin: request.sin,
      userId: request.userId,
    });

    if (applicantOption.isNone()) {
      this.log.debug('Applicant is None for provided SIN, returning not found result');
      return { result: 'INELIGIBLE-APPLICANT-NOT-FOUND' };
    }

    const applicationYear = request.applicationYear;
    const applicant = applicantOption.unwrap();
    this.log.debug('Applicant found for provided SIN, returning eligibility result based on applicant');
    this.log.trace('Applicant found for provided SIN: [%j], applicationYear: [%j]', applicant, applicationYear);
    return await this.clientApplicationRenewalEligibilityDtoMapper.mapApplicantDtoToClientApplicationRenewalEligibilityDto(applicant, applicationYear);
  }
}
