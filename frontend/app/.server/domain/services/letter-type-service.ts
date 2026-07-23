import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';
import { None, match } from 'oxide.ts';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { LetterTypeDto, LetterTypeLocalizedDto } from '~/.server/domain/dtos';
import { LetterTypeNotFoundException } from '~/.server/domain/exceptions';
import type { LetterTypeDtoMapper } from '~/.server/domain/mappers';
import type { LetterTypeRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Service interface for managing letter type data.
 */
export interface LetterTypeService {
  /**
   * Retrieves a list of all letter types.
   *
   * @returns An array of letter type DTOs.
   */
  listLetterTypes(): Promise<ReadonlyArray<LetterTypeDto>>;

  /**
   * Retrieves a specific letter type by its ID.
   *
   * @param id - The ID of the letter type to retrieve.
   * @returns The letter type DTO corresponding to the specified ID.
   * @throws {LetterTypeNotFoundException} If no letter type is found with the specified ID.
   */
  getLetterTypeById(id: string): Promise<LetterTypeDto>;

  /**
   * Retrieves a list of all letter types in the specified locale.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of letter type DTOs in the specified locale.
   */
  listLocalizedLetterTypes(locale: AppLocale): Promise<ReadonlyArray<LetterTypeLocalizedDto>>;

  /**
   * Retrieves a specific letter type by its ID in the specified locale.
   *
   * @param id - The ID of the letter type to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The letter type DTO corresponding to the specified ID in the given locale.
   * @throws {LetterTypeNotFoundException} If no letter type is found with the specified ID.
   */
  getLocalizedLetterTypeById(id: string, locale: AppLocale): Promise<LetterTypeLocalizedDto>;
}

@injectable()
export class DefaultLetterTypeService implements LetterTypeService {
  private readonly log: Logger;
  private readonly letterTypeDtoMapper: LetterTypeDtoMapper;
  private readonly letterTypeRepository: LetterTypeRepository;
  private readonly serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_LETTER_TYPES_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_LETTER_TYPE_CACHE_TTL_SECONDS' | 'INVALID_LETTER_TYPE_IDS'>;

  constructor(
    @inject(TYPES.LetterTypeDtoMapper) letterTypeDtoMapper: LetterTypeDtoMapper,
    @inject(TYPES.LetterTypeRepository) letterTypeRepository: LetterTypeRepository,
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_LETTER_TYPES_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_LETTER_TYPE_CACHE_TTL_SECONDS' | 'INVALID_LETTER_TYPE_IDS'>,
  ) {
    this.log = createLogger('DefaultLetterTypeService');
    this.letterTypeDtoMapper = letterTypeDtoMapper;
    this.letterTypeRepository = letterTypeRepository;
    this.serverConfig = serverConfig;
    this.init();
  }

  private init(): void {
    // Configure caching for letter type operations
    const allLetterTypesCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_ALL_LETTER_TYPES_CACHE_TTL_SECONDS;
    const letterTypeCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_LETTER_TYPE_CACHE_TTL_SECONDS;

    this.log.debug('Cache TTL values; allLetterTypesCacheTTL: %d ms, letterTypeCacheTTL: %d ms', allLetterTypesCacheTTL, letterTypeCacheTTL);

    this.listLetterTypes = memoize(this.listLetterTypes, {
      async: true,
      expires: allLetterTypesCacheTTL,
    });

    type MemoizedListLetterTypes = Memoized<typeof this.listLetterTypes, Options<typeof this.listLetterTypes>>;
    (this.listLetterTypes as MemoizedListLetterTypes).cache.on('add', () => this.log.info('Creating new listLetterTypes memo'));

    this.getLetterTypeById = memoize(this.getLetterTypeById, {
      async: true,
      maxSize: Infinity,
      expires: letterTypeCacheTTL,
    });

    type MemoizedGetLetterTypeById = Memoized<typeof this.getLetterTypeById, Options<typeof this.getLetterTypeById>>;
    (this.getLetterTypeById as MemoizedGetLetterTypeById).cache.on('add', () => this.log.info('Creating new getLetterTypeById memo'));

    this.log.debug('DefaultLetterTypeService initiated.');
  }

  async listLetterTypes(): Promise<ReadonlyArray<LetterTypeDto>> {
    this.log.trace('Getting all letter types');
    const letterTypeEntities = await this.letterTypeRepository.listAllLetterTypes();
    const filteredLetterTypeEntities = letterTypeEntities.filter((letter) => !this.serverConfig.INVALID_LETTER_TYPE_IDS.includes(letter.esdc_value));
    const letterTypeDtos = this.letterTypeDtoMapper.mapLetterTypeEntitiesToLetterTypeDtos(filteredLetterTypeEntities);
    this.log.trace('Returning letter types: [%j]', letterTypeDtos);
    return letterTypeDtos;
  }

  async getLetterTypeById(id: string): Promise<LetterTypeDto> {
    this.log.trace('Getting letter type with id: [%s]', id);

    const letterTypeEntityOption = match(this.serverConfig.INVALID_LETTER_TYPE_IDS.includes(id), [
      [true, None],
      [false, await this.letterTypeRepository.findLetterTypeById(id)],
    ]);

    if (letterTypeEntityOption.isNone()) {
      this.log.error('Letter type with id: [%s] not found', id);
      throw new LetterTypeNotFoundException(`Letter type with id: [${id}] not found`);
    }

    const letterTypeDto = this.letterTypeDtoMapper.mapLetterTypeEntityToLetterTypeDto(letterTypeEntityOption.unwrap());
    this.log.trace('Returning letter type: [%j]', letterTypeDto);
    return letterTypeDto;
  }

  async listLocalizedLetterTypes(locale: AppLocale): Promise<ReadonlyArray<LetterTypeLocalizedDto>> {
    this.log.trace('Getting all localized letter types with locale: [%s]', locale);
    const letterTypeDtos = await this.listLetterTypes();
    const localizedLetterTypeDtos = this.letterTypeDtoMapper.mapLetterTypeDtosToLetterTypeLocalizedDtos(letterTypeDtos, locale);
    this.log.trace('Returning localized letter types: [%j]', localizedLetterTypeDtos);
    return localizedLetterTypeDtos;
  }

  async getLocalizedLetterTypeById(id: string, locale: AppLocale): Promise<LetterTypeLocalizedDto> {
    this.log.trace('Getting localized letter type with id: [%s] and locale: [%s]', id, locale);
    const letterTypeDto = await this.getLetterTypeById(id);
    const localizedLetterTypeDto = this.letterTypeDtoMapper.mapLetterTypeDtoToLetterTypeLocalizedDto(letterTypeDto, locale);
    this.log.trace('Returning localized letter type: [%j]', localizedLetterTypeDto);
    return localizedLetterTypeDto;
  }
}
