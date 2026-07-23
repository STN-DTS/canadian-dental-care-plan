import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { AddressCorrectionRequestDto, AddressCorrectionResultDto, AddressCorrectionStatus } from '~/.server/domain/dtos';
import type { AddressCorrectionResultEntity } from '~/.server/domain/entities';
import { formatPostalCode, isValidPostalCode } from '~/.server/utils/postal-zip-code-utils';

export interface AddressValidationDtoMapper {
  mapAddressCorrectionResultEntityToAddressCorrectionResultDto(addressCorrectionResultEntity: AddressCorrectionResultEntity): AddressCorrectionResultDto;
  mapAddressCorrectionRequestDtoToAddressCorrectionResultDto(addressCorrectionRequestDto: AddressCorrectionRequestDto, status: AddressCorrectionStatus): AddressCorrectionResultDto;
}

@injectable()
export class DefaultAddressValidationDtoMapper implements AddressValidationDtoMapper {
  private readonly serverConfig: Pick<ServerConfig, 'CANADA_COUNTRY_ID'>;

  constructor(@inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'CANADA_COUNTRY_ID'>) {
    this.serverConfig = serverConfig;
  }

  mapAddressCorrectionResultEntityToAddressCorrectionResultDto(addressCorrectionResultEntity: AddressCorrectionResultEntity): AddressCorrectionResultDto {
    const correctionResults = addressCorrectionResultEntity['wsaddr:CorrectionResults'];
    return {
      address: correctionResults['nc:AddressFullText'],
      city: correctionResults['nc:AddressCityName'],
      postalCode: this.formatPostalCode(correctionResults['nc:AddressPostalCode']),
      provinceCode: correctionResults['can:ProvinceCode'],
      status: this.mapAddressCorrectionResultEntityStatusCodeToStatus(correctionResults['wsaddr:Information']['wsaddr:StatusCode']),
    };
  }

  mapAddressCorrectionRequestDtoToAddressCorrectionResultDto(addressCorrectionRequestDto: AddressCorrectionRequestDto, status: AddressCorrectionStatus): AddressCorrectionResultDto {
    return {
      address: addressCorrectionRequestDto.address.toUpperCase(),
      city: addressCorrectionRequestDto.city.toUpperCase(),
      postalCode: addressCorrectionRequestDto.postalCode.toUpperCase(),
      provinceCode: this.formatPostalCode(addressCorrectionRequestDto.postalCode),
      status,
    };
  }

  protected formatPostalCode(postalCode: string) {
    if (!isValidPostalCode(this.serverConfig.CANADA_COUNTRY_ID, postalCode)) {
      return postalCode.toUpperCase();
    }

    return formatPostalCode(this.serverConfig.CANADA_COUNTRY_ID, postalCode);
  }

  protected mapAddressCorrectionResultEntityStatusCodeToStatus(statusCode: string): AddressCorrectionStatus {
    switch (statusCode) {
      case 'Corrected': {
        return 'corrected';
      }
      case 'NotCorrect': {
        return 'not-correct';
      }
      case 'Valid': {
        return 'valid';
      }
      default: {
        throw new Error(`Unknown correction result status: [${statusCode}]`);
      }
    }
  }
}
