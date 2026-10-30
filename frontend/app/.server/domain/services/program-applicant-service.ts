import { Option } from 'effect';
import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { FindProgramApplicantByBasicInfoDto, FindProgramApplicantBySinRequestDto, ProgramApplicantDto } from '~/.server/domain/dtos';
import type { ApplicantResponseEntity } from '~/.server/domain/entities';
import type { ProgramApplicantDtoMapper } from '~/.server/domain/mappers';
import type { ApplicantRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services/audit-service';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';

/** Provides lookups restricted to applicants with a program-assigned type. */
export interface ProgramApplicantService {
  /**
   * Finds a program applicant by client number and identity details.
   *
   * @param request Applicant identity details and audit user identifier.
   * @returns Program applicant when found and categorized; otherwise, `None`.
   * @throws When a categorized applicant is missing fields required by `ProgramApplicantDto`.
   */
  findProgramApplicantByBasicInfo(request: FindProgramApplicantByBasicInfoDto): Promise<Option.Option<ProgramApplicantDto>>;

  /**
   * Finds a program applicant by SIN.
   *
   * @param request Applicant SIN and audit user identifier.
   * @returns Program applicant when found and categorized; otherwise, `None`.
   * @throws When a categorized applicant is missing fields required by `ProgramApplicantDto`.
   */
  findProgramApplicantBySin(request: FindProgramApplicantBySinRequestDto): Promise<Option.Option<ProgramApplicantDto>>;
}

/** Default program applicant lookup service. */
@injectable()
export class DefaultProgramApplicantService implements ProgramApplicantService {
  private readonly log: Logger;
  private readonly programApplicantDtoMapper: ProgramApplicantDtoMapper;
  private readonly applicantRepository: ApplicantRepository;
  private readonly auditService: AuditService;

  constructor(@inject(TYPES.ProgramApplicantDtoMapper) programApplicantDtoMapper: ProgramApplicantDtoMapper, @inject(TYPES.ApplicantRepository) applicantRepository: ApplicantRepository, @inject(TYPES.AuditService) auditService: AuditService) {
    this.log = createLogger('DefaultProgramApplicantService');
    this.programApplicantDtoMapper = programApplicantDtoMapper;
    this.applicantRepository = applicantRepository;
    this.auditService = auditService;
  }

  async findProgramApplicantByBasicInfo(request: FindProgramApplicantByBasicInfoDto): Promise<Option.Option<ProgramApplicantDto>> {
    this.auditService.createAudit('program-applicant.basic-info.get', { userId: request.userId });

    const requestEntity = this.programApplicantDtoMapper.mapFindProgramApplicantByBasicInfoDtoToFindApplicantByBasicInfoRequestEntity(request);
    const applicantEntityOption = await this.applicantRepository.findApplicantByBasicInfo(requestEntity);

    if (Option.isNone(applicantEntityOption)) {
      this.log.trace('No program applicant found for basic info: [%j]', request);
      return Option.none();
    }

    const applicantEntity = Option.getOrThrow(applicantEntityOption);
    this.log.trace('Applicant entity retrieved for basic info: [%j]', request);

    if (!this.isProgramApplicant(applicantEntity)) {
      this.log.trace('Applicant entity for basic info: [%j] is not a program applicant', request);
      return Option.none();
    }

    return Option.some(this.programApplicantDtoMapper.mapApplicantResponseEntityToProgramApplicantDto(applicantEntity));
  }

  async findProgramApplicantBySin(request: FindProgramApplicantBySinRequestDto): Promise<Option.Option<ProgramApplicantDto>> {
    this.auditService.createAudit('program-applicant.personal-information.get', { userId: request.userId });

    const requestEntity = this.programApplicantDtoMapper.mapFindProgramApplicantBySinRequestDtoToFindApplicantBySinRequestEntity(request);
    const applicantEntityOption = await this.applicantRepository.findApplicantBySin(requestEntity);

    if (Option.isNone(applicantEntityOption)) {
      this.log.trace('No program applicant found for sin [%s]', request.sin);
      return Option.none();
    }

    const applicantEntity = Option.getOrThrow(applicantEntityOption);
    this.log.trace('Applicant entity retrieved for sin [%s]', request.sin);

    if (!this.isProgramApplicant(applicantEntity)) {
      this.log.trace('Applicant entity for sin [%s] is not a program applicant', request.sin);
      return Option.none();
    }

    return Option.some(this.programApplicantDtoMapper.mapApplicantResponseEntityToProgramApplicantDto(applicantEntity));
  }

  /**
   * Determines whether a repository response represents a program applicant.
   *
   * @param applicantEntity Applicant response returned by the repository.
   * @returns `true` when the applicant type is defined; otherwise, `false`.
   */
  private isProgramApplicant(applicantEntity: ApplicantResponseEntity): boolean {
    const applicantType = applicantEntity.BenefitApplication.Applicant.ApplicantCategoryCode.ReferenceDataID;
    return applicantType !== undefined;
  }
}
