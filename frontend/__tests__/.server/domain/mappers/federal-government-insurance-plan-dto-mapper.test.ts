import { describe, expect, it } from 'vitest';

import type { FederalGovernmentInsurancePlanDto, FederalGovernmentInsurancePlanLocalizedDto } from '~/.server/domain/dtos';
import type { GovernmentInsurancePlanEntity } from '~/.server/domain/entities';
import { DefaultFederalGovernmentInsurancePlanDtoMapper } from '~/.server/domain/mappers';

describe('DefaultFederalGovernmentInsurancePlanDtoMapper', () => {
  describe('mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto', () => {
    it('maps a FederalGovernmentInsurancePlanDto to FederalGovernmentInsurancePlanLocalizedDto', () => {
      const mockDto: FederalGovernmentInsurancePlanDto = { id: '1', nameEn: 'First Insurance Plan', nameFr: "Premier plan d'assurance" };

      const expectedDto: FederalGovernmentInsurancePlanLocalizedDto = { id: '1', name: 'First Insurance Plan' };

      const mapper = new DefaultFederalGovernmentInsurancePlanDtoMapper();

      const dto = mapper.mapFederalGovernmentInsurancePlanDtoToFederalGovernmentInsurancePlanLocalizedDto(mockDto, 'en');

      expect(dto).toEqual(expectedDto);
    });
  });

  describe('mapFederalGovernmentInsurancePlanDtosToFederalGovernmentInsurancePlanLocalizedDtos', () => {
    it('maps an array of FederalGovernmentInsurancePlanDto to an array of FederalGovernmentInsurancePlanLocalizedDto', () => {
      const mockEntities: FederalGovernmentInsurancePlanDto[] = [
        { id: '1', nameEn: 'First Insurance Plan', nameFr: "Premier plan d'assurance" },
        { id: '2', nameEn: 'Second Insurance Plan', nameFr: "Deuxième plan d'assurance" },
      ];

      const expectedDtos: FederalGovernmentInsurancePlanLocalizedDto[] = [
        { id: '1', name: 'First Insurance Plan' },
        { id: '2', name: 'Second Insurance Plan' },
      ];

      const mapper = new DefaultFederalGovernmentInsurancePlanDtoMapper();

      const dtos = mapper.mapFederalGovernmentInsurancePlanDtosToFederalGovernmentInsurancePlanLocalizedDtos(mockEntities, 'en');

      expect(dtos).toEqual(expectedDtos);
    });
  });

  describe('mapGovernmentInsurancePlanEntityToFederalGovernmentInsurancePlanDto', () => {
    it('maps a GovernmentInsurancePlanEntity to a FederalGovernmentInsurancePlanDto', () => {
      const mockEntity: GovernmentInsurancePlanEntity = {
        esdc_governmentinsuranceplanid: '1',
        esdc_nameenglish: 'First Insurance Plan',
        esdc_namefrench: "Premier plan d'assurance",
        _esdc_provinceterritorystateid_value: null,
      };

      const expectedDto: FederalGovernmentInsurancePlanDto = { id: '1', nameEn: 'First Insurance Plan', nameFr: "Premier plan d'assurance" };

      const mapper = new DefaultFederalGovernmentInsurancePlanDtoMapper();

      const dto = mapper.mapGovernmentInsurancePlanEntityToFederalGovernmentInsurancePlanDto(mockEntity);

      expect(dto).toEqual(expectedDto);
    });
  });

  describe('mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos', () => {
    it('maps an array of GovernmentInsurancePlanEntity to an array of FederalGovernmentInsurancePlanDto', () => {
      const mockEntities: GovernmentInsurancePlanEntity[] = [
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'First Insurance Plan',
          esdc_namefrench: "Premier plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
        {
          esdc_governmentinsuranceplanid: '2',
          esdc_nameenglish: 'Second Insurance Plan',
          esdc_namefrench: "Deuxième plan d'assurance",
          _esdc_provinceterritorystateid_value: null,
        },
      ];

      const expectedDtos: FederalGovernmentInsurancePlanDto[] = [
        { id: '1', nameEn: 'First Insurance Plan', nameFr: "Premier plan d'assurance" },
        { id: '2', nameEn: 'Second Insurance Plan', nameFr: "Deuxième plan d'assurance" },
      ];

      const mapper = new DefaultFederalGovernmentInsurancePlanDtoMapper();

      const dtos = mapper.mapGovernmentInsurancePlanEntitiesToFederalGovernmentInsurancePlanDtos(mockEntities);

      expect(dtos).toEqual(expectedDtos);
    });
  });
});
