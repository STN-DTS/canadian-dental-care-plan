import { describe, expect, it } from 'vitest';

import type { CountryDto, CountryLocalizedDto } from '~/.server/domain/dtos';
import type { CountryEntity } from '~/.server/domain/entities';
import { DefaultCountryDtoMapper } from '~/.server/domain/mappers';

describe('DefaultCountryDtoMapper', () => {
  describe('mapCountryDtoToCountryLocalizedDto', () => {
    it.each([
      ['en' as const, 'Canada (English)'],
      ['fr' as const, 'Canada (French)'],
    ])('should map a single CountryDto objects to a CountryLocalizedDto object with the correct locale (%s)', (locale, expectedLocalizedName) => {
      const mockDto: CountryDto = { id: '1', nameEn: 'Canada (English)', nameFr: 'Canada (French)' };
      const expectedDto: CountryLocalizedDto = { id: '1', name: expectedLocalizedName };

      const mapper = new DefaultCountryDtoMapper();
      const dto = mapper.mapCountryDtoToCountryLocalizedDto(mockDto, locale);

      expect(dto).toEqual(expectedDto);
    });
  });

  describe('mapCountryDtosToCountryLocalizedDtos', () => {
    it.each([
      ['en' as const, 'Canada (English)', 'United States (English)'],
      ['fr' as const, 'Canada (French)', 'États-Unis (Français)'],
    ])('should map an array of CountryDto objects to an array of CountryLocalizedDto objects with the correct locale (%s)', (locale, expectedFirstLocalizedName, expectedSecondLocalizedName) => {
      const countryDtos: CountryDto[] = [
        { id: '1', nameEn: 'Canada (English)', nameFr: 'Canada (French)' },
        { id: '2', nameEn: 'United States (English)', nameFr: 'États-Unis (Français)' },
      ];

      const expectedDtos: CountryLocalizedDto[] = [
        { id: '1', name: expectedFirstLocalizedName },
        { id: '2', name: expectedSecondLocalizedName },
      ];

      const mapper = new DefaultCountryDtoMapper();
      const dtos = mapper.mapCountryDtosToCountryLocalizedDtos(countryDtos, locale);

      expect(dtos).toEqual(expectedDtos);
    });

    it('should handle an empty array of CountryDto objects', () => {
      const countryDtos: CountryDto[] = [];
      const expectedDtos: CountryLocalizedDto[] = [];

      const mapper = new DefaultCountryDtoMapper();
      const dtos = mapper.mapCountryDtosToCountryLocalizedDtos(countryDtos, 'en');

      expect(dtos).toEqual(expectedDtos);
    });
  });

  describe('mapCountryEntityToCountryDto', () => {
    it('maps a CountryEntity object to a CountryDto object', () => {
      const mockEntity: CountryEntity = {
        esdc_countryid: '1',
        esdc_nameenglish: 'Canada English',
        esdc_namefrench: 'Canada Français',
        esdc_countrycodealpha3: 'CAN',
      };

      const expectedDto: CountryDto = { id: '1', nameEn: 'Canada English', nameFr: 'Canada Français' };

      const mapper = new DefaultCountryDtoMapper();
      const dto = mapper.mapCountryEntityToCountryDto(mockEntity);

      expect(dto).toEqual(expectedDto);
    });
  });

  describe('mapCountryEntitiesToCountryDtos', () => {
    it('maps an array of CountryEntity objects to an array of CountryDto objects', () => {
      const mockEntities: CountryEntity[] = [
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
      ];

      const expectedDtos: CountryDto[] = [
        { id: '1', nameEn: 'Canada English', nameFr: 'Canada Français' },
        { id: '2', nameEn: 'United States English', nameFr: 'États-Unis Français' },
      ];

      const mapper = new DefaultCountryDtoMapper();
      const dtos = mapper.mapCountryEntitiesToCountryDtos(mockEntities);

      expect(dtos).toEqual(expectedDtos);
    });

    it('should handle an empty array of CountryEntity objects', () => {
      const mockEntities: CountryEntity[] = [];
      const expectedDtos: CountryDto[] = [];

      const mapper = new DefaultCountryDtoMapper();
      const dtos = mapper.mapCountryEntitiesToCountryDtos(mockEntities);

      expect(dtos).toEqual(expectedDtos);
    });
  });
});
