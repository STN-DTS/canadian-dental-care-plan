import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { SunLifeCommunicationMethodDto, SunLifeCommunicationMethodLocalizedDto } from '~/.server/domain/dtos';
import { SunLifeCommunicationMethodNotFoundException } from '~/.server/domain/exceptions';
import type { SunLifeCommunicationMethodDtoMapper } from '~/.server/domain/mappers';
import { DefaultSunLifeCommunicationMethodService } from '~/.server/domain/services';
import type { DefaultSunLifeCommunicationMethodService_ServiceConfig } from '~/.server/domain/services/sun-life-communication-method-service';

describe('DefaultSunLifeCommunicationMethodService', () => {
  const mockServerConfig: DefaultSunLifeCommunicationMethodService_ServiceConfig = {
    COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID: '1',
    COMMUNICATION_METHOD_SUNLIFE_MAIL_ID: '2',
  };

  describe('listSunLifeCommunicationMethods', () => {
    it('fetches all SunLife communication methods', () => {
      const mockDtos: SunLifeCommunicationMethodDto[] = [
        { id: mockServerConfig.COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID.toString(), code: 'email', nameEn: 'By email', nameFr: 'Par courriel' },
        { id: mockServerConfig.COMMUNICATION_METHOD_SUNLIFE_MAIL_ID.toString(), code: 'mail', nameEn: 'By mail', nameFr: 'Par la poste' },
      ];

      const mockSunLifeCommunicationMethodDtoMapper = mock<SunLifeCommunicationMethodDtoMapper>();
      const service = new DefaultSunLifeCommunicationMethodService(mockSunLifeCommunicationMethodDtoMapper, mockServerConfig);

      const dtos = service.listSunLifeCommunicationMethods();

      expect(dtos).toEqual(mockDtos);
    });
  });

  describe('getSunLifeCommunicationMethod', () => {
    it('fetches SunLife communication method by id', () => {
      const id = '1';
      const mockDto: SunLifeCommunicationMethodDto = { id: mockServerConfig.COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID.toString(), code: 'email', nameEn: 'By email', nameFr: 'Par courriel' };
      const mockSunLifeCommunicationMethodDtoMapper = mock<SunLifeCommunicationMethodDtoMapper>();
      const service = new DefaultSunLifeCommunicationMethodService(mockSunLifeCommunicationMethodDtoMapper, mockServerConfig);

      const dto = service.getSunLifeCommunicationMethodById(id);

      expect(dto).toEqual(mockDto);
    });

    it('fetches SunLife communication method by id throws not found exception', () => {
      const id = '999';

      const mockSunLifeCommunicationMethodDtoMapper = mock<SunLifeCommunicationMethodDtoMapper>();

      const service = new DefaultSunLifeCommunicationMethodService(mockSunLifeCommunicationMethodDtoMapper, mockServerConfig);

      expect(() => service.getSunLifeCommunicationMethodById(id)).toThrow(SunLifeCommunicationMethodNotFoundException);
    });
  });

  describe('listLocalizedSunLifeCommunicationMethods', () => {
    it('fetches localized SunLife communication methods when locale is "fr"', () => {
      const mockMappedSunLifeCommunicationMethodLocalizedDtos: SunLifeCommunicationMethodLocalizedDto[] = [
        { id: '1', code: 'email', name: 'Email' },
        { id: '2', code: 'mail', name: 'Mail' },
      ];

      const expectedSunLifeCommunicationMethodLocalizedDtos: SunLifeCommunicationMethodLocalizedDto[] = [
        { id: '1', code: 'email', name: 'Email' },
        { id: '2', code: 'mail', name: 'Mail' },
      ];

      const mockSunLifeCommunicationMethodDtoMapper = mock<SunLifeCommunicationMethodDtoMapper>();
      mockSunLifeCommunicationMethodDtoMapper.mapSunLifeCommunicationMethodDtosToSunLifeCommunicationMethodLocalizedDtos.mockReturnValueOnce(mockMappedSunLifeCommunicationMethodLocalizedDtos);

      const service = new DefaultSunLifeCommunicationMethodService(mockSunLifeCommunicationMethodDtoMapper, mockServerConfig);

      const dtos = service.listLocalizedSunLifeCommunicationMethods('fr');

      expect(dtos).toStrictEqual(expectedSunLifeCommunicationMethodLocalizedDtos);
      expect(mockSunLifeCommunicationMethodDtoMapper.mapSunLifeCommunicationMethodDtosToSunLifeCommunicationMethodLocalizedDtos).toHaveBeenCalledOnce();
    });
  });

  describe('getLocalizedSunLifeCommunicationMethodById', () => {
    it('fetches localized SunLife communication method by id', () => {
      const id = '1';
      const mockDto: SunLifeCommunicationMethodLocalizedDto = { id: '1', code: 'email', name: 'Email' };
      const mockSunLifeCommunicationMethodDtoMapper = mock<SunLifeCommunicationMethodDtoMapper>();
      mockSunLifeCommunicationMethodDtoMapper.mapSunLifeCommunicationMethodDtoToSunLifeCommunicationMethodLocalizedDto.mockReturnValueOnce(mockDto);
      const service = new DefaultSunLifeCommunicationMethodService(mockSunLifeCommunicationMethodDtoMapper, mockServerConfig);

      const dto = service.getLocalizedSunLifeCommunicationMethodById(id, 'en');

      expect(dto).toEqual(mockDto);
      expect(mockSunLifeCommunicationMethodDtoMapper.mapSunLifeCommunicationMethodDtoToSunLifeCommunicationMethodLocalizedDto).toHaveBeenCalledOnce();
    });

    it('fetches localized SunLife communication method by id throws not found exception', () => {
      const id = '1033';
      const mockSunLifeCommunicationMethodDtoMapper = mock<SunLifeCommunicationMethodDtoMapper>();
      const service = new DefaultSunLifeCommunicationMethodService(mockSunLifeCommunicationMethodDtoMapper, mockServerConfig);

      expect(() => service.getLocalizedSunLifeCommunicationMethodById(id, 'en')).toThrow(SunLifeCommunicationMethodNotFoundException);
      expect(mockSunLifeCommunicationMethodDtoMapper.mapSunLifeCommunicationMethodDtoToSunLifeCommunicationMethodLocalizedDto).not.toHaveBeenCalled();
    });
  });
});
