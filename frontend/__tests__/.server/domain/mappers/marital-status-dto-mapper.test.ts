import { describe, expect, it } from 'vitest';

import type { MaritalStatusDto, MaritalStatusLocalizedDto } from '~/.server/domain/dtos';
import { DefaultMaritalStatusDtoMapper } from '~/.server/domain/mappers';

describe('DefaultMaritalStatusDtoMapper', () => {
  describe('mapMaritalStatusDtoToMaritalStatusLocalizedDto', () => {
    it.each([
      ['en' as const, 'English'],
      ['fr' as const, 'Anglais'],
    ])('should map a single MaritalStatusDto objects to a MaritalStatusLocalizedDto object with the correct locale (%s)', (locale, expectedLocalizedName) => {
      const mockDto: MaritalStatusDto = { id: '1', nameEn: 'English', nameFr: 'Anglais' };
      const expectedDto: MaritalStatusLocalizedDto = { id: '1', name: expectedLocalizedName };

      const mapper = new DefaultMaritalStatusDtoMapper();
      const dto = mapper.mapMaritalStatusDtoToMaritalStatusLocalizedDto(mockDto, locale);

      expect(dto).toEqual(expectedDto);
    });
  });

  describe('mapMaritalStatusDtosToMaritalStatusLocalizedDtos', () => {
    it.each([
      ['en' as const, 'English', 'French'],
      ['fr' as const, 'Anglais', 'Français'],
    ])('should map an array of MaritalStatusDto objects to an array of MaritalStatusLocalizedDto objects with the correct locale (%s)', (locale, expectedFirstLocalizedName, expectedSecondLocalizedName) => {
      const maritalStatusDtos: MaritalStatusDto[] = [
        { id: '1', nameEn: 'English', nameFr: 'Anglais' },
        { id: '2', nameEn: 'French', nameFr: 'Français' },
      ];

      const expectedDtos: MaritalStatusLocalizedDto[] = [
        { id: '1', name: expectedFirstLocalizedName },
        { id: '2', name: expectedSecondLocalizedName },
      ];

      const mapper = new DefaultMaritalStatusDtoMapper();
      const dtos = mapper.mapMaritalStatusDtosToMaritalStatusLocalizedDtos(maritalStatusDtos, locale);

      expect(dtos).toEqual(expectedDtos);
    });

    it('should handle an empty array of MaritalStatusDto objects', () => {
      const maritalStatusDtos: MaritalStatusDto[] = [];
      const expectedDtos: MaritalStatusLocalizedDto[] = [];

      const mapper = new DefaultMaritalStatusDtoMapper();
      const dtos = mapper.mapMaritalStatusDtosToMaritalStatusLocalizedDtos(maritalStatusDtos, 'en');

      expect(dtos).toEqual(expectedDtos);
    });
  });
});
