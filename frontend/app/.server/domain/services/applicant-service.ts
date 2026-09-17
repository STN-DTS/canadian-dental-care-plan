import { inject, injectable } from 'inversify';
import type { Option } from 'oxide.ts';
import { None, Some } from 'oxide.ts';

import { TYPES } from '~/.server/constants';
import type { ApplicantDto, FindApplicantByBasicInfoDto, FindApplicantBySinRequestDto, ProgramApplicantDto } from '~/.server/domain/dtos';
import type { ApplicantDtoMapper } from '~/.server/domain/mappers';
import type { ApplicantRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * A service that provides access to applicant data.
 */
export interface ApplicantService {
  /**
   * Finds an applicant by basic info.
   *
   * @param request The basic info request dto.
   * @returns A Promise that resolves to the applicant dto if found, or `None` otherwise.
   */
  findApplicantByBasicInfo(request: FindApplicantByBasicInfoDto): Promise<Option<ApplicantDto>>;

  /**
   * Finds the applicant DTO by SIN.
   *
   * @param request The applicant request dto that includes SIN and userId for auditing
   * @returns A Promise that resolves to the applicant DTO if found, or `None` otherwise.
   */
  findApplicantBySin(request: FindApplicantBySinRequestDto): Promise<Option<ApplicantDto>>;

  /**
   * Finds a program applicant by basic info.
   *
   * @param request The basic info request dto.
   * @returns A Promise that resolves to the program applicant DTO if found, or `None` otherwise.
   */
  findProgramApplicantByBasicInfo(request: FindApplicantByBasicInfoDto): Promise<Option<ProgramApplicantDto>>;

  /**
   * Finds a program applicant by SIN.
   *
   * @param request The applicant request dto that includes SIN and userId for auditing.
   * @returns A Promise that resolves to the program applicant DTO if found, or `None` otherwise.
   */
  findProgramApplicantBySin(request: FindApplicantBySinRequestDto): Promise<Option<ProgramApplicantDto>>;
}

@injectable()
export class DefaultApplicantService implements ApplicantService {
  private readonly log: Logger;
  private readonly applicantDtoMapper: ApplicantDtoMapper;
  private readonly applicantRepository: ApplicantRepository;
  private readonly auditService: AuditService;

  constructor(@inject(TYPES.ApplicantDtoMapper) applicantDtoMapper: ApplicantDtoMapper, @inject(TYPES.ApplicantRepository) applicantRepository: ApplicantRepository, @inject(TYPES.AuditService) auditService: AuditService) {
    this.log = createLogger('DefaultApplicantService');
    this.applicantDtoMapper = applicantDtoMapper;
    this.applicantRepository = applicantRepository;
    this.auditService = auditService;
    this.log.debug('DefaultApplicantService initiated.');
  }

  async findApplicantByBasicInfo(request: FindApplicantByBasicInfoDto): Promise<Option<ApplicantDto>> {
    this.log.trace('Find applicant by basic info: [%j]', request);

    this.auditService.createAudit('applicant.basic-info.get', { userId: request.userId });

    const applicantBasicInfoRequestEntity = this.applicantDtoMapper.mapFindApplicantByBasicInfoRequestDtoToFindApplicantByBasicInfoRequestEntity(request);
    const applicantEntity = await this.applicantRepository.findApplicantByBasicInfo(applicantBasicInfoRequestEntity);

    if (applicantEntity.isNone()) {
      this.log.trace('No applicant found with basic info: [%j]', request);
      return None;
    }

    const applicantDto = this.applicantDtoMapper.mapApplicantResponseEntityToApplicantDto(applicantEntity.unwrap());
    this.log.trace('Returning applicant: [%j]', applicantDto);
    return Some(applicantDto);
  }

  async findApplicantBySin(request: FindApplicantBySinRequestDto): Promise<Option<ApplicantDto>> {
    const { sin, userId } = request;

    this.log.trace('Finding applicant with sin [%s] and userId [%s]', sin, userId);

    this.auditService.createAudit('applicant.personal-information.get', { userId });

    const applicantRequestEntity = this.applicantDtoMapper.mapFindApplicantBySinRequestDtoToFindApplicantBySinRequestEntity(request);
    const applicantResponseEntity = await this.applicantRepository.findApplicantBySin(applicantRequestEntity);
    if (applicantResponseEntity.isNone()) {
      this.log.trace('No applicant found for sin [%s]; Returning null', sin);
      return None;
    }

    const applicantDto = this.applicantDtoMapper.mapApplicantResponseEntityToApplicantDto(applicantResponseEntity.unwrap());
    this.log.trace('Returning applicant DTO for sin [%s]', sin);
    return Some(applicantDto);
  }

  async findProgramApplicantByBasicInfo(request: FindApplicantByBasicInfoDto): Promise<Option<ProgramApplicantDto>> {
    const applicantOption = await this.findApplicantByBasicInfo(request);

    if (applicantOption.isNone()) {
      return None;
    }

    const applicantDto = applicantOption.unwrap();

    if (!this.isProgramApplicant(applicantDto)) {
      this.log.trace('Applicant found with basic info but has no applicant type: [%j]', request);
      return None;
    }

    return Some(applicantDto);
  }

  async findProgramApplicantBySin(request: FindApplicantBySinRequestDto): Promise<Option<ProgramApplicantDto>> {
    const applicantOption = await this.findApplicantBySin(request);

    if (applicantOption.isNone()) {
      return None;
    }

    const applicantDto = applicantOption.unwrap();

    if (!this.isProgramApplicant(applicantDto)) {
      this.log.trace('Applicant found for sin [%s] but has no applicant type', request.sin);
      return None;
    }

    return Some(applicantDto);
  }

  /**
   * Checks whether an applicant qualifies as a program applicant by having a defined applicant type.
   *
   * @param applicant The applicant to check.
   * @returns Whether the applicant has a defined applicant type.
   */
  private isProgramApplicant(applicant: ApplicantDto): applicant is ProgramApplicantDto {
    return applicant.applicantType !== undefined;
  }
}
