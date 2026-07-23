import type { Memoized, Options } from 'micro-memoize';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ClientFriendlyStatusDto, ClientFriendlyStatusLocalizedDto } from '~/.server/domain/dtos';
import { ClientFriendlyStatusNotFoundException } from '~/.server/domain/exceptions';
import type { ClientFriendlyStatusDtoMapper } from '~/.server/domain/mappers';
import type { ClientFriendlyStatusRepository } from '~/.server/domain/repositories';
import type { ClientFriendlyStatusServiceImpl_ServerConfig } from '~/.server/domain/services';
import { DefaultClientFriendlyStatusService } from '~/.server/domain/services';

vi.mock('micro-memoize');

describe('DefaultClientFriendlyStatusService', () => {
  const mockServerConfig: ClientFriendlyStatusServiceImpl_ServerConfig = {
    LOOKUP_SVC_CLIENT_FRIENDLY_STATUS_CACHE_TTL_SECONDS: 5,
  };

  describe('constructor', () => {
    it('sets the correct expires for memoize options', () => {
      const mockClientFriendlyStatusDtoMapper = mock<ClientFriendlyStatusDtoMapper>();
      const mockClientFriendlyStatusRepository = mock<ClientFriendlyStatusRepository>();

      const service = new DefaultClientFriendlyStatusService(mockClientFriendlyStatusDtoMapper, mockClientFriendlyStatusRepository, mockServerConfig); // Act and Assert

      expect((service.getClientFriendlyStatusById as Memoized<typeof service.getClientFriendlyStatusById, Options<typeof service.getClientFriendlyStatusById>>).options.expires).toBe(5000); // 5 seconds in milliseconds
    });
  });

  describe('getClientFriendlyStatusById', () => {
    it('fetches client friendly status by id', async () => {
      const id = '1';
      const mockClientFriendlyStatusRepository = mock<ClientFriendlyStatusRepository>();
      mockClientFriendlyStatusRepository.findClientFriendlyStatusById.mockResolvedValueOnce(
        Some({
          esdc_clientfriendlystatusid: '1',
          esdc_descriptionenglish: 'You have qualified for the Canadian Dental Care Plan.',
          esdc_descriptionfrench: 'Vous êtes admissible au Régime canadien de soins dentaires.',
        }),
      );

      const mockDto: ClientFriendlyStatusDto = {
        id: '1',
        nameEn: 'You have qualified for the Canadian Dental Care Plan.',
        nameFr: 'Vous êtes admissible au Régime canadien de soins dentaires.',
      };

      const mockClientFriendlyStatusDtoMapper = mock<ClientFriendlyStatusDtoMapper>();
      mockClientFriendlyStatusDtoMapper.mapClientFriendlyStatusEntityToClientFriendlyStatusDto.mockReturnValueOnce(mockDto);

      const service = new DefaultClientFriendlyStatusService(mockClientFriendlyStatusDtoMapper, mockClientFriendlyStatusRepository, mockServerConfig);

      const dto = await service.getClientFriendlyStatusById(id);

      expect(dto).toEqual(mockDto);
      expect(mockClientFriendlyStatusRepository.findClientFriendlyStatusById).toHaveBeenCalledOnce();
      expect(mockClientFriendlyStatusDtoMapper.mapClientFriendlyStatusEntityToClientFriendlyStatusDto).toHaveBeenCalledOnce();
    });

    it('fetches client friendly status by id throws not found exception', async () => {
      const id = '1033';
      const mockClientFriendlyStatusRepository = mock<ClientFriendlyStatusRepository>();
      mockClientFriendlyStatusRepository.findClientFriendlyStatusById.mockResolvedValueOnce(None);

      const mockClientFriendlyStatusDtoMapper = mock<ClientFriendlyStatusDtoMapper>();

      const service = new DefaultClientFriendlyStatusService(mockClientFriendlyStatusDtoMapper, mockClientFriendlyStatusRepository, mockServerConfig);

      await expect(service.getClientFriendlyStatusById(id)).rejects.toThrow(ClientFriendlyStatusNotFoundException);
      expect(mockClientFriendlyStatusRepository.findClientFriendlyStatusById).toHaveBeenCalledOnce();
      expect(mockClientFriendlyStatusDtoMapper.mapClientFriendlyStatusEntityToClientFriendlyStatusDto).not.toHaveBeenCalled();
    });
  });

  describe('getLocalizedClientFriendlyStatusById', () => {
    it('fetches localized client friendly status by id', async () => {
      const id = '1';
      const mockClientFriendlyStatusRepository = mock<ClientFriendlyStatusRepository>();
      mockClientFriendlyStatusRepository.findClientFriendlyStatusById.mockResolvedValueOnce(
        Some({
          esdc_clientfriendlystatusid: '1',
          esdc_descriptionenglish: 'You have qualified for the Canadian Dental Care Plan.',
          esdc_descriptionfrench: 'Vous êtes admissible au Régime canadien de soins dentaires.',
        }),
      );

      const mockDto: ClientFriendlyStatusLocalizedDto = { id: '1', name: 'You have qualified for the Canadian Dental Care Plan.' };

      const mockClientFriendlyStatusDtoMapper = mock<ClientFriendlyStatusDtoMapper>();
      mockClientFriendlyStatusDtoMapper.mapClientFriendlyStatusDtoToClientFriendlyStatusLocalizedDto.mockReturnValueOnce(mockDto);

      const service = new DefaultClientFriendlyStatusService(mockClientFriendlyStatusDtoMapper, mockClientFriendlyStatusRepository, mockServerConfig);

      const dto = await service.getLocalizedClientFriendlyStatusById(id, 'en');

      expect(dto).toEqual(mockDto);
      expect(mockClientFriendlyStatusRepository.findClientFriendlyStatusById).toHaveBeenCalledOnce();
      expect(mockClientFriendlyStatusDtoMapper.mapClientFriendlyStatusDtoToClientFriendlyStatusLocalizedDto).toHaveBeenCalledOnce();
    });

    it('fetches localized client friendly status by id throws not found exception', async () => {
      const id = '1033';
      const mockClientFriendlyStatusRepository = mock<ClientFriendlyStatusRepository>();
      mockClientFriendlyStatusRepository.findClientFriendlyStatusById.mockResolvedValueOnce(None);

      const mockClientFriendlyStatusDtoMapper = mock<ClientFriendlyStatusDtoMapper>();

      const service = new DefaultClientFriendlyStatusService(mockClientFriendlyStatusDtoMapper, mockClientFriendlyStatusRepository, mockServerConfig);

      await expect(service.getClientFriendlyStatusById(id)).rejects.toThrow(ClientFriendlyStatusNotFoundException);
      expect(mockClientFriendlyStatusRepository.findClientFriendlyStatusById).toHaveBeenCalledOnce();
      expect(mockClientFriendlyStatusDtoMapper.mapClientFriendlyStatusDtoToClientFriendlyStatusLocalizedDto).not.toHaveBeenCalled();
    });
  });
});
