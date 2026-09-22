import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime';
import { None, Option } from 'oxide.ts';

interface FileContentTypeInput {
  readonly file: File;
}

interface BufferedFileContentTypeInput {
  readonly fileBuffer: ArrayBuffer;
  readonly declaredMimeType: string;
}

type IsFileContentTypeAllowedArgs = {
  readonly allowedExtensions: readonly string[];
} & (FileContentTypeInput | BufferedFileContentTypeInput);

/**
 * Validates a file's content type using signature detection.
 *
 * Detected MIME types must match a MIME type derived from the allowed extensions. When
 * detection returns no type, the file is allowed only when declared as `text/plain`.
 * File extensions must be validated separately by the caller.
 *
 * Pass pre-read buffered content to avoid reading the same file more than once.
 *
 * @param args - Allowed extensions plus a file or buffered file content
 * @returns Whether the content satisfies the detected-type policy or plain-text fallback
 * @throws {Error} When detected content is available and an allowed extension has no registered MIME type
 */
export async function isFileContentTypeAllowed(args: IsFileContentTypeAllowedArgs): Promise<boolean> {
  let fileBuffer: ArrayBuffer;
  let declaredMimeType: string;

  if ('file' in args) {
    fileBuffer = await args.file.arrayBuffer();
    declaredMimeType = args.file.type;
  } else {
    fileBuffer = args.fileBuffer;
    declaredMimeType = args.declaredMimeType;
  }

  const detectedFileType = await fileTypeFromBuffer(fileBuffer);

  // Plain text has no detectable signature, so fall back to its declared MIME type.
  if (!detectedFileType) {
    return declaredMimeType === 'text/plain';
  }

  const allowedMimeTypes = new Set(args.allowedExtensions.map(getMimeType));
  return allowedMimeTypes.has(detectedFileType.mime);
}

/**
 * Finds the MIME type for a given file extension.
 *
 * @param extension - The file extension to look up (must start with a dot, e.g., ".pdf")
 * @returns An Option containing the MIME type if found, or None if the extension is invalid or not found
 *
 * @example
 * ```typescript
 * findMimeType('.pdf') // Some('application/pdf')
 * findMimeType('pdf')  // None
 * ```
 */
export function findMimeType(extension: string): Option<string> {
  if (!extension.startsWith('.')) return None;
  return Option.from(mime.getType(extension));
}

/**
 * Gets the MIME type for a given file extension.
 *
 * @param extension - The file extension to look up (must start with a dot, e.g., ".pdf")
 * @returns The MIME type string for the given extension
 * @throws {Error} When the MIME type is not found for the provided extension
 *
 * @example
 * ```typescript
 * getMimeType('.pdf') // 'application/pdf'
 * getMimeType('.json') // 'application/json'
 * ```
 */
export function getMimeType(extension: string): string {
  return findMimeType(extension).unwrapOrElse(() => {
    throw new Error(`MIME type not found for extension: ${extension}`);
  });
}

/**
 * Checks if a file extension is valid and has an associated MIME type.
 *
 * @param extension - The file extension to validate (must start with a dot, e.g., ".pdf")
 * @returns true if the extension is valid and has an associated MIME type, false otherwise
 *
 * @example
 * ```typescript
 * isValidExtension('.pdf')  // true
 * isValidExtension('.xyz')  // false
 * isValidExtension('pdf')   // false
 * ```
 */
export function isValidExtension(extension: string): boolean {
  return findMimeType(extension).isSome();
}

/**
 * Extracts the file extension from a given filename.
 *
 * @param filename - The name of the file (e.g., "document.pdf")
 * @returns The file extension including the dot (e.g., ".pdf"), or an empty string if no extension is found
 *
 * @example
 * ```typescript
 * getFileExtension('document.pdf') // '.pdf'
 * getFileExtension('archive.tar.gz') // '.gz'
 * getFileExtension('file_without_extension') // ''
 * ```
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return '';
  }
  return filename.slice(lastDotIndex);
}

/**
 * Converts an ArrayBuffer to a Base64-encoded string.
 *
 * @param fileBuffer - The ArrayBuffer to convert
 * @returns A Base64-encoded string representation of the input buffer
 *
 * @example
 * ```typescript
 * const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello"
 * const base64String = arrayBufferToBase64(buffer); // "SGVsbG8="
 * ```
 */
export function arrayBufferToBase64(fileBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(fileBuffer);

  // Node.js or browser with polyfilled Buffer
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  // Browser-safe fallback (no Buffer available)
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
}
