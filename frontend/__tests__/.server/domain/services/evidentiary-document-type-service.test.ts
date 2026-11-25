import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ServerConfig } from '~/.server/configs';
import type { EvidentiaryDocumentTypeDto, EvidentiaryDocumentTypeLocalizedDto } from '~/.server/domain/dtos';
import type { EvidentiaryDocumentTypeEntity } from '~/.server/domain/entities';
import type { EvidentiaryDocumentTypeDtoMapper } from '~/.server/domain/mappers';
import type { EvidentiaryDocumentTypeRepository } from '~/.server/domain/repositories';
import { DefaultEvidentiaryDocumentTypeService } from '~/.server/domain/services';
import { EVIDENTIARY_DOCUMENT_TYPE_STATUS } from '~/constants/evidentiary-document-type';

vi.mock(import('micro-memoize'));

function names(dtos: ReadonlyArray<EvidentiaryDocumentTypeLocalizedDto>) {
  return dtos.map(({ name }) => name);
}

describe('DefaultEvidentiaryDocumentTypeService', () => {
  const mockServerConfig: Pick<
    ServerConfig,
    'EVIDENTIARY_DOCUMENT_TYPE_CODE_OTHER' | 'LOOKUP_SVC_ALL_EVIDENTIARY_DOCUMENT_TYPES_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_EVIDENTIARY_DOCUMENT_TYPE_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_EVIDENTIARY_DOCUMENT_TYPE_CACHE_MAX_SIZE'
  > = {
    EVIDENTIARY_DOCUMENT_TYPE_CODE_OTHER: '998',
    LOOKUP_SVC_ALL_EVIDENTIARY_DOCUMENT_TYPES_CACHE_TTL_SECONDS: 10,
    LOOKUP_SVC_EVIDENTIARY_DOCUMENT_TYPE_CACHE_TTL_SECONDS: 5,
    LOOKUP_SVC_EVIDENTIARY_DOCUMENT_TYPE_CACHE_MAX_SIZE: 10,
  };

  const entities: ReadonlyArray<EvidentiaryDocumentTypeEntity> = [
    {
      esdc_evidentiarydocumenttypeid: 'active-1',
      esdc_value: 'ACTIVE-1',
      esdc_nameenglish: 'Active one',
      esdc_namefrench: 'Actif un',
      statecode: 0,
    },
    {
      esdc_evidentiarydocumenttypeid: 'inactive-1',
      esdc_value: 'INACTIVE-1',
      esdc_nameenglish: 'Inactive one',
      esdc_namefrench: 'Inactif un',
      statecode: 1,
    },
    {
      esdc_evidentiarydocumenttypeid: 'active-2',
      esdc_value: 'ACTIVE-2',
      esdc_nameenglish: 'Active two',
      esdc_namefrench: 'Actif deux',
      statecode: 0,
    },
  ];

  const activeDtos: ReadonlyArray<EvidentiaryDocumentTypeDto> = [
    { id: 'active-1', code: 'ACTIVE-1', nameEn: 'Active one', nameFr: 'Actif un', status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.active },
    { id: 'active-2', code: 'ACTIVE-2', nameEn: 'Active two', nameFr: 'Actif deux', status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.active },
  ];

  const inactiveDtos: ReadonlyArray<EvidentiaryDocumentTypeDto> = [{ id: 'inactive-1', code: 'INACTIVE-1', nameEn: 'Inactive one', nameFr: 'Inactif un', status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.inactive }];
  const allDtos = [...activeDtos, ...inactiveDtos];

  function createService(localizedDtos: ReadonlyArray<EvidentiaryDocumentTypeLocalizedDto>, serverConfig = mockServerConfig) {
    const repository = mock<EvidentiaryDocumentTypeRepository>();
    repository.listAllEvidentiaryDocumentTypes.mockResolvedValueOnce(entities);
    const mapper = mock<EvidentiaryDocumentTypeDtoMapper>();
    mapper.mapEvidentiaryDocumentTypeEntitiesToEvidentiaryDocumentTypeDtos.mockReturnValueOnce(allDtos);
    mapper.mapEvidentiaryDocumentTypeDtosToEvidentiaryDocumentTypeLocalizedDtos.mockReturnValueOnce(localizedDtos);
    return { mapper, service: new DefaultEvidentiaryDocumentTypeService(mapper, repository, serverConfig) };
  }

  it('lists all evidentiary document types without filtering', async () => {
    const repository = mock<EvidentiaryDocumentTypeRepository>();
    repository.listAllEvidentiaryDocumentTypes.mockResolvedValueOnce(entities);
    const mapper = mock<EvidentiaryDocumentTypeDtoMapper>();
    mapper.mapEvidentiaryDocumentTypeEntitiesToEvidentiaryDocumentTypeDtos.mockReturnValueOnce(allDtos);
    const service = new DefaultEvidentiaryDocumentTypeService(mapper, repository, mockServerConfig);

    await expect(service.listEvidentiaryDocumentTypes()).resolves.toEqual(allDtos);
    expect(repository.listAllEvidentiaryDocumentTypes).toHaveBeenCalledOnce();
    expect(mapper.mapEvidentiaryDocumentTypeEntitiesToEvidentiaryDocumentTypeDtos).toHaveBeenCalledExactlyOnceWith(entities);
  });

  it.each([
    {
      status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.active,
      expectedDtos: activeDtos,
    },
    {
      status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.inactive,
      expectedDtos: inactiveDtos,
    },
  ])('lists only document types with status $status', async ({ status, expectedDtos }) => {
    const repository = mock<EvidentiaryDocumentTypeRepository>();
    repository.listAllEvidentiaryDocumentTypes.mockResolvedValueOnce(entities);
    const mapper = mock<EvidentiaryDocumentTypeDtoMapper>();
    mapper.mapEvidentiaryDocumentTypeEntitiesToEvidentiaryDocumentTypeDtos.mockReturnValueOnce(allDtos);
    const service = new DefaultEvidentiaryDocumentTypeService(mapper, repository, mockServerConfig);

    await expect(service.listEvidentiaryDocumentTypesByStatus(status)).resolves.toEqual(expectedDtos);
    expect(repository.listAllEvidentiaryDocumentTypes).toHaveBeenCalledOnce();
    expect(mapper.mapEvidentiaryDocumentTypeEntitiesToEvidentiaryDocumentTypeDtos).toHaveBeenCalledExactlyOnceWith(entities);
  });

  it('maps an empty list when no document types match the status', async () => {
    const repository = mock<EvidentiaryDocumentTypeRepository>();
    repository.listAllEvidentiaryDocumentTypes.mockResolvedValueOnce([]);
    const mapper = mock<EvidentiaryDocumentTypeDtoMapper>();
    mapper.mapEvidentiaryDocumentTypeEntitiesToEvidentiaryDocumentTypeDtos.mockReturnValueOnce([]);
    const service = new DefaultEvidentiaryDocumentTypeService(mapper, repository, mockServerConfig);

    await expect(service.listEvidentiaryDocumentTypesByStatus(EVIDENTIARY_DOCUMENT_TYPE_STATUS.active)).resolves.toEqual([]);
    expect(mapper.mapEvidentiaryDocumentTypeEntitiesToEvidentiaryDocumentTypeDtos).toHaveBeenCalledExactlyOnceWith([]);
  });

  it('localizes only document types with the requested status', async () => {
    const locale = 'fr';
    const localizedDtos: ReadonlyArray<EvidentiaryDocumentTypeLocalizedDto> = [{ id: 'inactive-1', code: 'INACTIVE-1', name: 'Inactif un', status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.inactive }];
    const repository = mock<EvidentiaryDocumentTypeRepository>();
    repository.listAllEvidentiaryDocumentTypes.mockResolvedValueOnce(entities);
    const mapper = mock<EvidentiaryDocumentTypeDtoMapper>();
    mapper.mapEvidentiaryDocumentTypeEntitiesToEvidentiaryDocumentTypeDtos.mockReturnValueOnce(allDtos);
    mapper.mapEvidentiaryDocumentTypeDtosToEvidentiaryDocumentTypeLocalizedDtos.mockReturnValueOnce(localizedDtos);
    const service = new DefaultEvidentiaryDocumentTypeService(mapper, repository, mockServerConfig);

    await expect(service.listLocalizedEvidentiaryDocumentTypesByStatus(EVIDENTIARY_DOCUMENT_TYPE_STATUS.inactive, locale)).resolves.toEqual(localizedDtos);
    expect(repository.listAllEvidentiaryDocumentTypes).toHaveBeenCalledOnce();
    expect(mapper.mapEvidentiaryDocumentTypeEntitiesToEvidentiaryDocumentTypeDtos).toHaveBeenCalledExactlyOnceWith(entities);
    expect(mapper.mapEvidentiaryDocumentTypeDtosToEvidentiaryDocumentTypeLocalizedDtos).toHaveBeenCalledExactlyOnceWith(inactiveDtos, locale);
  });

  describe('listAndSortLocalizedEvidentiaryDocumentTypesByStatus', () => {
    const active = EVIDENTIARY_DOCUMENT_TYPE_STATUS.active;

    it('sorts English names alphabetically with Other last', async () => {
      const localizedDtos: ReadonlyArray<EvidentiaryDocumentTypeLocalizedDto> = [
        { id: 'other', code: '998', name: 'Other', status: active },
        { id: 'receipt', code: '002', name: 'Receipt', status: active },
        { id: 'bank', code: '001', name: 'Bank statement', status: active },
        { id: 'tax', code: '003', name: 'Tax slip', status: active },
      ];
      const { mapper, service } = createService(localizedDtos);

      const result = await service.listAndSortLocalizedEvidentiaryDocumentTypesByStatus(active, 'en');

      expect(names(result)).toEqual(['Bank statement', 'Receipt', 'Tax slip', 'Other']);
      expect(mapper.mapEvidentiaryDocumentTypeDtosToEvidentiaryDocumentTypeLocalizedDtos).toHaveBeenCalledExactlyOnceWith(activeDtos, 'en');
    });

    it('sorts French names with accents using the French locale and Autre last', async () => {
      const localizedDtos: ReadonlyArray<EvidentiaryDocumentTypeLocalizedDto> = [
        { id: 'releve', code: '002', name: 'Relevé bancaire', status: active },
        { id: 'autre', code: '998', name: 'Autre', status: active },
        { id: 'etat', code: '003', name: 'État des revenus', status: active },
        { id: 'avis', code: '001', name: 'Avis de cotisation', status: active },
      ];
      const { service } = createService(localizedDtos);

      const result = await service.listAndSortLocalizedEvidentiaryDocumentTypesByStatus(active, 'fr');

      expect(names(result)).toEqual(['Avis de cotisation', 'État des revenus', 'Relevé bancaire', 'Autre']);
    });

    it('pins the configured code last, matching it as a string', async () => {
      const localizedDtos: ReadonlyArray<EvidentiaryDocumentTypeLocalizedDto> = [
        { id: 'other', code: '998', name: 'Other', status: active },
        { id: 'misc', code: '0042', name: 'Miscellaneous', status: active },
        { id: 'zeroless', code: '42', name: 'Answer', status: active },
        { id: 'bank', code: '001', name: 'Bank statement', status: active },
      ];
      const { service } = createService(localizedDtos, { ...mockServerConfig, EVIDENTIARY_DOCUMENT_TYPE_CODE_OTHER: '0042' });

      const result = await service.listAndSortLocalizedEvidentiaryDocumentTypesByStatus(active, 'en');

      expect(names(result)).toEqual(['Answer', 'Bank statement', 'Other', 'Miscellaneous']);
    });

    it('sorts all types alphabetically when no type matches the configured code', async () => {
      const localizedDtos: ReadonlyArray<EvidentiaryDocumentTypeLocalizedDto> = [
        { id: 'receipt', code: '002', name: 'Receipt', status: active },
        { id: 'bank', code: '001', name: 'Bank statement', status: active },
      ];
      const { service } = createService(localizedDtos);

      const result = await service.listAndSortLocalizedEvidentiaryDocumentTypesByStatus(active, 'en');

      expect(names(result)).toEqual(['Bank statement', 'Receipt']);
    });

    it('does not mutate the localized list', async () => {
      const localizedDtos: ReadonlyArray<EvidentiaryDocumentTypeLocalizedDto> = [
        { id: 'other', code: '998', name: 'Other', status: active },
        { id: 'bank', code: '001', name: 'Bank statement', status: active },
      ];
      const original = [...localizedDtos];
      const { service } = createService(localizedDtos);

      await service.listAndSortLocalizedEvidentiaryDocumentTypesByStatus(active, 'en');

      expect(localizedDtos).toEqual(original);
    });
  });
});
