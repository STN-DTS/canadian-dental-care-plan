import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ApplicantDto, FindApplicantByBasicInfoDto, FindApplicantBySinRequestDto } from '~/.server/domain/dtos';
import type { ApplicantResponseEntity, FindApplicantByBasicInfoRequestEntity, FindApplicantBySinRequestEntity } from '~/.server/domain/entities';
import type { ApplicantDtoMapper } from '~/.server/domain/mappers';
import type { ApplicantRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { DefaultApplicantService } from '~/.server/domain/services';

describe('DefaultApplicantService', () => {
  const applicantDtoMapper = mock<ApplicantDtoMapper>();
  const applicantRepository = mock<ApplicantRepository>();
  const auditService = mock<AuditService>();
  const applicantResponseEntity = mock<ApplicantResponseEntity>();
  const basicInfoRequestEntity = mock<FindApplicantByBasicInfoRequestEntity>();
  const sinRequestEntity = mock<FindApplicantBySinRequestEntity>();

  const basicInfoRequest: FindApplicantByBasicInfoDto = {
    clientNumber: '1234567890',
    dateOfBirth: '1990-01-01',
    firstName: 'John',
    lastName: 'Doe',
    userId: 'user-id',
  };

  const sinRequest: FindApplicantBySinRequestDto = {
    sin: '123456789',
    userId: 'user-id',
  };

  const applicantDto: ApplicantDto = {
    applicantType: '775170000',
    clientId: 'client-id',
    clientNumber: '1234567890',
    communicationPreferences: {},
    contactInformation: {
      mailingAddress: {
        address: '123 Main St',
        city: 'Ottawa',
        country: 'CA',
      },
    },
    dateOfBirth: '1990-01-01',
    firstName: 'John',
    lastName: 'Doe',
  };

  let service: DefaultApplicantService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new DefaultApplicantService(applicantDtoMapper, applicantRepository, auditService);

    applicantDtoMapper.mapFindApplicantByBasicInfoRequestDtoToFindApplicantByBasicInfoRequestEntity.mockReturnValue(basicInfoRequestEntity);
    applicantDtoMapper.mapFindApplicantBySinRequestDtoToFindApplicantBySinRequestEntity.mockReturnValue(sinRequestEntity);
    applicantRepository.findApplicantByBasicInfo.mockResolvedValue(Some(applicantResponseEntity));
    applicantRepository.findApplicantBySin.mockResolvedValue(Some(applicantResponseEntity));
  });

  it('returns an unclassified applicant from the applicant basic-info lookup', async () => {
    applicantDtoMapper.mapApplicantResponseEntityToApplicantDto.mockReturnValue({ ...applicantDto, applicantType: undefined });

    const result = await service.findApplicantByBasicInfo(basicInfoRequest);

    expect(result.unwrap().applicantType).toBeUndefined();
  });

  it('returns an unclassified applicant from the applicant SIN lookup', async () => {
    applicantDtoMapper.mapApplicantResponseEntityToApplicantDto.mockReturnValue({ ...applicantDto, applicantType: undefined });

    const result = await service.findApplicantBySin(sinRequest);

    expect(result.unwrap().applicantType).toBeUndefined();
    expect(auditService.createAudit).toHaveBeenCalledWith('applicant.personal-information.get', { userId: 'user-id' });
  });

  it('preserves a missing repository result for a SIN lookup', async () => {
    applicantRepository.findApplicantBySin.mockResolvedValue(None);

    const result = await service.findApplicantBySin(sinRequest);

    expect(result.isNone()).toBe(true);
    expect(applicantDtoMapper.mapApplicantResponseEntityToApplicantDto).not.toHaveBeenCalled();
  });
});
