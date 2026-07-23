import { describe, expect, it } from 'vitest';

import type { SunLifeCommunicationMethodDto, SunLifeCommunicationMethodLocalizedDto } from '~/.server/domain/dtos';
import { DefaultSunLifeCommunicationMethodDtoMapper } from '~/.server/domain/mappers';

describe('DefaultSunLifeCommunicationMethodDtoMapper', () => {
  describe('mapSunLifeCommunicationMethodDtoToSunLifeCommunicationMethodLocalizedDto', () => {
    it.each([
      ['en' as const, 'English'],
      ['fr' as const, 'Anglais'],
    ])('should map a single SunLifeCommunicationMethodDto objects to a SunLifeCommunicationMethodLocalizedDto object with the correct locale (%s)', (locale, expectedLocalizedName) => {
      const mockDto: SunLifeCommunicationMethodDto = { id: '1', code: 'en', nameEn: 'English', nameFr: 'Anglais' };
      const expectedDto: SunLifeCommunicationMethodLocalizedDto = { id: '1', code: 'en', name: expectedLocalizedName };

      const mapper = new DefaultSunLifeCommunicationMethodDtoMapper();
      const dto = mapper.mapSunLifeCommunicationMethodDtoToSunLifeCommunicationMethodLocalizedDto(mockDto, locale);

      expect(dto).toEqual(expectedDto);
    });
  });

  describe('mapSunLifeCommunicationMethodDtosToSunLifeCommunicationMethodLocalizedDtos', () => {
    it.each([
      ['en' as const, 'English', 'French'],
      ['fr' as const, 'Anglais', 'Français'],
    ])('should map an array of SunLifeCommunicationMethodDto objects to an array of SunLifeCommunicationMethodLocalizedDto objects with the correct locale (%s)', (locale, expectedFirstLocalizedName, expectedSecondLocalizedName) => {
      const sunLifeCommunicationMethodDtos: SunLifeCommunicationMethodDto[] = [
        { id: '1', code: 'en', nameEn: 'English', nameFr: 'Anglais' },
        { id: '2', code: 'fr', nameEn: 'French', nameFr: 'Français' },
      ];

      const expectedDtos: SunLifeCommunicationMethodLocalizedDto[] = [
        { id: '1', code: 'en', name: expectedFirstLocalizedName },
        { id: '2', code: 'fr', name: expectedSecondLocalizedName },
      ];

      const mapper = new DefaultSunLifeCommunicationMethodDtoMapper();
      const dtos = mapper.mapSunLifeCommunicationMethodDtosToSunLifeCommunicationMethodLocalizedDtos(sunLifeCommunicationMethodDtos, locale);

      expect(dtos).toEqual(expectedDtos);
    });

    it('should handle an empty array of SunLifeCommunicationMethodDto objects', () => {
      const sunLifeCommunicationMethodDtos: SunLifeCommunicationMethodDto[] = [];
      const expectedDtos: SunLifeCommunicationMethodLocalizedDto[] = [];

      const mapper = new DefaultSunLifeCommunicationMethodDtoMapper();
      const dtos = mapper.mapSunLifeCommunicationMethodDtosToSunLifeCommunicationMethodLocalizedDtos(sunLifeCommunicationMethodDtos, 'en');

      expect(dtos).toEqual(expectedDtos);
    });
  });
});
