import { injectable } from 'inversify';

import type { CountryDto, CountryLocalizedDto } from '~/.server/domain/dtos';
import type { CountryEntity } from '~/.server/domain/entities';

/**
 * Interface defining methods for mapping between CountryDto, CountryLocalizedDto, and CountryEntity objects.
 */
export interface CountryDtoMapper {
  /**
   * Maps an array of CountryDto objects to an array of CountryLocalizedDto objects, applying localization based on the provided locale.
   *
   * @param countryDtos The array of CountryDto objects to be mapped.
   * @param locale The desired locale for localization (e.g., 'en' or 'fr').
   * @returns An array of CountryLocalizedDto objects, each representing a localized version of the corresponding CountryDto.
   */
  mapCountryDtosToCountryLocalizedDtos(countryDtos: ReadonlyArray<CountryDto>, locale: AppLocale): ReadonlyArray<CountryLocalizedDto>;

  /**
   * Maps a single CountryDto object to a CountryLocalizedDto object, applying localization based on the provided locale.
   *
   * @param countryDto The CountryDto object to be mapped.
   * @param locale The desired locale for localization (e.g., 'en' or 'fr').
   * @returns A CountryLocalizedDto object, representing a localized version of the input CountryDto.
   */
  mapCountryDtoToCountryLocalizedDto(countryDto: CountryDto, locale: AppLocale): CountryLocalizedDto;

  /**
   * Maps an array of CountryEntity objects (presumably from a database or other data source) to an array of CountryDto objects.
   *
   * @param countryEntities The array of CountryEntity objects to be mapped.
   * @returns An array of CountryDto objects, representing the mapped country data.
   */
  mapCountryEntitiesToCountryDtos(countryEntities: ReadonlyArray<CountryEntity>): ReadonlyArray<CountryDto>;

  /**
   * Maps a single CountryEntity object to a CountryDto object.
   *
   * @param countryEntity The CountryEntity object to be mapped.
   * @returns A CountryDto object, representing the mapped country data.
   */
  mapCountryEntityToCountryDto(countryEntity: CountryEntity): CountryDto;
}

@injectable()
export class DefaultCountryDtoMapper implements CountryDtoMapper {
  mapCountryDtoToCountryLocalizedDto(countryDto: CountryDto, locale: AppLocale): CountryLocalizedDto {
    const { nameEn, nameFr, ...rest } = countryDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapCountryDtosToCountryLocalizedDtos(countryDtos: ReadonlyArray<CountryDto>, locale: AppLocale): ReadonlyArray<CountryLocalizedDto> {
    return countryDtos.map((dto) => this.mapCountryDtoToCountryLocalizedDto(dto, locale));
  }

  mapCountryEntityToCountryDto(countryEntity: CountryEntity): CountryDto {
    const id = countryEntity.esdc_countryid.toString();
    const nameEn = countryEntity.esdc_nameenglish;
    const nameFr = countryEntity.esdc_namefrench;
    return { id, nameEn, nameFr };
  }

  mapCountryEntitiesToCountryDtos(countryEntities: ReadonlyArray<CountryEntity>): ReadonlyArray<CountryDto> {
    return countryEntities.map((entity) => this.mapCountryEntityToCountryDto(entity));
  }
}
