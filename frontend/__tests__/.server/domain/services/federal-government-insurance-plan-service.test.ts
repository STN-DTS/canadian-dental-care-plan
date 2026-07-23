import type { Memoized, Options } from 'micro-memoize';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ServerConfig } from '~/.server/configs';
import type { FederalGovernmentInsurancePlanDto, FederalGovernmentInsurancePlanLocalizedDto } from '~/.server/domain/dtos';
import { FederalGovernmentInsurancePlanNotFoundException } from '~/.server/domain/exceptions';
import type { FederalGovernmentInsurancePlanDtoMapper } from '~/.server/domain/mappers';
import type { GovernmentInsurancePlanRepository } from '~/.server/domain/repositories';
import { DefaultFederalGovernmentInsurancePlanService } from '~/.server/domain/services';

vi.mock('micro-memoize');

describe('DefaultFederalGovernmentInsurancePlanService', () => {
  const mockServerConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_FEDERAL_GOVERNMENT_INSURANCE_PLANS_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_FEDERAL_GOVERNMENT_INSURANCE_PLAN_CACHE_TTL_SECONDS'> = {
    LOOKUP_SVC_ALL_FEDERAL_GOVERNMENT_INSURANCE_PLANS_CACHE_TTL_SECONDS: 10,
    LOOKUP_SVC_FEDERAL_GOVERNMENT_INSURANCE_PLAN_CACHE_TTL_SECONDS: 5,
  };

  describe('constructor', () => {
    it('sets the correct expires for memoize options', () => {
      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig); // Act and Assert

      expect((service.listFederalGovernmentInsurancePlans as Memoized<typeof service.listFederalGovernmentInsurancePlans, Options<typeof service.listFederalGovernmentInsurancePlans>>).options.expires).toBe(10_000); // 10 seconds in milliseconds
      expect((service.getFederalGovernmentInsurancePlanById as Memoized<typeof service.getFederalGovernmentInsurancePlanById, Options<typeof service.getFederalGovernmentInsurancePlanById>>).options.expires).toBe(5000); // 5 seconds in milliseconds
    });
  });

  describe('listFederalGovernmentInsurancePlans', () => {
    it('fetches all federal government insurance plans', async () => {
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
        {
          esdc_governmentinsuranceplanid: '3',
          esdc_nameenglish: 'Third Insurance Plan',
          esdc_namefrench: "Troisième plan d'assurance",
          _esdc_provinceterritorystateid_value: '3', // Provincial plan - should be filtered out
        },
      ]);

      const mockDtos: FederalGovernmentInsurancePlanDto[] = [
        {
          id: '1',
          nameEn: 'First Insurance Plan',
          nameFr: "Premier plan d'assurance",
        },
        {
          id: '2',
          nameEn: 'Second Insurance Plan',
          nameFr: "Deuxième plan d'assurance",
        },
      ];

      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dtos = await service.listFederalGovernmentInsurancePlans();

      expect(dtos).toEqual(mockDtos);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos).toHaveBeenCalledExactlyOnceWith([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
      ]);
    });
  });

  describe('findFederalGovernmentInsurancePlanById', () => {
    it('fetches federal government insurance plan by id', async () => {
      const id = '1';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
      ]);

      const mockDtos: FederalGovernmentInsurancePlanDto[] = [
        {
          id: '1',
          nameEn: 'First Insurance Plan',
          nameFr: "Premier plan d'assurance",
        },
      ];

      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.findFederalGovernmentInsurancePlanById(id);

      expect(dto.unwrap()).toEqual({
        id: '1',
        nameEn: 'First Insurance Plan',
        nameFr: "Premier plan d'assurance",
      });
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
    });

    it('fetches federal government insurance plan by id and returns null if not found', async () => {
      const id = '1033';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([]);

      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos.mockReturnValueOnce([]);

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.findFederalGovernmentInsurancePlanById(id);

      expect(dto.isNone()).toBe(true);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
    });
  });

  describe('getFederalGovernmentInsurancePlanById', () => {
    it('fetches federal government insurance plan by id', async () => {
      const id = '1';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
      ]);

      const mockDtos: FederalGovernmentInsurancePlanDto[] = [
        {
          id: '1',
          nameEn: 'First Insurance Plan',
          nameFr: "Premier plan d'assurance",
        },
      ];

      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.getFederalGovernmentInsurancePlanById(id);

      expect(dto).toEqual({
        id: '1',
        nameEn: 'First Insurance Plan',
        nameFr: "Premier plan d'assurance",
      });
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
    });

    it('fetches federal government insurance plan by id and throws exception if not found', async () => {
      const id = '1033';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([]);

      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos.mockReturnValueOnce([]);

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      await expect(service.getFederalGovernmentInsurancePlanById(id)).rejects.toThrow(FederalGovernmentInsurancePlanNotFoundException);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
    });
  });

  describe('listAndSortLocalizedFederalGovernmentInsurancePlans', () => {
    it('fetches and sorts localized countries with Canada first', async () => {
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
        {
          esdc_governmentinsuranceplanid: '3',
          esdc_nameenglish: 'Third Insurance Plan',
          esdc_namefrench: "Troisième plan d'assurance",
          _esdc_provinceterritorystateid_value: '3', // Provincial plan - should be filtered out
        },
      ]);

      const mockMappedFederalGovernmentInsurancePlanDtos: FederalGovernmentInsurancePlanDto[] = [
        { id: '1', nameEn: 'First Insurance Plan', nameFr: "Premier plan d'assurance" },
        { id: '2', nameEn: 'Second Insurance Plan', nameFr: "Deuxième plan d'assurance" },
      ];

      const expectedFederalGovernmentInsurancePlanLocalizedDtos: FederalGovernmentInsurancePlanLocalizedDto[] = [
        { id: '1', name: 'Second Insurance Plan' },
        { id: '2', name: 'Second Insurance Plan' },
      ];

      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos.mockReturnValueOnce(mockMappedFederalGovernmentInsurancePlanDtos);
      mockFederalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtosToFederalGovernmentInsurancePlanLocalizedDtos.mockReturnValueOnce(expectedFederalGovernmentInsurancePlanLocalizedDtos);

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dtos = await service.listAndSortLocalizedFederalGovernmentInsurancePlans('en');

      expect(dtos).toStrictEqual(expectedFederalGovernmentInsurancePlanLocalizedDtos);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos).toHaveBeenCalledExactlyOnceWith([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
      ]);
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtosToFederalGovernmentInsurancePlanLocalizedDtos).toHaveBeenCalledOnce();
    });
  });

  describe('findLocalizedFederalGovernmentInsurancePlanById', () => {
    it('fetches federal government insurance plan by id and locale', async () => {
      const id = '1';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
      ]);

      const mockDtos: FederalGovernmentInsurancePlanDto[] = [
        {
          id: '1',
          nameEn: 'First Insurance Plan',
          nameFr: "Premier plan d'assurance",
        },
      ];

      const mockLocalizedDto: FederalGovernmentInsurancePlanLocalizedDto = {
        id: '1',
        name: 'First Insurance Plan',
      };

      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);
      mockFederalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto.mockReturnValueOnce(mockLocalizedDto);

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.findLocalizedFederalGovernmentInsurancePlanById(id, 'en');

      expect(dto.unwrap()).toEqual(mockLocalizedDto);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto).toHaveBeenCalledOnce();
    });

    it('fetches federal government insurance plan by id and locale and returns null if not found', async () => {
      const id = '1033';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([]);

      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos.mockReturnValueOnce([]);

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.findLocalizedFederalGovernmentInsurancePlanById(id, 'en');

      expect(dto.isNone()).toBe(true);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto).not.toHaveBeenCalled();
    });
  });

  describe('getLocalizedFederalGovernmentInsurancePlanById', () => {
    it('fetches localized federal government insurance plan by id', async () => {
      const id = '1';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
      ]);

      const mockDtos: FederalGovernmentInsurancePlanDto[] = [{ id: '1', nameEn: 'First Insurance Plan', nameFr: "Premier plan d'assurance" }];
      const mockLocalizedDto: FederalGovernmentInsurancePlanLocalizedDto = { id: '1', name: 'First Insurance Plan' };

      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);
      mockFederalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto.mockReturnValueOnce(mockLocalizedDto);

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.getLocalizedFederalGovernmentInsurancePlanById(id, 'en');

      expect(dto).toEqual(mockLocalizedDto);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto).toHaveBeenCalledOnce();
    });

    it('fetches localized federal government insurance plan by id throws not found exception', async () => {
      const id = '1033';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([]);

      const mockFederalGovernmentInsurancePlanDtoMapper = mock<FederalGovernmentInsurancePlanDtoMapper>();
      mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos.mockReturnValueOnce([]);

      const service = new DefaultFederalGovernmentInsurancePlanService(mockFederalGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      await expect(service.getLocalizedFederalGovernmentInsurancePlanById(id, 'en')).rejects.toThrow(FederalGovernmentInsurancePlanNotFoundException);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
      expect(mockFederalGovernmentInsurancePlanDtoMapper.mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto).not.toHaveBeenCalled();
    });
  });
});
