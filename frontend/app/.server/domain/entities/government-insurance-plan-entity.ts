export type GovernmentInsurancePlanResponseEntity = Readonly<{
  value: ReadonlyArray<GovernmentInsurancePlanEntity>;
}>;

export type GovernmentInsurancePlanEntity = Readonly<{
  esdc_governmentinsuranceplanid: string;
  esdc_nameenglish: string;
  esdc_namefrench: string;
  _esdc_provinceterritorystateid_value: string | null;
}>;
