import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ClientEligibilityDto } from '~/.server/domain/dtos';
import type { ClientEligibilityEntity } from '~/.server/domain/entities/client-eligibility-entity';
import type { ClientEligibilityDtoMapper } from '~/.server/domain/mappers';
import type { ClientEligibilityRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { DefaultClientEligibilityService } from '~/.server/domain/services/client-eligibility-service';

function createService() {
  const clientNumberByEntity = new WeakMap<ClientEligibilityEntity, string>();
  const mapper = mock<ClientEligibilityDtoMapper>();
  mapper.mapClientEligibilityRequestDtoToClientEligibilityRequestEntity.mockImplementation((dtos) =>
    dtos.map(({ clientNumber }) => ({ Applicant: { PersonClientNumberIdentification: { IdentificationID: clientNumber, IdentificationCategoryText: 'Client Number' } } })),
  );
  mapper.mapClientEligibilityEntityToClientEligibilityDto.mockImplementation((entity) => mock<ClientEligibilityDto>({ clientNumber: clientNumberByEntity.get(entity) }));
  const repository = mock<ClientEligibilityRepository>();
  repository.listClientEligibilitiesByClientNumbers.mockImplementation(async (request) => {
    await Promise.resolve();
    return request.map(({ Applicant }) => {
      const entity = mock<ClientEligibilityEntity>();
      clientNumberByEntity.set(entity, Applicant.PersonClientNumberIdentification.IdentificationID);
      return entity;
    });
  });
  const auditService = mock<AuditService>();
  const service = new DefaultClientEligibilityService(mapper, repository, auditService, {
    ELIGIBILITY_STATUS_CODE_ELIGIBLE: 'eligible',
    LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_TTL_SECONDS: 60,
    LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_MAX_SIZE: 10,
  });

  return { auditService, repository, service };
}

describe('DefaultClientEligibilityService', () => {
  describe('listClientEligibilitiesByClientNumbers', () => {
    it('reuses cached eligibility for the same client numbers in any order', async () => {
      const { repository, service } = createService();

      const first = await service.listClientEligibilitiesByClientNumbers(['2', '1']);
      const second = await service.listClientEligibilitiesByClientNumbers(['1', '2', '1']);

      expect([...first.keys()]).toEqual(['2', '1']);
      expect(second).toBe(first);
      expect(repository.listClientEligibilitiesByClientNumbers).toHaveBeenCalledOnce();
    });

    it('fetches eligibility again for different client numbers', async () => {
      const { repository, service } = createService();

      await service.listClientEligibilitiesByClientNumbers(['1']);
      const result = await service.listClientEligibilitiesByClientNumbers(['1', '2']);

      expect([...result.keys()]).toEqual(['1', '2']);
      expect(repository.listClientEligibilitiesByClientNumbers).toHaveBeenCalledTimes(2);
    });

    it('records an audit on every call, including cache hits', async () => {
      const { auditService, service } = createService();

      await service.listClientEligibilitiesByClientNumbers(['1']);
      await service.listClientEligibilitiesByClientNumbers(['1']);

      expect(auditService.createAudit).toHaveBeenCalledTimes(2);
      expect(auditService.createAudit).toHaveBeenCalledWith('client-eligibility.number.get');
    });
  });
});
