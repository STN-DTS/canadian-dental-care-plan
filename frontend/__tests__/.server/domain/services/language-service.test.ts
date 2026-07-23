import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { LanguageDto, LanguageLocalizedDto } from '~/.server/domain/dtos';
import { LanguageNotFoundException } from '~/.server/domain/exceptions';
import type { LanguageDtoMapper } from '~/.server/domain/mappers';
import { DefaultLanguageService } from '~/.server/domain/services';
import type { DefaultLanguageService_ServiceConfig } from '~/.server/domain/services/language-service';

describe('DefaultLanguageService', () => {
  const mockServerConfig: DefaultLanguageService_ServiceConfig = {
    ENGLISH_LANGUAGE_CODE: 1,
    FRENCH_LANGUAGE_CODE: 2,
  };

  describe('listLanguages', () => {
    it('fetches all languages', () => {
      const mockDtos: LanguageDto[] = [
        { id: mockServerConfig.ENGLISH_LANGUAGE_CODE.toString(), code: 'en', nameEn: 'English', nameFr: 'Anglais' },
        { id: mockServerConfig.FRENCH_LANGUAGE_CODE.toString(), code: 'fr', nameEn: 'French', nameFr: 'Français' },
      ];

      const mockLanguageDtoMapper = mock<LanguageDtoMapper>();
      const service = new DefaultLanguageService(mockLanguageDtoMapper, mockServerConfig);

      const dtos = service.listLanguages();

      expect(dtos).toEqual(mockDtos);
    });
  });

  describe('getLanguage', () => {
    it('fetches language by id', () => {
      const id = '1';
      const mockDto: LanguageDto = { id: mockServerConfig.ENGLISH_LANGUAGE_CODE.toString(), code: 'en', nameEn: 'English', nameFr: 'Anglais' };
      const mockLanguageDtoMapper = mock<LanguageDtoMapper>();
      const service = new DefaultLanguageService(mockLanguageDtoMapper, mockServerConfig);

      const dto = service.getLanguageById(id);

      expect(dto).toEqual(mockDto);
    });

    it('fetches language by id throws not found exception', () => {
      const id = '999';

      const mockLanguageDtoMapper = mock<LanguageDtoMapper>();

      const service = new DefaultLanguageService(mockLanguageDtoMapper, mockServerConfig);

      expect(() => service.getLanguageById(id)).toThrow(LanguageNotFoundException);
    });
  });

  describe('listAndSortLocalizedLanguages', () => {
    it('fetches and sorts localized languages with French first when locale is "fr"', () => {
      const mockMappedLanguageLocalizedDtos: LanguageLocalizedDto[] = [
        { id: '2', code: 'fr', name: 'French' },
        { id: '1', code: 'en', name: 'English' },
      ];

      const expectedLanguageLocalizedDtos: LanguageLocalizedDto[] = [
        { id: '2', code: 'fr', name: 'French' },
        { id: '1', code: 'en', name: 'English' },
      ];

      const mockLanguageDtoMapper = mock<LanguageDtoMapper>();
      mockLanguageDtoMapper.mapLanguageDtosToLanguageLocalizedDtos.mockReturnValueOnce(mockMappedLanguageLocalizedDtos);

      const service = new DefaultLanguageService(mockLanguageDtoMapper, mockServerConfig);

      const dtos = service.listAndSortLocalizedLanguages('fr');

      expect(dtos).toStrictEqual(expectedLanguageLocalizedDtos);
      expect(mockLanguageDtoMapper.mapLanguageDtosToLanguageLocalizedDtos).toHaveBeenCalledOnce();
    });
  });

  describe('getLocalizedLanguageById', () => {
    it('fetches localized language by id', () => {
      const id = '1';
      const mockDto: LanguageLocalizedDto = { id: '1', code: 'en', name: 'English' };
      const mockLanguageDtoMapper = mock<LanguageDtoMapper>();
      mockLanguageDtoMapper.mapLanguageDtoToLanguageLocalizedDto.mockReturnValueOnce(mockDto);
      const service = new DefaultLanguageService(mockLanguageDtoMapper, mockServerConfig);

      const dto = service.getLocalizedLanguageById(id, 'en');

      expect(dto).toEqual(mockDto);
      expect(mockLanguageDtoMapper.mapLanguageDtoToLanguageLocalizedDto).toHaveBeenCalledOnce();
    });

    it('fetches localized language by id throws not found exception', () => {
      const id = '1033';
      const mockLanguageDtoMapper = mock<LanguageDtoMapper>();
      const service = new DefaultLanguageService(mockLanguageDtoMapper, mockServerConfig);

      expect(() => service.getLocalizedLanguageById(id, 'en')).toThrow(LanguageNotFoundException);
      expect(mockLanguageDtoMapper.mapLanguageDtoToLanguageLocalizedDto).not.toHaveBeenCalled();
    });
  });
});
