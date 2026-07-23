import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { GCCommunicationMethodDto, GCCommunicationMethodLocalizedDto } from '~/.server/domain/dtos';
import { GCCommunicationMethodNotFoundException } from '~/.server/domain/exceptions';
import type { GCCommunicationMethodDtoMapper } from '~/.server/domain/mappers';
import { DefaultGCCommunicationMethodService } from '~/.server/domain/services';
import type { DefaultGCCommunicationMethodService_ServiceConfig } from '~/.server/domain/services/gc-communication-method-service';

describe('DefaultGCCommunicationMethodService', () => {
  const mockServerConfig: DefaultGCCommunicationMethodService_ServiceConfig = {
    COMMUNICATION_METHOD_GC_DIGITAL_ID: '1',
    COMMUNICATION_METHOD_GC_MAIL_ID: '2',
  };

  describe('listGCCommunicationMethods', () => {
    it('fetches all GC communication methods', () => {
      const mockDtos: GCCommunicationMethodDto[] = [
        { id: mockServerConfig.COMMUNICATION_METHOD_GC_DIGITAL_ID.toString(), code: 'digital', nameEn: 'Online through My Service Canada Account (MSCA)', nameFr: "En ligne, par l'entremise de Mon dossier Service Canada (MDSC)" },
        { id: mockServerConfig.COMMUNICATION_METHOD_GC_MAIL_ID.toString(), code: 'mail', nameEn: 'By mail', nameFr: 'Par la poste' },
      ];

      const mockGCCommunicationMethodDtoMapper = mock<GCCommunicationMethodDtoMapper>();
      const service = new DefaultGCCommunicationMethodService(mockGCCommunicationMethodDtoMapper, mockServerConfig);

      const dtos = service.listGCCommunicationMethods();

      expect(dtos).toEqual(mockDtos);
    });
  });

  describe('getGCCommunicationMethod', () => {
    it('fetches GC communication method by id', () => {
      const id = '1';
      const mockDto: GCCommunicationMethodDto = {
        id: mockServerConfig.COMMUNICATION_METHOD_GC_DIGITAL_ID.toString(),
        code: 'digital',
        nameEn: 'Online through My Service Canada Account (MSCA)',
        nameFr: "En ligne, par l'entremise de Mon dossier Service Canada (MDSC)",
      };
      const mockGCCommunicationMethodDtoMapper = mock<GCCommunicationMethodDtoMapper>();
      const service = new DefaultGCCommunicationMethodService(mockGCCommunicationMethodDtoMapper, mockServerConfig);

      const dto = service.getGCCommunicationMethodById(id);

      expect(dto).toEqual(mockDto);
    });

    it('fetches GC communication method by id throws not found exception', () => {
      const id = '999';

      const mockGCCommunicationMethodDtoMapper = mock<GCCommunicationMethodDtoMapper>();

      const service = new DefaultGCCommunicationMethodService(mockGCCommunicationMethodDtoMapper, mockServerConfig);

      expect(() => service.getGCCommunicationMethodById(id)).toThrow(GCCommunicationMethodNotFoundException);
    });
  });

  describe('listLocalizedGCCommunicationMethods', () => {
    it('fetches localized GC communication methods when locale is "fr"', () => {
      const mockMappedGCCommunicationMethodLocalizedDtos: GCCommunicationMethodLocalizedDto[] = [
        { id: '1', code: 'digital', name: 'Numériquement' },
        { id: '2', code: 'mail', name: 'Poste' },
      ];

      const expectedGCCommunicationMethodLocalizedDtos: GCCommunicationMethodLocalizedDto[] = [
        { id: '1', code: 'digital', name: 'Numériquement' },
        { id: '2', code: 'mail', name: 'Poste' },
      ];

      const mockGCCommunicationMethodDtoMapper = mock<GCCommunicationMethodDtoMapper>();
      mockGCCommunicationMethodDtoMapper.mapGCCommunicationMethodDtosToGCCommunicationMethodLocalizedDtos.mockReturnValueOnce(mockMappedGCCommunicationMethodLocalizedDtos);

      const service = new DefaultGCCommunicationMethodService(mockGCCommunicationMethodDtoMapper, mockServerConfig);

      const dtos = service.listLocalizedGCCommunicationMethods('fr');

      expect(dtos).toStrictEqual(expectedGCCommunicationMethodLocalizedDtos);
      expect(mockGCCommunicationMethodDtoMapper.mapGCCommunicationMethodDtosToGCCommunicationMethodLocalizedDtos).toHaveBeenCalledOnce();
    });
  });

  describe('getLocalizedGCCommunicationMethodById', () => {
    it('fetches localized GC communication method by id', () => {
      const id = '1';
      const mockDto: GCCommunicationMethodLocalizedDto = { id: '1', code: 'digital', name: 'Digital' };
      const mockGCCommunicationMethodDtoMapper = mock<GCCommunicationMethodDtoMapper>();
      mockGCCommunicationMethodDtoMapper.mapGCCommunicationMethodDtoToGCCommunicationMethodLocalizedDto.mockReturnValueOnce(mockDto);
      const service = new DefaultGCCommunicationMethodService(mockGCCommunicationMethodDtoMapper, mockServerConfig);

      const dto = service.getLocalizedGCCommunicationMethodById(id, 'en');

      expect(dto).toEqual(mockDto);
      expect(mockGCCommunicationMethodDtoMapper.mapGCCommunicationMethodDtoToGCCommunicationMethodLocalizedDto).toHaveBeenCalledOnce();
    });

    it('fetches localized GC communication method by id throws not found exception', () => {
      const id = '1033';
      const mockGCCommunicationMethodDtoMapper = mock<GCCommunicationMethodDtoMapper>();
      const service = new DefaultGCCommunicationMethodService(mockGCCommunicationMethodDtoMapper, mockServerConfig);

      expect(() => service.getLocalizedGCCommunicationMethodById(id, 'en')).toThrow(GCCommunicationMethodNotFoundException);
      expect(mockGCCommunicationMethodDtoMapper.mapGCCommunicationMethodDtoToGCCommunicationMethodLocalizedDto).not.toHaveBeenCalled();
    });
  });
});
