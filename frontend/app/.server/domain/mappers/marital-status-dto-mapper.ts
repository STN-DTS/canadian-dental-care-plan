import { injectable } from 'inversify';

import type { MaritalStatusDto, MaritalStatusLocalizedDto } from '~/.server/domain/dtos';

/**
 * Interface defining methods for mapping between MaritalStatusDto, MaritalStatusLocalizedDto, and LanguageEntity objects.
 */
export interface MaritalStatusDtoMapper {
  /**
   * Maps an array of MaritalStatusDto objects to an array of MaritalStatusLocalizedDto objects, applying localization based on the provided locale.
   *
   * @param maritalStatusDtos The array of MaritalStatusDto objects to be mapped.
   * @param locale The desired locale for localization (e.g., 'en' or 'fr').
   * @returns An array of MaritalStatusLocalizedDto objects, each representing a localized version of the corresponding MaritalStatusDto.
   */
  mapMaritalStatusDtosToMaritalStatusLocalizedDtos(maritalStatusDtos: ReadonlyArray<MaritalStatusDto>, locale: AppLocale): ReadonlyArray<MaritalStatusLocalizedDto>;

  /**
   * Maps a single MaritalStatusDto object to a MaritalStatusLocalizedDto object, applying localization based on the provided locale.
   *
   * @param maritalStatusDto The MaritalStatusDto object to be mapped.
   * @param locale The desired locale for localization (e.g., 'en' or 'fr').
   * @returns A MaritalStatusLocalizedDto object, representing a localized version of the input MaritalStatusDto.
   */
  mapMaritalStatusDtoToMaritalStatusLocalizedDto(maritalStatusDto: MaritalStatusDto, locale: AppLocale): MaritalStatusLocalizedDto;
}

@injectable()
export class DefaultMaritalStatusDtoMapper implements MaritalStatusDtoMapper {
  mapMaritalStatusDtoToMaritalStatusLocalizedDto(maritalStatusDto: MaritalStatusDto, locale: AppLocale): MaritalStatusLocalizedDto {
    const { nameEn, nameFr, ...rest } = maritalStatusDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapMaritalStatusDtosToMaritalStatusLocalizedDtos(maritalStatusDtos: ReadonlyArray<MaritalStatusDto>, locale: AppLocale): ReadonlyArray<MaritalStatusLocalizedDto> {
    return maritalStatusDtos.map((dto) => this.mapMaritalStatusDtoToMaritalStatusLocalizedDto(dto, locale));
  }
}
