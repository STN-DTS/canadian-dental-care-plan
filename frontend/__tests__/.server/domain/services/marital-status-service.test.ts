import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { MaritalStatusDto, MaritalStatusLocalizedDto } from '~/.server/domain/dtos';
import { MaritalStatusNotFoundException } from '~/.server/domain/exceptions';
import type { MaritalStatusDtoMapper } from '~/.server/domain/mappers';
import { DefaultMaritalStatusService } from '~/.server/domain/services';
import type { DefaultMaritalStatusService_ServiceConfig } from '~/.server/domain/services/marital-status-service';

describe('DefaultMaritalStatusService', () => {
  const mockServerConfig: DefaultMaritalStatusService_ServiceConfig = {
    MARITAL_STATUS_CODE_COMMON_LAW: '1',
    MARITAL_STATUS_CODE_DIVORCED: '2',
    MARITAL_STATUS_CODE_MARRIED: '3',
    MARITAL_STATUS_CODE_SEPARATED: '4',
    MARITAL_STATUS_CODE_SINGLE: '5',
    MARITAL_STATUS_CODE_WIDOWED: '6',
  };

  describe('listMaritalStatuses', () => {
    it('get all marital statuses', () => {
      const mockDtos: MaritalStatusDto[] = [
        { id: mockServerConfig.MARITAL_STATUS_CODE_SINGLE, nameEn: 'Single', nameFr: 'Célibataire' },
        { id: mockServerConfig.MARITAL_STATUS_CODE_MARRIED, nameEn: 'Married', nameFr: 'Marié(e)' },
        { id: mockServerConfig.MARITAL_STATUS_CODE_COMMON_LAW, nameEn: 'Common-Law', nameFr: 'Conjoint(e) de fait' },
        { id: mockServerConfig.MARITAL_STATUS_CODE_SEPARATED, nameEn: 'Separated', nameFr: 'Séparé(e)' },
        { id: mockServerConfig.MARITAL_STATUS_CODE_DIVORCED, nameEn: 'Divorced', nameFr: 'Divorcé(e)' },
        { id: mockServerConfig.MARITAL_STATUS_CODE_WIDOWED, nameEn: 'Widowed', nameFr: 'Veuf ou veuve' },
      ];

      const mockMaritalStatusDtoMapper = mock<MaritalStatusDtoMapper>();
      const service = new DefaultMaritalStatusService(mockMaritalStatusDtoMapper, mockServerConfig);

      const dtos = service.listMaritalStatuses();

      expect(dtos).toEqual(mockDtos);
    });
  });

  describe('getMaritalStatusById', () => {
    it('get marital status by id', () => {
      const id = '1';
      const mockDto: MaritalStatusDto = { id: mockServerConfig.MARITAL_STATUS_CODE_COMMON_LAW, nameEn: 'Common-Law', nameFr: 'Conjoint(e) de fait' };
      const mockMaritalStatusDtoMapper = mock<MaritalStatusDtoMapper>();
      const service = new DefaultMaritalStatusService(mockMaritalStatusDtoMapper, mockServerConfig);

      const dto = service.getMaritalStatusById(id);

      expect(dto).toEqual(mockDto);
    });

    it('get marital status by id throws not found exception', () => {
      const id = '999';

      const mockMaritalStatusDtoMapper = mock<MaritalStatusDtoMapper>();

      const service = new DefaultMaritalStatusService(mockMaritalStatusDtoMapper, mockServerConfig);

      expect(() => service.getMaritalStatusById(id)).toThrow(MaritalStatusNotFoundException);
    });
  });

  describe('listLocalizedMaritalStatuses', () => {
    it('get localized marital statuses when locale is "fr"', () => {
      const mockMappedMaritalStatusLocalizedDtos: MaritalStatusLocalizedDto[] = [
        { id: '1', name: 'Conjoint(e) de fait' },
        { id: '2', name: 'Célibataire' },
      ];

      const expectedMaritalStatusLocalizedDtos: MaritalStatusLocalizedDto[] = [
        { id: '1', name: 'Conjoint(e) de fait' },
        { id: '2', name: 'Célibataire' },
      ];

      const mockMaritalStatusDtoMapper = mock<MaritalStatusDtoMapper>();
      mockMaritalStatusDtoMapper.mapMaritalStatusDtosToMaritalStatusLocalizedDtos.mockReturnValueOnce(mockMappedMaritalStatusLocalizedDtos);

      const service = new DefaultMaritalStatusService(mockMaritalStatusDtoMapper, mockServerConfig);

      const dtos = service.listLocalizedMaritalStatuses('fr');

      expect(dtos).toStrictEqual(expectedMaritalStatusLocalizedDtos);
      expect(mockMaritalStatusDtoMapper.mapMaritalStatusDtosToMaritalStatusLocalizedDtos).toHaveBeenCalledOnce();
    });
  });

  describe('getLocalizedMaritalStatusById', () => {
    it('get localized marital status by id', () => {
      const id = '1';
      const mockDto: MaritalStatusLocalizedDto = { id: '1', name: 'Common-Law' };
      const mockMaritalStatusDtoMapper = mock<MaritalStatusDtoMapper>();
      mockMaritalStatusDtoMapper.mapMaritalStatusDtoToMaritalStatusLocalizedDto.mockReturnValueOnce(mockDto);
      const service = new DefaultMaritalStatusService(mockMaritalStatusDtoMapper, mockServerConfig);

      const dto = service.getLocalizedMaritalStatusById(id, 'en');

      expect(dto).toEqual(mockDto);
      expect(mockMaritalStatusDtoMapper.mapMaritalStatusDtoToMaritalStatusLocalizedDto).toHaveBeenCalledOnce();
    });

    it('get localized marital status by id throws not found exception', () => {
      const id = '1033';
      const mockMaritalStatusDtoMapper = mock<MaritalStatusDtoMapper>();
      const service = new DefaultMaritalStatusService(mockMaritalStatusDtoMapper, mockServerConfig);

      expect(() => service.getLocalizedMaritalStatusById(id, 'en')).toThrow(MaritalStatusNotFoundException);
      expect(mockMaritalStatusDtoMapper.mapMaritalStatusDtoToMaritalStatusLocalizedDto).not.toHaveBeenCalled();
    });
  });
});
