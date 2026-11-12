import { injectable } from 'inversify';

import type { LanguageDto, LanguageLocalizedDto } from '~/.server/domain/dtos';

/**
 * Interface defining methods for mapping between LanguageDto, LanguageLocalizedDto, and LanguageEntity objects.
 */
export interface LanguageDtoMapper {
  /**
   * Maps an array of LanguageDto objects to an array of LanguageLocalizedDto objects, applying localization based on the provided locale.
   *
   * @param languageDtos The array of LanguageDto objects to be mapped.
   * @param locale The desired locale for localization (e.g., 'en' or 'fr').
   * @returns An array of LanguageLocalizedDto objects, each representing a localized version of the corresponding LanguageDto.
   */
  mapLanguageDtosToLanguageLocalizedDtos(languageDtos: ReadonlyArray<LanguageDto>, locale: AppLocale): ReadonlyArray<LanguageLocalizedDto>;

  /**
   * Maps a single LanguageDto object to a LanguageLocalizedDto object, applying localization based on the provided locale.
   *
   * @param languageDto The LanguageDto object to be mapped.
   * @param locale The desired locale for localization (e.g., 'en' or 'fr').
   * @returns A LanguageLocalizedDto object, representing a localized version of the input LanguageDto.
   */
  mapLanguageDtoToLanguageLocalizedDto(languageDto: LanguageDto, locale: AppLocale): LanguageLocalizedDto;
}

@injectable()
export class DefaultLanguageDtoMapper implements LanguageDtoMapper {
  mapLanguageDtoToLanguageLocalizedDto(languageDto: LanguageDto, locale: AppLocale): LanguageLocalizedDto {
    const { nameEn, nameFr, ...rest } = languageDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapLanguageDtosToLanguageLocalizedDtos(languageDtos: ReadonlyArray<LanguageDto>, locale: AppLocale): ReadonlyArray<LanguageLocalizedDto> {
    return languageDtos.map((dto) => this.mapLanguageDtoToLanguageLocalizedDto(dto, locale));
  }
}
