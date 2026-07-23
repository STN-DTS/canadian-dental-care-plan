import { injectable } from 'inversify';

import type { ClientFriendlyStatusDto, ClientFriendlyStatusLocalizedDto } from '~/.server/domain/dtos';
import type { ClientFriendlyStatusEntity } from '~/.server/domain/entities';

export interface ClientFriendlyStatusDtoMapper {
  mapClientFriendlyStatusDtoToClientFriendlyStatusLocalizedDto(clientFriendlyStatusDto: ClientFriendlyStatusDto, locale: AppLocale): ClientFriendlyStatusLocalizedDto;
  mapClientFriendlyStatusEntityToClientFriendlyStatusDto(clientFriendlyStatusEntity: ClientFriendlyStatusEntity): ClientFriendlyStatusDto;
}

@injectable()
export class DefaultClientFriendlyStatusDtoMapper implements ClientFriendlyStatusDtoMapper {
  mapClientFriendlyStatusDtoToClientFriendlyStatusLocalizedDto(clientFriendlyStatusDto: ClientFriendlyStatusDto, locale: AppLocale): ClientFriendlyStatusLocalizedDto {
    const { nameEn, nameFr, ...rest } = clientFriendlyStatusDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapClientFriendlyStatusEntityToClientFriendlyStatusDto(clientFriendlyStatusEntity: ClientFriendlyStatusEntity): ClientFriendlyStatusDto {
    const id = clientFriendlyStatusEntity.esdc_clientfriendlystatusid;
    const nameEn = clientFriendlyStatusEntity.esdc_descriptionenglish;
    const nameFr = clientFriendlyStatusEntity.esdc_descriptionfrench;
    return { id, nameEn, nameFr };
  }
}
