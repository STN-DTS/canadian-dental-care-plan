import { describe, expect, it } from 'vitest';

import type { ClientFriendlyStatusDto, ClientFriendlyStatusLocalizedDto } from '~/.server/domain/dtos';
import type { ClientFriendlyStatusEntity } from '~/.server/domain/entities';
import { DefaultClientFriendlyStatusDtoMapper } from '~/.server/domain/mappers';

describe('DefaultClientFriendlyStatusDtoMapper', () => {
  describe('mapClientFriendlyStatusDtoToClientFriendlyStatusLocalizedDto', () => {
    it('maps a ClientFriendlyStatusDto with both English and French labels to a ClientFriendlyStatusLocalizedDto', () => {
      const mockDto: ClientFriendlyStatusDto = {
        id: '1',
        nameEn: 'You have qualified for the Canadian Dental Care Plan.',
        nameFr: 'Vous êtes admissible au Régime canadien de soins dentaires.',
      };

      const expectedLocalizedDto: ClientFriendlyStatusLocalizedDto = {
        id: '1',
        name: 'You have qualified for the Canadian Dental Care Plan.',
      };

      const mapper = new DefaultClientFriendlyStatusDtoMapper();

      const localizedDto = mapper.mapClientFriendlyStatusDtoToClientFriendlyStatusLocalizedDto(mockDto, 'en');

      expect(localizedDto).toEqual(expectedLocalizedDto);
    });
  });

  describe('mapClientFriendlyStatusEntityToClientFriendlyStatusDto', () => {
    it('maps a ClientFriendlyStatusEntity with both English and French labels to a ClientFriendlyStatusDto', () => {
      const mockEntity: ClientFriendlyStatusEntity = {
        esdc_clientfriendlystatusid: '1',
        esdc_descriptionenglish: 'You have qualified for the Canadian Dental Care Plan.',
        esdc_descriptionfrench: 'Vous êtes admissible au Régime canadien de soins dentaires.',
      };

      const expectedDto: ClientFriendlyStatusDto = {
        id: '1',
        nameEn: 'You have qualified for the Canadian Dental Care Plan.',
        nameFr: 'Vous êtes admissible au Régime canadien de soins dentaires.',
      };

      const mapper = new DefaultClientFriendlyStatusDtoMapper();

      const dto = mapper.mapClientFriendlyStatusEntityToClientFriendlyStatusDto(mockEntity);

      expect(dto).toEqual(expectedDto);
    });
  });
});
