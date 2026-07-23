import { describe, expect, it } from 'vitest';

import type { GCCommunicationMethodDto, GCCommunicationMethodLocalizedDto } from '~/.server/domain/dtos';
import { DefaultGCCommunicationMethodDtoMapper } from '~/.server/domain/mappers';

describe('DefaultGCCommunicationMethodDtoMapper', () => {
  describe('mapGCCommunicationMethodDtoToGCCommunicationMethodLocalizedDto', () => {
    it.each([
      ['en' as const, 'English'],
      ['fr' as const, 'Anglais'],
    ])('should map a single GCCommunicationMethodDto objects to a GCCommunicationMethodLocalizedDto object with the correct locale (%s)', (locale, expectedLocalizedName) => {
      const mockDto: GCCommunicationMethodDto = { id: '1', code: 'en', nameEn: 'English', nameFr: 'Anglais' };
      const expectedDto: GCCommunicationMethodLocalizedDto = { id: '1', code: 'en', name: expectedLocalizedName };

      const mapper = new DefaultGCCommunicationMethodDtoMapper();
      const dto = mapper.mapGCCommunicationMethodDtoToGCCommunicationMethodLocalizedDto(mockDto, locale);

      expect(dto).toEqual(expectedDto);
    });
  });

  describe('mapGCCommunicationMethodDtosToGCCommunicationMethodLocalizedDtos', () => {
    it.each([
      ['en' as const, 'English', 'French'],
      ['fr' as const, 'Anglais', 'Français'],
    ])('should map an array of GCCommunicationMethodDto objects to an array of GCCommunicationMethodLocalizedDto objects with the correct locale (%s)', (locale, expectedFirstLocalizedName, expectedSecondLocalizedName) => {
      const gcCommunicationMethodDtos: GCCommunicationMethodDto[] = [
        { id: '1', code: 'en', nameEn: 'English', nameFr: 'Anglais' },
        { id: '2', code: 'fr', nameEn: 'French', nameFr: 'Français' },
      ];

      const expectedDtos: GCCommunicationMethodLocalizedDto[] = [
        { id: '1', code: 'en', name: expectedFirstLocalizedName },
        { id: '2', code: 'fr', name: expectedSecondLocalizedName },
      ];

      const mapper = new DefaultGCCommunicationMethodDtoMapper();
      const dtos = mapper.mapGCCommunicationMethodDtosToGCCommunicationMethodLocalizedDtos(gcCommunicationMethodDtos, locale);

      expect(dtos).toEqual(expectedDtos);
    });

    it('should handle an empty array of GCCommunicationMethodDto objects', () => {
      const gcCommunicationMethodDtos: GCCommunicationMethodDto[] = [];
      const expectedDtos: GCCommunicationMethodLocalizedDto[] = [];

      const mapper = new DefaultGCCommunicationMethodDtoMapper();
      const dtos = mapper.mapGCCommunicationMethodDtosToGCCommunicationMethodLocalizedDtos(gcCommunicationMethodDtos, 'en');

      expect(dtos).toEqual(expectedDtos);
    });
  });
});
