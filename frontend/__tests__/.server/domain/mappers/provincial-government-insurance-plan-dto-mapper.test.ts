import { describe, expect, it } from 'vitest';

import type { ProvincialGovernmentInsurancePlanDto, ProvincialGovernmentInsurancePlanLocalizedDto } from '~/.server/domain/dtos';
import type { GovernmentInsurancePlanEntity } from '~/.server/domain/entities';
import { DefaultProvincialGovernmentInsurancePlanDtoMapper } from '~/.server/domain/mappers';

describe('DefaultProvincialGovernmentInsurancePlanDtoMapper', () => {
  describe('mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto', () => {
    it('should map a DTO to a localized DTO with the correct name based on the locale', () => {
      const dto: ProvincialGovernmentInsurancePlanDto = { id: '1', nameEn: 'English Name', nameFr: 'French Name', provinceTerritoryStateId: '2' };

      const mapper = new DefaultProvincialGovernmentInsurancePlanDtoMapper();

      const localizedDtoEn = mapper.mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto(dto, 'en');
      expect(localizedDtoEn).toEqual<ProvincialGovernmentInsurancePlanLocalizedDto>({ id: '1', name: 'English Name', provinceTerritoryStateId: '2' });

      const localizedDtoFr = mapper.mapProvincialGovernmentInsurancePlanDtoToProvincialGovernmentInsurancePlanLocalizedDto(dto, 'fr');
      expect(localizedDtoFr).toEqual<ProvincialGovernmentInsurancePlanLocalizedDto>({ id: '1', name: 'French Name', provinceTerritoryStateId: '2' });
    });
  });

  describe('mapProvincialGovernmentInsurancePlanDtosToProvincialGovernmentInsurancePlanLocalizedDtos', () => {
    it('should map an array of DTOs to an array of localized DTOs with the correct names based on the locale', () => {
      const dtos: ProvincialGovernmentInsurancePlanDto[] = [
        { id: '1', nameEn: 'English Name 1', nameFr: 'French Name 1', provinceTerritoryStateId: '2' },
        { id: '2', nameEn: 'English Name 2', nameFr: 'French Name 2', provinceTerritoryStateId: '3' },
      ];

      const mapper = new DefaultProvincialGovernmentInsurancePlanDtoMapper();

      const localizedDtosEn = mapper.mapProvincialGovernmentInsurancePlanDtosToProvincialGovernmentInsurancePlanLocalizedDtos(dtos, 'en');
      expect(localizedDtosEn).toEqual<ProvincialGovernmentInsurancePlanLocalizedDto[]>([
        { id: '1', name: 'English Name 1', provinceTerritoryStateId: '2' },
        { id: '2', name: 'English Name 2', provinceTerritoryStateId: '3' },
      ]);

      const localizedDtosFr = mapper.mapProvincialGovernmentInsurancePlanDtosToProvincialGovernmentInsurancePlanLocalizedDtos(dtos, 'fr');
      expect(localizedDtosFr).toEqual<ProvincialGovernmentInsurancePlanLocalizedDto[]>([
        { id: '1', name: 'French Name 1', provinceTerritoryStateId: '2' },
        { id: '2', name: 'French Name 2', provinceTerritoryStateId: '3' },
      ]);
    });
  });

  describe('mapGovernmentInsurancePlanEntityToProvincialGovernmentInsurancePlanDto', () => {
    it('maps a GovernmentInsurancePlanEntity with both English and French labels to a ProvincialGovernmentInsurancePlanDto', () => {
      const mockEntity: GovernmentInsurancePlanEntity = {
        esdc_governmentinsuranceplanid: '1',
        esdc_nameenglish: 'First Insurance Plan',
        esdc_namefrench: "Premier plan d'assurance",
        _esdc_provinceterritorystateid_value: '10',
      };

      const mapper = new DefaultProvincialGovernmentInsurancePlanDtoMapper();

      const dto = mapper.mapGovernmentInsurancePlanEntityToProvincialGovernmentInsurancePlanDto(mockEntity);

      expect(dto).toEqual<ProvincialGovernmentInsurancePlanDto>({
        id: '1',
        nameEn: 'First Insurance Plan',
        nameFr: "Premier plan d'assurance",
        provinceTerritoryStateId: '10',
      });
    });
  });

  describe('mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos', () => {
    it('maps an array of GovernmentInsurancePlanEntities to an array of ProvincialGovernmentInsurancePlanDtos', () => {
      const mockEntities: GovernmentInsurancePlanEntity[] = [
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: '10',
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: '20',
        },
      ];

      const mapper = new DefaultProvincialGovernmentInsurancePlanDtoMapper();

      const dtos = mapper.mapGovernmentInsurancePlanEntitiesToProvincialGovernmentInsurancePlanDtos(mockEntities);

      expect(dtos).toEqual<ProvincialGovernmentInsurancePlanDto[]>([
        { id: '1', nameEn: 'First Insurance Plan', nameFr: "Premier plan d'assurance", provinceTerritoryStateId: '10' },
        { id: '2', nameEn: 'Second Insurance Plan', nameFr: "Deuxième plan d'assurance", provinceTerritoryStateId: '20' },
      ]);
    });
  });
});
