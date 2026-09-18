import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { FindProgramApplicantByBasicInfoDto, FindProgramApplicantBySinRequestDto, ProgramApplicantDto } from '~/.server/domain/dtos';
import type { ApplicantResponseEntity, FindApplicantByBasicInfoRequestEntity, FindApplicantBySinRequestEntity } from '~/.server/domain/entities';
import type { ProgramApplicantDtoMapper } from '~/.server/domain/mappers';
import type { ApplicantRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { DefaultProgramApplicantService } from '~/.server/domain/services';

describe('DefaultProgramApplicantService', () => {
  const mapper = mock<ProgramApplicantDtoMapper>();
  const repository = mock<ApplicantRepository>();
  const auditService = mock<AuditService>();
  const basicInfoRequestEntity = mock<FindApplicantByBasicInfoRequestEntity>();
  const sinRequestEntity = mock<FindApplicantBySinRequestEntity>();
  const categorizedEntity = {
    BenefitApplication: { Applicant: { ApplicantCategoryCode: { ReferenceDataID: '775170000' } } },
  } as ApplicantResponseEntity;
  const uncategorizedEntity = {
    BenefitApplication: { Applicant: { ApplicantCategoryCode: {} } },
  } as ApplicantResponseEntity;
  const programApplicant = { applicantType: '775170000' } as ProgramApplicantDto;
  const basicInfoRequest: FindProgramApplicantByBasicInfoDto = {
    clientNumber: '1234567890',
    dateOfBirth: '1990-01-01',
    firstName: 'John',
    lastName: 'Doe',
    userId: 'user-id',
  };
  const sinRequest: FindProgramApplicantBySinRequestDto = { sin: '123456789', userId: 'user-id' };

  let service: DefaultProgramApplicantService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new DefaultProgramApplicantService(mapper, repository, auditService);
    mapper.mapFindProgramApplicantByBasicInfoDtoToFindApplicantByBasicInfoRequestEntity.mockReturnValue(basicInfoRequestEntity);
    mapper.mapFindProgramApplicantBySinRequestDtoToFindApplicantBySinRequestEntity.mockReturnValue(sinRequestEntity);
    mapper.mapApplicantResponseEntityToProgramApplicantDto.mockReturnValue(programApplicant);
  });

  it('returns a categorized program applicant found by basic info', async () => {
    repository.findApplicantByBasicInfo.mockResolvedValue(Some(categorizedEntity));

    const result = await service.findProgramApplicantByBasicInfo(basicInfoRequest);

    expect(result.unwrap()).toBe(programApplicant);
    expect(repository.findApplicantByBasicInfo).toHaveBeenCalledWith(basicInfoRequestEntity);
    expect(auditService.createAudit).toHaveBeenCalledWith('program-applicant.basic-info.get', { userId: 'user-id' });
  });

  it('returns none when the applicant has no category', async () => {
    repository.findApplicantBySin.mockResolvedValue(Some(uncategorizedEntity));

    const result = await service.findProgramApplicantBySin(sinRequest);

    expect(result.isNone()).toBe(true);
    expect(mapper.mapApplicantResponseEntityToProgramApplicantDto).not.toHaveBeenCalled();
  });

  it('preserves a missing repository result', async () => {
    repository.findApplicantBySin.mockResolvedValue(None);

    const result = await service.findProgramApplicantBySin(sinRequest);

    expect(result.isNone()).toBe(true);
    expect(auditService.createAudit).toHaveBeenCalledWith('program-applicant.personal-information.get', { userId: 'user-id' });
  });

  it('propagates strict mapper failures for categorized applicants', async () => {
    repository.findApplicantBySin.mockResolvedValue(Some(categorizedEntity));
    mapper.mapApplicantResponseEntityToProgramApplicantDto.mockImplementation(() => {
      throw new Error('Invalid program applicant');
    });

    await expect(service.findProgramApplicantBySin(sinRequest)).rejects.toThrow('Invalid program applicant');
  });
});
