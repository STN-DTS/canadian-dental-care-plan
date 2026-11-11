import { inject, injectable } from 'inversify';
import { sort } from 'moderndash';

import { TYPES } from '~/.server/constants';
import type { LetterDto, LettersRequestDto, PdfRequestDto } from '~/.server/domain/dtos';
import type { LetterDtoMapper } from '~/.server/domain/mappers';
import type { LetterRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_LETTERS_SORT_ORDER, ATTR_CDCP_LETTER_ID, ATTR_CDCP_USER_ID } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';

export interface LetterService {
  /**
   * Find all letters for a given client id.
   *
   * @param lettersRequestDto The letters request dto that includes the client id and user id for auditing
   * @returns A Promise that resolves to all letters found for the client id.
   */
  findLettersByClientId(lettersRequestDto: LettersRequestDto): Promise<ReadonlyArray<LetterDto>>;

  /**
   * Retrieve the PDF for a given letter id.
   *
   * @param pdfRequestDto  The PDF request dto that includes the letter id and user id for auditing
   * @returns A Promise that resolves to the PDF data as a base64-encoded string representing the bytes.
   */
  getPdfByLetterId(pdfRequestDto: PdfRequestDto): Promise<string>;
}

@injectable()
export class DefaultLetterService implements LetterService {
  private readonly log: Logger;
  private readonly letterDtoMapper: LetterDtoMapper;
  private readonly letterRepository: LetterRepository;
  private readonly auditService: AuditService;

  constructor(@inject(TYPES.LetterDtoMapper) letterDtoMapper: LetterDtoMapper, @inject(TYPES.LetterRepository) letterRepository: LetterRepository, @inject(TYPES.AuditService) auditService: AuditService) {
    this.log = createLogger('DefaultLetterService');
    this.letterDtoMapper = letterDtoMapper;
    this.letterRepository = letterRepository;
    this.auditService = auditService;
    this.init();
  }

  private init(): void {
    this.log.debug('DefaultLetterService initiated.');
  }

  @Traced()
  async findLettersByClientId({ clientId, userId, sortOrder = 'desc' }: LettersRequestDto): Promise<ReadonlyArray<LetterDto>> {
    this.log.trace('Finding letters', { [ATTR_CDCP_USER_ID]: userId, [ATTR_CDCP_LETTERS_SORT_ORDER]: sortOrder });

    this.auditService.createAudit('letters.get', { userId });

    const letterEntities = await this.letterRepository.findLettersByClientId(clientId);
    const letterDtos = this.letterDtoMapper.mapLetterEntitiesToLetterDtos(letterEntities);
    const sortedLetterDtos = sort(letterDtos, {
      order: sortOrder,
      by: (letterDto) => letterDto.date,
    });

    this.log.trace('Letters mapped and sorted');
    return sortedLetterDtos;
  }

  @Traced()
  async getPdfByLetterId({ letterId, userId }: PdfRequestDto): Promise<string> {
    this.log.trace('Finding letter PDF', { [ATTR_CDCP_LETTER_ID]: letterId, [ATTR_CDCP_USER_ID]: userId });

    this.auditService.createAudit('pdf.get', { letterId, userId });

    const pdfEntity = await this.letterRepository.getPdfByLetterId(letterId);
    const pdf = this.letterDtoMapper.mapPdfEntityToString(pdfEntity);

    this.log.trace('Letter PDF mapped', { [ATTR_CDCP_LETTER_ID]: letterId });
    return pdf;
  }
}
