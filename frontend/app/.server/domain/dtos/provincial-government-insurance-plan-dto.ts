/**
 * Represents a Data Transfer Object (DTO) for a provincial government insurance plan.
 */
export type ProvincialGovernmentInsurancePlanDto = Readonly<{
  /** Unique identifier for the provincial government insurance plan. */
  id: string;

  /** Provincial government insurance plan name in English. */
  nameEn: string;

  /** Provincial government insurance plan name in French. */
  nameFr: string;

  /** The ID of the province, territory, or state that the plan is associated with. */
  provinceTerritoryStateId: string;
}>;

export type ProvincialGovernmentInsurancePlanLocalizedDto = OmitStrict<ProvincialGovernmentInsurancePlanDto, 'nameEn' | 'nameFr'> &
  Readonly<{
    /** Localized name for the provincial government insurance plan. */
    name: string;
  }>;
