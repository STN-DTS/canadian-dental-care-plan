import { injectable } from 'inversify';

import type { LetterDto } from '~/.server/domain/dtos';
import type { LetterEntity, PdfEntity } from '~/.server/domain/entities';

export interface LetterDtoMapper {
  mapLetterEntitiesToLetterDtos(letterEntities: ReadonlyArray<LetterEntity>): ReadonlyArray<LetterDto>;
  mapPdfEntityToString(pdfEntity: PdfEntity): string;
}

@injectable()
export class DefaultLetterDtoMapper implements LetterDtoMapper {
  mapLetterEntitiesToLetterDtos(letterEntities: ReadonlyArray<LetterEntity>): ReadonlyArray<LetterDto> {
    return letterEntities.map((letterEntity) => this.mapLetterEntityToLetterDto(letterEntity));
  }

  private mapLetterEntityToLetterDto(letterEntity: LetterEntity): LetterDto {
    return {
      id: letterEntity.LetterId,
      date: letterEntity.LetterDate,
      letterTypeId: letterEntity.LetterName,
    };
  }

  mapPdfEntityToString(pdfEntity: PdfEntity): string {
    return pdfEntity.documentBytes;
  }
}
