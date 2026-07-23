import { injectable } from 'inversify';

import type { SunLifeCommunicationMethodDto, SunLifeCommunicationMethodLocalizedDto } from '~/.server/domain/dtos';

/**
 * Interface defining methods for mapping between SunLifeCommunicationMethodDto, SunLifeCommunicationMethodLocalizedDto, and LanguageEntity objects.
 */
export interface SunLifeCommunicationMethodDtoMapper {
  /**
   * Maps an array of SunLifeCommunicationMethodDto objects to an array of SunLifeCommunicationMethodLocalizedDto objects, applying localization based on the provided locale.
   *
   * @param sunLifeCommunicationMethodDtos The array of SunLifeCommunicationMethodDto objects to be mapped.
   * @param locale The desired locale for localization (e.g., 'en' or 'fr').
   * @returns An array of SunLifeCommunicationMethodLocalizedDto objects, each representing a localized version of the corresponding SunLifeCommunicationMethodDto.
   */
  mapSunLifeCommunicationMethodDtosToSunLifeCommunicationMethodLocalizedDtos(sunLifeCommunicationMethodDtos: ReadonlyArray<SunLifeCommunicationMethodDto>, locale: AppLocale): ReadonlyArray<SunLifeCommunicationMethodLocalizedDto>;

  /**
   * Maps a single SunLifeCommunicationMethodDto object to a SunLifeCommunicationMethodLocalizedDto object, applying localization based on the provided locale.
   *
   * @param sunLifeCommunicationMethodDto The SunLifeCommunicationMethodDto object to be mapped.
   * @param locale The desired locale for localization (e.g., 'en' or 'fr').
   * @returns A SunLifeCommunicationMethodLocalizedDto object, representing a localized version of the input SunLifeCommunicationMethodDto.
   */
  mapSunLifeCommunicationMethodDtoToSunLifeCommunicationMethodLocalizedDto(sunLifeCommunicationMethodDto: SunLifeCommunicationMethodDto, locale: AppLocale): SunLifeCommunicationMethodLocalizedDto;
}

@injectable()
export class DefaultSunLifeCommunicationMethodDtoMapper implements SunLifeCommunicationMethodDtoMapper {
  mapSunLifeCommunicationMethodDtoToSunLifeCommunicationMethodLocalizedDto(sunLifeCommunicationMethodDto: SunLifeCommunicationMethodDto, locale: AppLocale): SunLifeCommunicationMethodLocalizedDto {
    const { nameEn, nameFr, ...rest } = sunLifeCommunicationMethodDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapSunLifeCommunicationMethodDtosToSunLifeCommunicationMethodLocalizedDtos(sunLifeCommunicationMethodDtos: ReadonlyArray<SunLifeCommunicationMethodDto>, locale: AppLocale): ReadonlyArray<SunLifeCommunicationMethodLocalizedDto> {
    return sunLifeCommunicationMethodDtos.map((dto) => this.mapSunLifeCommunicationMethodDtoToSunLifeCommunicationMethodLocalizedDto(dto, locale));
  }
}
