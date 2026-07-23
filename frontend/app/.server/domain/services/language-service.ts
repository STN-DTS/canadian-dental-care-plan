import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { LanguageDto, LanguageLocalizedDto } from '~/.server/domain/dtos';
import { LanguageNotFoundException } from '~/.server/domain/exceptions';
import type { LanguageDtoMapper } from '~/.server/domain/mappers';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { moveToTop } from '~/.server/utils/collection-utils';

/**
 * Service interface for managing language data.
 */
export interface LanguageService {
  /**
   * Retrieves a list of all languages.
   *
   * @returns An array of Language DTOs.
   */
  listLanguages(): ReadonlyArray<LanguageDto>;

  /**
   * Retrieves a specific language by its ID.
   *
   * @param id - The ID of the language to retrieve.
   * @returns The Language DTO corresponding to the specified ID.
   * @throws {LanguageNotFoundException} If no language is found with the specified ID.
   */
  getLanguageById(id: string): LanguageDto;

  /**
   * Retrieves a list of all languages in the specified locale.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of Language DTOs in the specified locale.
   */
  listAndSortLocalizedLanguages(locale: AppLocale): ReadonlyArray<LanguageLocalizedDto>;

  /**
   * Retrieves a specific language by its ID in the specified locale.
   *
   * @param id - The ID of the language to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The Language DTO corresponding to the specified ID in the given locale.
   * @throws {LanguageNotFoundException} If no language is found with the specified ID.
   */
  getLocalizedLanguageById(id: string, locale: AppLocale): LanguageLocalizedDto;
}

export type DefaultLanguageService_ServiceConfig = Pick<ServerConfig, 'ENGLISH_LANGUAGE_CODE' | 'FRENCH_LANGUAGE_CODE'>;

/**
 * Implementation of the LanguageService interface.
 * This service provides methods to manage and retrieve language data,
 * including localized versions of the data.
 *
 * The service uses caching to optimize performance and reduce redundant
 * database lookups. It integrates with a logging system to trace operations.
 */
@injectable()
export class DefaultLanguageService implements LanguageService {
  private readonly log: Logger;
  private readonly languageDtoMapper: LanguageDtoMapper;
  private readonly languageDtos: ReadonlyArray<LanguageDto>;

  /**
   * Constructs a new DefaultLanguageService instance.
   *
   * @param logFactory - A factory for creating logger instances.
   * @param languageDtoMapper - The mapper responsible for transforming language entities into DTOs.
   * @param languageRepository - The repository for accessing language data.
   * @param serverConfig - The server configuration containing necessary constants and cache TTL values.
   */
  constructor(
    @inject(TYPES.LanguageDtoMapper) languageDtoMapper: LanguageDtoMapper, //
    @inject(TYPES.ServerConfig) serverConfig: DefaultLanguageService_ServiceConfig,
  ) {
    this.log = createLogger('DefaultLanguageService');
    this.languageDtoMapper = languageDtoMapper;

    this.languageDtos = [
      { id: serverConfig.ENGLISH_LANGUAGE_CODE.toString(), code: 'en', nameEn: 'English', nameFr: 'Anglais' },
      { id: serverConfig.FRENCH_LANGUAGE_CODE.toString(), code: 'fr', nameEn: 'French', nameFr: 'Français' },
    ];
  }

  /**
   * Retrieves a list of all languages.
   *
   * @returns An array of Language DTOs.
   */
  listLanguages(): ReadonlyArray<LanguageDto> {
    this.log.debug('Get all languages');
    this.log.trace('Returning languages: [%j]', this.languageDtos);
    return this.languageDtos;
  }

  /**
   * Retrieves a specific language by its ID.
   *
   * @param id - The ID of the language to retrieve.
   * @returns The Language DTO corresponding to the specified ID.
   * @throws {LanguageNotFoundException} If no language is found with the specified ID.
   */
  getLanguageById(id: string): LanguageDto {
    this.log.debug('Get language with id: [%s]', id);
    const languageDto = this.languageDtos.find((dto) => dto.id === id);

    if (!languageDto) {
      this.log.error('Language with id: [%s] not found', id);
      throw new LanguageNotFoundException(`Language with id: [${id}] not found`);
    }

    this.log.trace('Returning language: [%j]', languageDto);
    return languageDto;
  }

  /**
   * Retrieves a list of all languages in the specified locale and sorts them.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of localized Language DTOs.
   */
  listAndSortLocalizedLanguages(locale: AppLocale): ReadonlyArray<LanguageLocalizedDto> {
    this.log.debug('Get and sort all localized languages with locale: [%s]', locale);
    const languageDtos = this.listLanguages();
    const localizedLanguageDtos = this.languageDtoMapper.mapLanguageDtosToLanguageLocalizedDtos(languageDtos, locale);
    const sortedLocalizedLanguageDtos = this.sortLocalizedLanguages(localizedLanguageDtos, locale);
    this.log.trace('Returning sorted localized languages: [%j]', sortedLocalizedLanguageDtos);
    return sortedLocalizedLanguageDtos;
  }

  /**
   * Retrieves a specific language by its ID in the specified locale.
   *
   * @param id - The ID of the language to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The localized Language DTO corresponding to the specified ID.
   * @throws {LanguageNotFoundException} If no language is found with the specified ID.
   */
  getLocalizedLanguageById(id: string, locale: AppLocale): LanguageLocalizedDto {
    this.log.debug('Get localized language with id: [%s] and locale: [%s]', id, locale);
    const languageDto = this.getLanguageById(id);
    const localizedLanguageDto = this.languageDtoMapper.mapLanguageDtoToLanguageLocalizedDto(languageDto, locale);
    this.log.trace('Returning localized language: [%j]', localizedLanguageDto);
    return localizedLanguageDto;
  }

  private sortLocalizedLanguages(languages: ReadonlyArray<LanguageLocalizedDto>, locale: AppLocale): ReadonlyArray<LanguageLocalizedDto> {
    const sortByNamePredicate = (a: LanguageLocalizedDto, b: LanguageLocalizedDto) => a.name.localeCompare(b.name, locale);
    const sortLocalizedLanguages = languages.toSorted(sortByNamePredicate);
    return moveToTop(sortLocalizedLanguages, ({ code }) => code === locale);
  }
}
