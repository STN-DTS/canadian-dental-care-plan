export type EvidentiaryDocumentTypeResponseEntity = Readonly<{
  value: ReadonlyArray<EvidentiaryDocumentTypeEntity>;
}>;

export type EvidentiaryDocumentTypeEntity = Readonly<{
  esdc_evidentiarydocumenttypeid: string;
  esdc_value: string;
  esdc_nameenglish: string;
  esdc_namefrench: string;
}>;
