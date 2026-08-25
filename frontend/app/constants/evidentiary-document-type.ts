type EvidentiaryDocumentTypeStatusBrand<Value extends number> = Brand<Value, 'EvidentiaryDocumentTypeStatus'>;

/**
 * Brands an evidentiary document type status value.
 */
export function toEvidentiaryDocumentTypeStatus<Value extends number>(value: Value): EvidentiaryDocumentTypeStatusBrand<Value> {
  return value as EvidentiaryDocumentTypeStatusBrand<Value>;
}

/**
 * Evidentiary document type status codes.
 */
export const EVIDENTIARY_DOCUMENT_TYPE_STATUS = {
  active: toEvidentiaryDocumentTypeStatus(0),
  inactive: toEvidentiaryDocumentTypeStatus(1),
} as const;

export type EvidentiaryDocumentTypeStatus = (typeof EVIDENTIARY_DOCUMENT_TYPE_STATUS)[keyof typeof EVIDENTIARY_DOCUMENT_TYPE_STATUS];
