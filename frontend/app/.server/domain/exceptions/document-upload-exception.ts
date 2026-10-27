/** Technical failure while submitting a file to EWDU, distinct from a returned file rejection. */
export class DocumentUploadException extends Error {
  public readonly kind: 'http' | 'network' | 'invalid-response';
  public readonly httpStatus?: number;

  constructor(kind: 'http' | 'network' | 'invalid-response', httpStatus?: number, options?: ErrorOptions) {
    super(`Document upload failed: ${kind}`, options);
    this.name = 'DocumentUploadException';
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}
