import type { Memoized, Options } from 'micro-memoize';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CountryDto, CountryLocalizedDto } from '~/.server/domain/dtos';
import { CountryNotFoundException } from '~/.server/domain/exceptions';
import type { CountryDtoMapper } from '~/.server/domain/mappers';
import type { CountryRepository } from '~/.server/domain/repositories';
import type { CountryServiceImpl_ServiceConfig } from '~/.server/domain/services';
import { DefaultCountryService } from '~/.server/domain/services';

vi.mock('micro-memoize');

describe('DefaultCountryService', () => {
  const mockServerConfig: CountryServiceImpl_ServiceConfig = {
    CANADA_COUNTRY_ID: '1',
    LOOKUP_SVC_ALL_COUNTRIES_CACHE_TTL_SECONDS: 10,
    LOOKUP_SVC_COUNTRY_CACHE_TTL_SECONDS: 5,
  };

  describe('constructor', () => {
    it('sets the correct expires for memoize options', () => {
      const mockCountryDtoMapper = mock<CountryDtoMapper>();
      const mockCountryRepository = mock<CountryRepository>();

      const service = new DefaultCountryService(mockCountryDtoMapper, mockCountryRepository, mockServerConfig); // Act and Assert

      expect((service.listCountries as Memoized<typeof service.listCountries, Options<typeof service.listCountries>>).options.expires).toBe(10_000); // 10 seconds in milliseconds
      expect((service.getCountryById as Memoized<typeof service.getCountryById, Options<typeof service.getCountryById>>).options.expires).toBe(5000); // 5 seconds in milliseconds
    });
  });

  describe('listCountries', () => {
    it('fetches all countries', async () => {
      const mockCountryRepository = mock<CountryRepository>();
      mockCountryRepository.listAllCountries.mockResolvedValueOnce([
        {
          esdc_countryid: '1',
          esdc_nameenglish: 'Canada English',
          esdc_namefrench: 'Canada Français',
          esdc_countrycodealpha3: 'CAN',
        },
        {
          esdc_countryid: '2',
          esdc_nameenglish: 'United States English',
          esdc_namefrench: 'États-Unis Français',
          esdc_countrycodealpha3: 'USA',
        },
      ]);

      const mockDtos: CountryDto[] = [
        { id: '1', nameEn: 'Canada English', nameFr: 'Canada Français' },
        { id: '2', nameEn: 'United States English', nameFr: 'États-Unis Français' },
      ];

      const mockCountryDtoMapper = mock<CountryDtoMapper>();
      mockCountryDtoMapper.mapCountryEntitiesToCountryDtos.mockReturnValueOnce(mockDtos);

      const service = new DefaultCountryService(mockCountryDtoMapper, mockCountryRepository, mockServerConfig);

      const dtos = await service.listCountries();

      expect(dtos).toEqual(mockDtos);
      expect(mockCountryRepository.listAllCountries).toHaveBeenCalledOnce();
      expect(mockCountryDtoMapper.mapCountryEntitiesToCountryDtos).toHaveBeenCalledOnce();
    });
  });

  describe('getCountry', () => {
    it('fetches country by id', async () => {
      const id = '1';
      const mockCountryRepository = mock<CountryRepository>();
      mockCountryRepository.findCountryById.mockResolvedValueOnce(
        Some({
          esdc_countryid: '1',
          esdc_nameenglish: 'Canada English',
          esdc_namefrench: 'Canada Français',
          esdc_countrycodealpha3: 'CAN',
        }),
      );

      const mockDto: CountryDto = { id: '1', nameEn: 'Canada English', nameFr: 'Canada Français' };

      const mockCountryDtoMapper = mock<CountryDtoMapper>();
      mockCountryDtoMapper.mapCountryEntityToCountryDto.mockReturnValueOnce(mockDto);

      const service = new DefaultCountryService(mockCountryDtoMapper, mockCountryRepository, mockServerConfig);

      const dto = await service.getCountryById(id);

      expect(dto).toEqual(mockDto);
      expect(mockCountryRepository.findCountryById).toHaveBeenCalledOnce();
      expect(mockCountryDtoMapper.mapCountryEntityToCountryDto).toHaveBeenCalledOnce();
    });

    it('fetches country by id throws not found exception', async () => {
      const id = '1033';
      const mockCountryRepository = mock<CountryRepository>();
      mockCountryRepository.findCountryById.mockResolvedValueOnce(None);

      const mockCountryDtoMapper = mock<CountryDtoMapper>();

      const service = new DefaultCountryService(mockCountryDtoMapper, mockCountryRepository, mockServerConfig);

      await expect(service.getCountryById(id)).rejects.toThrow(CountryNotFoundException);
      expect(mockCountryRepository.findCountryById).toHaveBeenCalledOnce();
      expect(mockCountryDtoMapper.mapCountryEntityToCountryDto).not.toHaveBeenCalled();
    });
  });

  describe('listAndSortLocalizedCountries', () => {
    it('fetches and sorts localized countries with Canada first', async () => {
      const mockCountryRepository = mock<CountryRepository>();
      mockCountryRepository.listAllCountries.mockResolvedValueOnce([
        {
          esdc_countryid: '1',
          esdc_nameenglish: 'Canada English',
          esdc_namefrench: 'Canada Français',
          esdc_countrycodealpha3: 'CAN',
        },
        {
          esdc_countryid: '2',
          esdc_nameenglish: 'United States English',
          esdc_namefrench: 'États-Unis Français',
          esdc_countrycodealpha3: 'USA',
        },
        {
          esdc_countryid: '3',
          esdc_nameenglish: 'Australia English',
          esdc_namefrench: 'Australia Français',
          esdc_countrycodealpha3: 'AUS',
        },
      ]);

      const mockMappedCountryLocalizedDtos: CountryLocalizedDto[] = [
        { id: '1', name: 'Canada English' },
        { id: '2', name: 'United States English' },
        { id: '3', name: 'Australia English' },
      ];

      const expectedCountryLocalizedDtos: CountryLocalizedDto[] = [
        { id: '1', name: 'Canada English' },
        { id: '3', name: 'Australia English' },
        { id: '2', name: 'United States English' },
      ];

      const mockCountryDtoMapper = mock<CountryDtoMapper>();
      mockCountryDtoMapper.mapCountryDtosToCountryLocalizedDtos.mockReturnValueOnce(mockMappedCountryLocalizedDtos);

      const service = new DefaultCountryService(mockCountryDtoMapper, mockCountryRepository, mockServerConfig);

      const dtos = await service.listAndSortLocalizedCountries('en');

      expect(dtos).toStrictEqual(expectedCountryLocalizedDtos);
      expect(mockCountryRepository.listAllCountries).toHaveBeenCalledOnce();
      expect(mockCountryDtoMapper.mapCountryDtosToCountryLocalizedDtos).toHaveBeenCalledOnce();
    });
  });

  describe('getLocalizedCountryById', () => {
    it('fetches localized country by id', async () => {
      const id = '1';
      const mockCountryRepository = mock<CountryRepository>();
      mockCountryRepository.findCountryById.mockResolvedValueOnce(
        Some({
          esdc_countryid: '1',
          esdc_nameenglish: 'Canada English',
          esdc_namefrench: 'Canada Français',
          esdc_countrycodealpha3: 'CAN',
        }),
      );

      const mockDto: CountryLocalizedDto = { id: '1', name: 'Canada English' };

      const mockCountryDtoMapper = mock<CountryDtoMapper>();
      mockCountryDtoMapper.mapCountryDtoToCountryLocalizedDto.mockReturnValueOnce(mockDto);

      const service = new DefaultCountryService(mockCountryDtoMapper, mockCountryRepository, mockServerConfig);

      const dto = await service.getLocalizedCountryById(id, 'en');

      expect(dto).toEqual(mockDto);
      expect(mockCountryRepository.findCountryById).toHaveBeenCalledOnce();
      expect(mockCountryDtoMapper.mapCountryDtoToCountryLocalizedDto).toHaveBeenCalledOnce();
    });

    it('fetches localized country by id throws not found exception', async () => {
      const id = '1033';
      const mockCountryRepository = mock<CountryRepository>();
      mockCountryRepository.findCountryById.mockResolvedValueOnce(None);

      const mockCountryDtoMapper = mock<CountryDtoMapper>();

      const service = new DefaultCountryService(mockCountryDtoMapper, mockCountryRepository, mockServerConfig);

      await expect(service.getLocalizedCountryById(id, 'en')).rejects.toThrow(CountryNotFoundException);
      expect(mockCountryRepository.findCountryById).toHaveBeenCalledOnce();
      expect(mockCountryDtoMapper.mapCountryDtoToCountryLocalizedDto).not.toHaveBeenCalled();
    });
  });
});
