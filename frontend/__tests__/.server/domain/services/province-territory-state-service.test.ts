import type { Memoized, Options } from 'micro-memoize';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ServerConfig } from '~/.server/configs';
import type { ProvinceTerritoryStateDto, ProvinceTerritoryStateLocalizedDto } from '~/.server/domain/dtos';
import { ProvinceTerritoryStateNotFoundException } from '~/.server/domain/exceptions';
import type { ProvinceTerritoryStateDtoMapper } from '~/.server/domain/mappers';
import type { ProvinceTerritoryStateRepository } from '~/.server/domain/repositories';
import { DefaultProvinceTerritoryStateService } from '~/.server/domain/services';

vi.mock('micro-memoize');

describe('DefaultProvinceTerritoryStateService', () => {
  const mockServerConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_PROVINCE_TERRITORY_STATES_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_PROVINCE_TERRITORY_STATE_CACHE_TTL_SECONDS'> = {
    LOOKUP_SVC_ALL_PROVINCE_TERRITORY_STATES_CACHE_TTL_SECONDS: 10,
    LOOKUP_SVC_PROVINCE_TERRITORY_STATE_CACHE_TTL_SECONDS: 5,
  };

  describe('constructor', () => {
    it('sets the correct expires for memoize options', () => {
      const mockProvinceTerritoryStateDtoMapper = mock<ProvinceTerritoryStateDtoMapper>();
      const mockProvinceTerritoryStateRepository = mock<ProvinceTerritoryStateRepository>();

      const service = new DefaultProvinceTerritoryStateService(mockProvinceTerritoryStateDtoMapper, mockProvinceTerritoryStateRepository, mockServerConfig); // Act and Assert

      expect((service.listProvinceTerritoryStates as Memoized<typeof service.listProvinceTerritoryStates, Options<typeof service.listProvinceTerritoryStates>>).options.expires).toBe(10_000); // 10 seconds in milliseconds
      expect((service.getProvinceTerritoryStateById as Memoized<typeof service.getProvinceTerritoryStateById, Options<typeof service.getProvinceTerritoryStateById>>).options.expires).toBe(5000); // 5 seconds in milliseconds
    });
  });

  describe('listProvinceTerritoryStates', () => {
    it('fetches all province territory states', async () => {
      const mockProvinceTerritoryStateRepository = mock<ProvinceTerritoryStateRepository>();
      mockProvinceTerritoryStateRepository.listAllProvinceTerritoryStates.mockResolvedValueOnce([
        {
          esdc_provinceterritorystateid: '1',
          _esdc_countryid_value: '1',
          esdc_nameenglish: 'English',
          esdc_namefrench: 'Français',
          esdc_internationalalphacode: 'EN',
        },
        {
          esdc_provinceterritorystateid: '2',
          _esdc_countryid_value: '2',
          esdc_nameenglish: 'French',
          esdc_namefrench: 'Français',
          esdc_internationalalphacode: 'FR',
        },
      ]);

      const mockDtos: ProvinceTerritoryStateDto[] = [
        { id: '1', countryId: '1', nameEn: 'English', nameFr: 'Français', abbr: 'EN' },
        { id: '2', countryId: '2', nameEn: 'French', nameFr: 'Français', abbr: 'FR' },
      ];

      const mockProvinceTerritoryStateDtoMapper = mock<ProvinceTerritoryStateDtoMapper>();
      mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntitiesToProvinceTerritoryStateDtos.mockReturnValueOnce(mockDtos);

      const service = new DefaultProvinceTerritoryStateService(mockProvinceTerritoryStateDtoMapper, mockProvinceTerritoryStateRepository, mockServerConfig);

      const dtos = await service.listProvinceTerritoryStates();

      expect(dtos).toEqual(mockDtos);
      expect(mockProvinceTerritoryStateRepository.listAllProvinceTerritoryStates).toHaveBeenCalledOnce();
      expect(mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntitiesToProvinceTerritoryStateDtos).toHaveBeenCalledOnce();
    });
  });

  describe('getProvinceTerritoryStateById', () => {
    it('fetches province territory state by id', async () => {
      const id = '1';
      const mockProvinceTerritoryStateRepository = mock<ProvinceTerritoryStateRepository>();
      mockProvinceTerritoryStateRepository.findProvinceTerritoryStateById.mockResolvedValueOnce(
        Some({
          esdc_provinceterritorystateid: '1',
          _esdc_countryid_value: '1',
          esdc_nameenglish: 'English',
          esdc_namefrench: 'Français',
          esdc_internationalalphacode: 'EN',
        }),
      );

      const mockDto: ProvinceTerritoryStateDto = { id: '1', countryId: '1', nameEn: 'English', nameFr: 'Français', abbr: 'EN' };

      const mockProvinceTerritoryStateDtoMapper = mock<ProvinceTerritoryStateDtoMapper>();
      mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntityToProvinceTerritoryStateDto.mockReturnValueOnce(mockDto);

      const service = new DefaultProvinceTerritoryStateService(mockProvinceTerritoryStateDtoMapper, mockProvinceTerritoryStateRepository, mockServerConfig);

      const dto = await service.getProvinceTerritoryStateById(id);

      expect(dto).toEqual(mockDto);
      expect(mockProvinceTerritoryStateRepository.findProvinceTerritoryStateById).toHaveBeenCalledOnce();
      expect(mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntityToProvinceTerritoryStateDto).toHaveBeenCalledOnce();
    });

    it('fetches province territory state by id and throws exception if not found', async () => {
      const id = '1033';
      const mockProvinceTerritoryStateRepository = mock<ProvinceTerritoryStateRepository>();
      mockProvinceTerritoryStateRepository.findProvinceTerritoryStateById.mockResolvedValueOnce(None);

      const mockProvinceTerritoryStateDtoMapper = mock<ProvinceTerritoryStateDtoMapper>();

      const service = new DefaultProvinceTerritoryStateService(mockProvinceTerritoryStateDtoMapper, mockProvinceTerritoryStateRepository, mockServerConfig);

      await expect(service.getProvinceTerritoryStateById(id)).rejects.toThrow(ProvinceTerritoryStateNotFoundException);
      expect(mockProvinceTerritoryStateRepository.findProvinceTerritoryStateById).toHaveBeenCalledOnce();
      expect(mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntityToProvinceTerritoryStateDto).not.toHaveBeenCalled();
    });
  });

  describe('listAndSortLocalizedProvinceTerritoryStates', () => {
    it('fetches and sorts all localized province territory states', async () => {
      const locale = 'en';
      const mockProvinceTerritoryStateRepository = mock<ProvinceTerritoryStateRepository>();
      mockProvinceTerritoryStateRepository.listAllProvinceTerritoryStates.mockResolvedValueOnce([
        {
          esdc_provinceterritorystateid: '1',
          _esdc_countryid_value: '1',
          esdc_nameenglish: 'English',
          esdc_namefrench: 'Français',
          esdc_internationalalphacode: 'EN',
        },
        {
          esdc_provinceterritorystateid: '2',
          _esdc_countryid_value: '2',
          esdc_nameenglish: 'French',
          esdc_namefrench: 'Français',
          esdc_internationalalphacode: 'FR',
        },
      ]);

      const mockDtos: ProvinceTerritoryStateDto[] = [
        { id: '1', countryId: '1', nameEn: 'English', nameFr: 'Français', abbr: 'EN' },
        { id: '2', countryId: '2', nameEn: 'French', nameFr: 'Français', abbr: 'FR' },
      ];

      const mockLocalizedDtos: ProvinceTerritoryStateLocalizedDto[] = [
        { id: '1', countryId: '1', name: 'English', abbr: 'EN' },
        { id: '2', countryId: '2', name: 'French', abbr: 'FR' },
      ];

      const mockProvinceTerritoryStateDtoMapper = mock<ProvinceTerritoryStateDtoMapper>();
      mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntitiesToProvinceTerritoryStateDtos.mockReturnValueOnce(mockDtos);
      mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateDtosToProvinceTerritoryStateLocalizedDtos.mockReturnValueOnce(mockLocalizedDtos);

      const service = new DefaultProvinceTerritoryStateService(mockProvinceTerritoryStateDtoMapper, mockProvinceTerritoryStateRepository, mockServerConfig);

      const dtos = await service.listAndSortLocalizedProvinceTerritoryStates(locale);

      expect(dtos).toEqual(mockLocalizedDtos);
      expect(mockProvinceTerritoryStateRepository.listAllProvinceTerritoryStates).toHaveBeenCalledOnce();
      expect(mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntitiesToProvinceTerritoryStateDtos).toHaveBeenCalledOnce();
      expect(mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateDtosToProvinceTerritoryStateLocalizedDtos).toHaveBeenCalledOnce();
    });
  });

  describe('listAndSortLocalizedProvinceTerritoryStatesByCountryId', () => {
    it('fetches, filters by countryId, localizes, and sorts all province territory states', async () => {
      const countryId = '1';
      const locale = 'en';
      const mockProvinceTerritoryStateRepository = mock<ProvinceTerritoryStateRepository>();
      mockProvinceTerritoryStateRepository.listAllProvinceTerritoryStates.mockResolvedValueOnce([
        {
          esdc_provinceterritorystateid: '1',
          _esdc_countryid_value: '1',
          esdc_nameenglish: 'English1',
          esdc_namefrench: 'Français1',
          esdc_internationalalphacode: 'EN',
        },
        {
          esdc_provinceterritorystateid: '2',
          _esdc_countryid_value: '2',
          esdc_nameenglish: 'English2',
          esdc_namefrench: 'Français2',
          esdc_internationalalphacode: 'FR',
        },
        {
          esdc_provinceterritorystateid: '3',
          _esdc_countryid_value: '1',
          esdc_nameenglish: 'English3',
          esdc_namefrench: 'Français3',
          esdc_internationalalphacode: 'CA',
        },
      ]);

      const mockDtos: ProvinceTerritoryStateDto[] = [
        { id: '1', countryId: '1', nameEn: 'English1', nameFr: 'Français1', abbr: 'EN' },
        { id: '2', countryId: '2', nameEn: 'English2', nameFr: 'Français2', abbr: 'FR' },
        { id: '3', countryId: '1', nameEn: 'English3', nameFr: 'Français3', abbr: 'CA' },
      ];

      const mockLocalizedDtos: ProvinceTerritoryStateLocalizedDto[] = [
        { id: '1', countryId: '1', name: 'English1', abbr: 'EN' },
        { id: '3', countryId: '1', name: 'English3', abbr: 'CA' },
      ];

      const mockProvinceTerritoryStateDtoMapper = mock<ProvinceTerritoryStateDtoMapper>();
      mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntitiesToProvinceTerritoryStateDtos.mockReturnValueOnce(mockDtos);
      mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateDtosToProvinceTerritoryStateLocalizedDtos.mockReturnValueOnce(mockLocalizedDtos);

      const service = new DefaultProvinceTerritoryStateService(mockProvinceTerritoryStateDtoMapper, mockProvinceTerritoryStateRepository, mockServerConfig);

      const dtos = await service.listAndSortLocalizedProvinceTerritoryStatesByCountryId(countryId, locale);

      expect(dtos).toEqual(mockLocalizedDtos);
      expect(mockProvinceTerritoryStateRepository.listAllProvinceTerritoryStates).toHaveBeenCalledOnce();
      expect(mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntitiesToProvinceTerritoryStateDtos).toHaveBeenCalledOnce();
      expect(mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateDtosToProvinceTerritoryStateLocalizedDtos).toHaveBeenCalledOnce();
    });
  });

  describe('getLocalizedProvinceTerritoryStateById', () => {
    it('fetches localized province territory state by id', async () => {
      const id = '1';
      const locale = 'en';
      const mockProvinceTerritoryStateRepository = mock<ProvinceTerritoryStateRepository>();
      mockProvinceTerritoryStateRepository.findProvinceTerritoryStateById.mockResolvedValueOnce(
        Some({
          esdc_provinceterritorystateid: '1',
          _esdc_countryid_value: '1',
          esdc_nameenglish: 'English',
          esdc_namefrench: 'Français',
          esdc_internationalalphacode: 'EN',
        }),
      );

      const mockDto: ProvinceTerritoryStateDto = { id: '1', countryId: '1', nameEn: 'English', nameFr: 'Français', abbr: 'EN' };
      const mockLocalizedDto: ProvinceTerritoryStateLocalizedDto = { id: '1', countryId: '1', name: 'English', abbr: 'EN' };

      const mockProvinceTerritoryStateDtoMapper = mock<ProvinceTerritoryStateDtoMapper>();
      mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntityToProvinceTerritoryStateDto.mockReturnValueOnce(mockDto);
      mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateDtoToProvinceTerritoryStateLocalizedDto.mockReturnValueOnce(mockLocalizedDto);

      const service = new DefaultProvinceTerritoryStateService(mockProvinceTerritoryStateDtoMapper, mockProvinceTerritoryStateRepository, mockServerConfig);

      const dto = await service.getLocalizedProvinceTerritoryStateById(id, locale);

      expect(dto).toEqual(mockLocalizedDto);
      expect(mockProvinceTerritoryStateRepository.findProvinceTerritoryStateById).toHaveBeenCalledOnce();
      expect(mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateEntityToProvinceTerritoryStateDto).toHaveBeenCalledOnce();
      expect(mockProvinceTerritoryStateDtoMapper.mapProvinceTerritoryStateDtoToProvinceTerritoryStateLocalizedDto).toHaveBeenCalledOnce();
    });
  });
});
