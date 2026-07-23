/**
 * Represents a Data Transfer Object (DTO) for a federal government insurance plan.
 */
export type FederalGovernmentInsurancePlanDto = Readonly<{
  /** Unique identifier for the federal government insurance plan. */
  id: string;

  /** Federal government insurance plan name in English. */
  nameEn: string;

  /** Federal government insurance plan name in French. */
  nameFr: string;
}>;

/**
 * Represents a localized version of the Federal Government Insurance Plan DTO.
 * Inherits the federal government insurance plan ID and provides a single localized name.
 */
export type FederalGovernmentInsurancePlanLocalizedDto = OmitStrict<FederalGovernmentInsurancePlanDto, 'nameEn' | 'nameFr'> &
  Readonly<{
    /** Localized name for the federal government insurance plan. */
    name: string;
  }>;
