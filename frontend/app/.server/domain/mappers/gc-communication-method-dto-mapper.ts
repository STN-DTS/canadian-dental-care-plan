import { injectable } from 'inversify';

import type { GCCommunicationMethodDto, GCCommunicationMethodLocalizedDto } from '~/.server/domain/dtos';

/**
 * Interface defining methods for mapping between GCCommunicationMethodDto, GCCommunicationMethodLocalizedDto, and LanguageEntity objects.
 */
export interface GCCommunicationMethodDtoMapper {
  /**
   * Maps an array of GCCommunicationMethodDto objects to an array of GCCommunicationMethodLocalizedDto objects, applying localization based on the provided locale.
   *
   * @param gcCommunicationMethodDtos The array of GCCommunicationMethodDto objects to be mapped.
   * @param locale The desired locale for localization (e.g., 'en' or 'fr').
   * @returns An array of GCCommunicationMethodLocalizedDto objects, each representing a localized version of the corresponding GCCommunicationMethodDto.
   */
  mapGCCommunicationMethodDtosToGCCommunicationMethodLocalizedDtos(gcCommunicationMethodDtos: ReadonlyArray<GCCommunicationMethodDto>, locale: AppLocale): ReadonlyArray<GCCommunicationMethodLocalizedDto>;

  /**
   * Maps a single GCCommunicationMethodDto object to a GCCommunicationMethodLocalizedDto object, applying localization based on the provided locale.
   *
   * @param gcCommunicationMethodDto The GCCommunicationMethodDto object to be mapped.
   * @param locale The desired locale for localization (e.g., 'en' or 'fr').
   * @returns A GCCommunicationMethodLocalizedDto object, representing a localized version of the input GCCommunicationMethodDto.
   */
  mapGCCommunicationMethodDtoToGCCommunicationMethodLocalizedDto(gcCommunicationMethodDto: GCCommunicationMethodDto, locale: AppLocale): GCCommunicationMethodLocalizedDto;
}

@injectable()
export class DefaultGCCommunicationMethodDtoMapper implements GCCommunicationMethodDtoMapper {
  mapGCCommunicationMethodDtoToGCCommunicationMethodLocalizedDto(gcCommunicationMethodDto: GCCommunicationMethodDto, locale: AppLocale): GCCommunicationMethodLocalizedDto {
    const { nameEn, nameFr, ...rest } = gcCommunicationMethodDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapGCCommunicationMethodDtosToGCCommunicationMethodLocalizedDtos(gcCommunicationMethodDtos: ReadonlyArray<GCCommunicationMethodDto>, locale: AppLocale): ReadonlyArray<GCCommunicationMethodLocalizedDto> {
    return gcCommunicationMethodDtos.map((dto) => this.mapGCCommunicationMethodDtoToGCCommunicationMethodLocalizedDto(dto, locale));
  }
}
