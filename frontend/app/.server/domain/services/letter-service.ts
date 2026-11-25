import { inject, injectable } from 'inversify';
import { sort } from 'moderndash';

import { AUDIT_EVENT_LETTERS_GET, AUDIT_EVENT_PDF_GET } from '~/.server/audit/audit-event-ids';
import type { AuditService } from '~/.server/audit/audit-service';
import { TYPES } from '~/.server/constants';
import type { LetterDto, LettersRequestDto, PdfRequestDto } from '~/.server/domain/dtos';
import type { LetterDtoMapper } from '~/.server/domain/mappers';
import type { LetterRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_LETTERS_SORT_ORDER, ATTR_CDCP_LETTER_ID } from '~/.server/logging/log-attributes';
import { userLogAttributes } from '~/.server/logging/user-log-attributes';
import { Traced } from '~/.server/observability/decorator';

export interface LetterService {
  /**
   * Find all letters for a given client id.
   *
   * @param lettersRequestDto The client ID and sort order.
   * @returns A Promise that resolves to all letters found for the client id.
   */
  findLettersByClientId(lettersRequestDto: LettersRequestDto): Promise<ReadonlyArray<LetterDto>>;

  /**
   * Retrieve the PDF for a given letter id.
   *
   * @param pdfRequestDto The letter ID.
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
  async findLettersByClientId({ clientId, sortOrder = 'desc' }: LettersRequestDto): Promise<ReadonlyArray<LetterDto>> {
    this.log.trace('Finding letters', { ...userLogAttributes(), [ATTR_CDCP_LETTERS_SORT_ORDER]: sortOrder });

    this.auditService.createAudit(AUDIT_EVENT_LETTERS_GET);

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
  async getPdfByLetterId({ letterId }: PdfRequestDto): Promise<string> {
    this.log.trace('Finding letter PDF', { [ATTR_CDCP_LETTER_ID]: letterId, ...userLogAttributes() });

    this.auditService.createAudit(AUDIT_EVENT_PDF_GET, { letterId });

    const pdfEntity = await this.letterRepository.getPdfByLetterId(letterId);
    const pdf = this.letterDtoMapper.mapPdfEntityToString(pdfEntity);

    this.log.trace('Letter PDF mapped', { [ATTR_CDCP_LETTER_ID]: letterId });
    return pdf;
  }
}
