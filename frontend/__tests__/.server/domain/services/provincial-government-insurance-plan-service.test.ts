import type { Memoized, Options } from 'micro-memoize';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ServerConfig } from '~/.server/configs';
import type { ProvincialGovernmentInsurancePlanDto, ProvincialGovernmentInsurancePlanLocalizedDto } from '~/.server/domain/dtos';
import { ProvincialGovernmentInsurancePlanNotFoundException } from '~/.server/domain/exceptions';
import type { ProvincialGovernmentInsurancePlanDtoMapper } from '~/.server/domain/mappers';
import type { GovernmentInsurancePlanRepository } from '~/.server/domain/repositories';
import { DefaultProvincialGovernmentInsurancePlanService } from '~/.server/domain/services';

vi.mock('micro-memoize');

describe('DefaultProvincialGovernmentInsurancePlanService', () => {
  const mockServerConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_PROVINCIAL_GOVERNMENT_INSURANCE_PLANS_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_PROVINCIAL_GOVERNMENT_INSURANCE_PLAN_CACHE_TTL_SECONDS'> = {
    LOOKUP_SVC_ALL_PROVINCIAL_GOVERNMENT_INSURANCE_PLANS_CACHE_TTL_SECONDS: 10,
    LOOKUP_SVC_PROVINCIAL_GOVERNMENT_INSURANCE_PLAN_CACHE_TTL_SECONDS: 5,
  };

  describe('constructor', () => {
    it('sets the correct expires for memoize options', () => {
      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig); // Act and Assert

      expect((service.listProvincialGovernmentInsurancePlans as Memoized<typeof service.listProvincialGovernmentInsurancePlans, Options<typeof service.listProvincialGovernmentInsurancePlans>>).options.expires).toBe(10_000); // 10 seconds in milliseconds
      expect((service.getProvincialGovernmentInsurancePlanById as Memoized<typeof service.getProvincialGovernmentInsurancePlanById, Options<typeof service.getProvincialGovernmentInsurancePlanById>>).options.expires).toBe(5000); // 5 seconds in milliseconds
    });
  });

  describe('listProvincialGovernmentInsurancePlans', () => {
    it('fetches all provincial government insurance plans', async () => {
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: '10',
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: '20',
        },
        {
          esdc_governmentinsuranceplanid: '3',
          esdc_nameenglish: 'Third Insurance Plan',
          esdc_namefrench: "Troisième plan d'assurance",
          _esdc_provinceterritorystateid_value: null, // Federal plan - should be filtered out
        },
      ]);

      const mockDtos: ProvincialGovernmentInsurancePlanDto[] = [
        {
          id: '1',
          nameEn: 'First Insurance Plan',
          nameFr: "Premier plan d'assurance",
          provinceTerritoryStateId: '10',
        },
        {
          id: '2',
          nameEn: 'Second Insurance Plan',
          nameFr: "Deuxième plan d'assurance",
          provinceTerritoryStateId: '20',
        },
      ];

      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dtos = await service.listProvincialGovernmentInsurancePlans();

      expect(dtos).toEqual(mockDtos);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos).toHaveBeenCalledExactlyOnceWith([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: '10',
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: '20',
        },
      ]);
    });
  });

  describe('getProvincialGovernmentInsurancePlanById', () => {
    it('fetches provincial government insurance plan by id', async () => {
      const id = '1';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: '10',
        },
      ]);

      const mockDtos: ProvincialGovernmentInsurancePlanDto[] = [
        {
          id: '1',
          nameEn: 'First Insurance Plan',
          nameFr: "Premier plan d'assurance",
          provinceTerritoryStateId: '10',
        },
      ];

      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.getProvincialGovernmentInsurancePlanById(id);

      expect(dto).toEqual({
        id: '1',
        nameEn: 'First Insurance Plan',
        nameFr: "Premier plan d'assurance",
        provinceTerritoryStateId: '10',
      });
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
    });

    it('fetches provincial government insurance plan by id and throws exception if not found', async () => {
      const id = '1033';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([]);

      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos.mockReturnValueOnce([]);

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      await expect(service.getProvincialGovernmentInsurancePlanById(id)).rejects.toThrow(ProvincialGovernmentInsurancePlanNotFoundException);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
    });
  });

  describe('findProvincialGovernmentInsurancePlanById', () => {
    it('fetches provincial government insurance plan by id', async () => {
      const id = '1';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: '10',
        },
      ]);

      const mockDtos: ProvincialGovernmentInsurancePlanDto[] = [
        {
          id: '1',
          nameEn: 'First Insurance Plan',
          nameFr: "Premier plan d'assurance",
          provinceTerritoryStateId: '10',
        },
      ];

      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.findProvincialGovernmentInsurancePlanById(id);

      expect(dto.unwrap()).toEqual({
        id: '1',
        nameEn: 'First Insurance Plan',
        nameFr: "Premier plan d'assurance",
        provinceTerritoryStateId: '10',
      });
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
    });

    it('fetches provincial government insurance plan by id and returns null if not found', async () => {
      const id = '1033';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([]);

      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos.mockReturnValueOnce([]);

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.findProvincialGovernmentInsurancePlanById(id);

      expect(dto.isNone()).toBe(true);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
    });
  });

  describe('listAndSortLocalizedProvincialGovernmentInsurancePlans', () => {
    it('should return a list of localized provincial government insurance plans', async () => {
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: '10',
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: '20',
        },
        {
          esdc_governmentinsuranceplanid: '3',
          esdc_nameenglish: 'Third Insurance Plan',
          esdc_namefrench: "Troisième plan d'assurance",
          _esdc_provinceterritorystateid_value: null, // Federal plan - should be filtered out
        },
      ]);

      const mockDtos: ProvincialGovernmentInsurancePlanDto[] = [
        { id: '1', nameEn: 'First Insurance Plan', nameFr: "Premier plan d'assurance", provinceTerritoryStateId: '10' },
        { id: '2', nameEn: 'Second Insurance Plan', nameFr: "Deuxième plan d'assurance", provinceTerritoryStateId: '20' },
      ];

      const mockLocalizedDtos: ProvincialGovernmentInsurancePlanLocalizedDto[] = [
        { id: '1', name: 'First Insurance Plan', provinceTerritoryStateId: '2' },
        { id: '2', name: 'Second Insurance Plan', provinceTerritoryStateId: '3' },
      ];

      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);
      mockProvincialGovernmentInsurancePlanDtoMapper.mapProvincialGovernmentInsurancePlanDtosToProvincialGovernmentInsurancePlanLocalizedDtos.mockReturnValueOnce(mockLocalizedDtos);

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dtos = await service.listAndSortLocalizedProvincialGovernmentInsurancePlans('en');

      expect(dtos).toEqual(mockLocalizedDtos);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos).toHaveBeenCalledExactlyOnceWith([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: '10',
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: '20',
        },
      ]);
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapProvincialGovernmentInsurancePlanDtosToProvincialGovernmentInsurancePlanLocalizedDtos).toHaveBeenCalledOnce();
    });
  });

  describe('findLocalizedProvincialGovernmentInsurancePlanById', () => {
    it('fetches provincial government insurance plan by id and locale', async () => {
      const id = '1';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: '10',
        },
      ]);

      const mockDtos: ProvincialGovernmentInsurancePlanDto[] = [
        {
          id: '1',
          nameEn: 'First Insurance Plan',
          nameFr: "Premier plan d'assurance",
          provinceTerritoryStateId: '10',
        },
      ];

      const mockLocalizedDto: ProvincialGovernmentInsurancePlanLocalizedDto = {
        id: '1',
        name: 'First Insurance Plan',
        provinceTerritoryStateId: '2',
      };

      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);
      mockProvincialGovernmentInsurancePlanDtoMapper.mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto.mockReturnValueOnce(mockLocalizedDto);

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.findLocalizedProvincialGovernmentInsurancePlanById(id, 'en');

      expect(dto.unwrap()).toEqual(mockLocalizedDto);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto).toHaveBeenCalledOnce();
    });

    it('fetches provincial government insurance plan by id and locale and returns null if not found', async () => {
      const id = '1033';
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([]);

      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos.mockReturnValueOnce([]);

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dto = await service.findLocalizedProvincialGovernmentInsurancePlanById(id, 'en');

      expect(dto.isNone()).toBe(true);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
    });
  });

  describe('getLocalizedProvincialGovernmentInsurancePlanById', () => {
    it('should return a localized provincial government insurance plan by id', async () => {
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: '10',
        },
      ]);

      const mockDtos: ProvincialGovernmentInsurancePlanDto[] = [{ id: '1', nameEn: 'First Insurance Plan', nameFr: "Premier plan d'assurance", provinceTerritoryStateId: '10' }];

      const mockLocalizedDto: ProvincialGovernmentInsurancePlanLocalizedDto = { id: '1', name: 'First Insurance Plan', provinceTerritoryStateId: '2' };

      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos.mockReturnValueOnce(mockDtos);
      mockProvincialGovernmentInsurancePlanDtoMapper.mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto.mockReturnValueOnce(mockLocalizedDto);

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      const dtos = await service.getLocalizedProvincialGovernmentInsurancePlanById('1', 'en');

      expect(dtos).toEqual(mockLocalizedDto);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto).toHaveBeenCalledOnce();
    });

    it('should throw an error if no provincial government insurance plan is found', async () => {
      const mockGovernmentInsurancePlanRepository = mock<GovernmentInsurancePlanRepository>();
      mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans.mockResolvedValueOnce([]);

      const mockProvincialGovernmentInsurancePlanDtoMapper = mock<ProvincialGovernmentInsurancePlanDtoMapper>();
      mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos.mockReturnValueOnce([]);

      const service = new DefaultProvincialGovernmentInsurancePlanService(mockProvincialGovernmentInsurancePlanDtoMapper, mockGovernmentInsurancePlanRepository, mockServerConfig);

      await expect(service.getLocalizedProvincialGovernmentInsurancePlanById('1', 'en')).rejects.toThrow(ProvincialGovernmentInsurancePlanNotFoundException);
      expect(mockGovernmentInsurancePlanRepository.listAllGovernmentInsurancePlans).toHaveBeenCalledOnce();
      expect(mockProvincialGovernmentInsurancePlanDtoMapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos).toHaveBeenCalledOnce();
    });
  });
});
