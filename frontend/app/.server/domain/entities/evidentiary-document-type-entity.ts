export type EvidentiaryDocumentTypeResponseEntity = Readonly<{
  value: ReadonlyArray<EvidentiaryDocumentTypeEntity>;
}>;

export type EvidentiaryDocumentTypeEntity = Readonly<{
  esdc_evidentiarydocumenttypeid: string;
  esdc_value: string;
  esdc_nameenglish: string;
  esdc_namefrench: string;
  /**
   * Dynamics 365 standard state code:
   * 0 = Active
   * 1 = Inactive
   */
  statecode: number;
}>;
