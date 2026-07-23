import { describe, expect, it } from 'vitest';

import type { LanguageDto, LanguageLocalizedDto } from '~/.server/domain/dtos';
import { DefaultLanguageDtoMapper } from '~/.server/domain/mappers';

describe('DefaultLanguageDtoMapper', () => {
  describe('mapLanguageDtoToLanguageLocalizedDto', () => {
    it.each([
      ['en' as const, 'English'],
      ['fr' as const, 'Anglais'],
    ])('should map a single LanguageDto objects to a LanguageLocalizedDto object with the correct locale (%s)', (locale, expectedLocalizedName) => {
      const mockDto: LanguageDto = { id: '1', code: 'en', nameEn: 'English', nameFr: 'Anglais' };
      const expectedDto: LanguageLocalizedDto = { id: '1', code: 'en', name: expectedLocalizedName };

      const mapper = new DefaultLanguageDtoMapper();
      const dto = mapper.mapLanguageDtoToLanguageLocalizedDto(mockDto, locale);

      expect(dto).toEqual(expectedDto);
    });
  });

  describe('mapLanguageDtosToLanguageLocalizedDtos', () => {
    it.each([
      ['en' as const, 'English', 'French'],
      ['fr' as const, 'Anglais', 'Français'],
    ])('should map an array of LanguageDto objects to an array of LanguageLocalizedDto objects with the correct locale (%s)', (locale, expectedFirstLocalizedName, expectedSecondLocalizedName) => {
      const languageDtos: LanguageDto[] = [
        { id: '1', code: 'en', nameEn: 'English', nameFr: 'Anglais' },
        { id: '2', code: 'fr', nameEn: 'French', nameFr: 'Français' },
      ];

      const expectedDtos: LanguageLocalizedDto[] = [
        { id: '1', code: 'en', name: expectedFirstLocalizedName },
        { id: '2', code: 'fr', name: expectedSecondLocalizedName },
      ];

      const mapper = new DefaultLanguageDtoMapper();
      const dtos = mapper.mapLanguageDtosToLanguageLocalizedDtos(languageDtos, locale);

      expect(dtos).toEqual(expectedDtos);
    });

    it('should handle an empty array of LanguageDto objects', () => {
      const languageDtos: LanguageDto[] = [];
      const expectedDtos: LanguageLocalizedDto[] = [];

      const mapper = new DefaultLanguageDtoMapper();
      const dtos = mapper.mapLanguageDtosToLanguageLocalizedDtos(languageDtos, 'en');

      expect(dtos).toEqual(expectedDtos);
    });
  });
});
