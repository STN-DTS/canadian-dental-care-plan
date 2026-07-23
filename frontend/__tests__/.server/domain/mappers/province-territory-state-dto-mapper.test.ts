import { describe, expect, it } from 'vitest';

import type { ProvinceTerritoryStateDto, ProvinceTerritoryStateLocalizedDto } from '~/.server/domain/dtos';
import type { ProvinceTerritoryStateEntity } from '~/.server/domain/entities';
import { DefaultProvinceTerritoryStateDtoMapper } from '~/.server/domain/mappers';

describe('DefaultProvinceTerritoryStateDtoMapper', () => {
  describe('mapProvinceTerritoryStateDtoToProvinceTerritoryStateLocalizedDto', () => {
    it.each([
      ['en' as const, 'English'],
      ['fr' as const, 'Français'],
    ])('should map a single ProvinceTerritoryStateDto objects to a ProvinceTerritoryStateLocalizedDto object with the correct locale (%s)', (locale, expectedLocalizedName) => {
      const mockDto: ProvinceTerritoryStateDto = { id: '1', countryId: '1', nameEn: 'English', nameFr: 'Français', abbr: 'EN' };
      const expectedDto: ProvinceTerritoryStateLocalizedDto = { id: '1', countryId: '1', name: expectedLocalizedName, abbr: 'EN' };

      const mapper = new DefaultProvinceTerritoryStateDtoMapper();
      const dto = mapper.mapProvinceTerritoryStateDtoToProvinceTerritoryStateLocalizedDto(mockDto, locale);

      expect(dto).toEqual(expectedDto);
    });
  });

  describe('mapProvinceTerritoryStateDtosToProvinceTerritoryStateLocalizedDtos', () => {
    it.each([
      ['en' as const, 'English', 'French'],
      ['fr' as const, 'Anglais', 'Français'],
    ])('should map an array of ProvinceTerritoryStateDto objects to an array of ProvinceTerritoryStateLocalizedDto objects with the correct locale (%s)', (locale, expectedFirstLocalizedName, expectedSecondLocalizedName) => {
      const provinceTerritoryStateDtos: ProvinceTerritoryStateDto[] = [
        { id: '1', countryId: '1', nameEn: 'English', nameFr: 'Anglais', abbr: 'EN' },
        { id: '2', countryId: '2', nameEn: 'French', nameFr: 'Français', abbr: 'FR' },
      ];

      const expectedDtos: ProvinceTerritoryStateLocalizedDto[] = [
        { id: '1', countryId: '1', name: expectedFirstLocalizedName, abbr: 'EN' },
        { id: '2', countryId: '2', name: expectedSecondLocalizedName, abbr: 'FR' },
      ];

      const mapper = new DefaultProvinceTerritoryStateDtoMapper();
      const dtos = mapper.mapProvinceTerritoryStateDtosToProvinceTerritoryStateLocalizedDtos(provinceTerritoryStateDtos, locale);

      expect(dtos).toEqual(expectedDtos);
    });

    it('should handle an empty array of ProvinceTerritoryStateDto objects', () => {
      const provinceTerritoryStateDtos: ProvinceTerritoryStateDto[] = [];
      const expectedDtos: ProvinceTerritoryStateLocalizedDto[] = [];

      const mapper = new DefaultProvinceTerritoryStateDtoMapper();
      const dtos = mapper.mapProvinceTerritoryStateDtosToProvinceTerritoryStateLocalizedDtos(provinceTerritoryStateDtos, 'en');

      expect(dtos).toEqual(expectedDtos);
    });
  });

  describe('mapProvinceTerritoryStateEntityToProvinceTerritoryStateDto', () => {
    it('maps a ProvinceTerritoryStateEntity with both English and French labels to a ProvinceTerritoryStateDto', () => {
      const mockEntity: ProvinceTerritoryStateEntity = {
        esdc_provinceterritorystateid: '1',
        _esdc_countryid_value: '10',
        esdc_nameenglish: 'Alabama EN',
        esdc_namefrench: 'Alabama FR',
        esdc_internationalalphacode: 'AL',
      };

      const expectedDto: ProvinceTerritoryStateDto = { id: '1', countryId: '10', nameEn: 'Alabama EN', nameFr: 'Alabama FR', abbr: 'AL' };

      const mapper = new DefaultProvinceTerritoryStateDtoMapper();

      const dto = mapper.mapProvinceTerritoryStateEntityToProvinceTerritoryStateDto(mockEntity);

      expect(dto).toEqual(expectedDto);
    });
  });

  describe('mapProvinceTerritoryStateEntitiesToProvinceTerritoryStateDtos', () => {
    it('maps an array of ProvinceTerritoryStateEntities to an array of ProvinceTerritoryStateDtos', () => {
      const mockEntities: ProvinceTerritoryStateEntity[] = [
        {
          esdc_provinceterritorystateid: '1',
          _esdc_countryid_value: '10',
          esdc_nameenglish: 'Alabama EN',
          esdc_namefrench: 'Alabama FR',
          esdc_internationalalphacode: 'AL',
        },
        {
          esdc_provinceterritorystateid: '2',
          _esdc_countryid_value: '10',
          esdc_nameenglish: 'Alaska EN',
          esdc_namefrench: 'Alaska FR',
          esdc_internationalalphacode: 'AK',
        },
      ];

      const expectedDtos: ProvinceTerritoryStateDto[] = [
        { id: '1', countryId: '10', nameEn: 'Alabama EN', nameFr: 'Alabama FR', abbr: 'AL' },
        { id: '2', countryId: '10', nameEn: 'Alaska EN', nameFr: 'Alaska FR', abbr: 'AK' },
      ];

      const mapper = new DefaultProvinceTerritoryStateDtoMapper();

      const dtos = mapper.mapProvinceTerritoryStateEntitiesToProvinceTerritoryStateDtos(mockEntities);

      expect(dtos).toEqual(expectedDtos);
    });
  });
});
