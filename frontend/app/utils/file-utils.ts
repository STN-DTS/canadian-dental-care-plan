import { Option } from 'effect';
import mime from 'mime';

type IsFileContentTypeAllowedArgs = {
  readonly allowedExtensions: readonly string[];
  readonly file: File;
};

/**
 * Binary formats whose `file-type` signatures are 2-3 printable ASCII characters
 * (`"BM"` for BMP, `"GIF"` for GIF, `"MZ"` for Windows PE executables) and can
 * false-positive on legitimate plain-text `.txt` files (e.g. `"BMO..."` or `"GIFT..."`).
 *
 * When validating a `.txt` file, these detections fall through to stricter header and
 * plain-text byte checks instead of being rejected on prefix alone.
 */
const shortAsciiBinaryMimeTypes = new Set(['image/bmp', 'image/gif', 'application/x-msdownload']);

/**
 * Declared MIME essences accepted for plain-text `.txt` files.
 *
 * Browsers or OSes without a `.txt` MIME mapping may supply `""`, which multipart
 * `FormData` serializes as `application/octet-stream` on the server. Actual file bytes
 * are still verified as valid UTF-8 or Windows-1252 text without binary control
 * characters, while explicit mismatched declared types (e.g. `application/pdf`,
 * `text/html`) are rejected.
 */
const allowedPlainTextDeclaredMimeTypes = new Set(['', 'text/plain', 'application/octet-stream']);

/**
 * Undefined byte slots in Windows-1252.
 *
 * Used only as a fallback when a `.txt` file is not valid UTF-8 (for example, French
 * documents saved as Windows-1252 / ANSI from Microsoft Word or legacy Notepad).
 * Valid UTF-8 is checked first because these byte values can appear as UTF-8 continuation bytes.
 */
const undefinedWindows1252Bytes = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

/**
 * Reusable fatal UTF-8 decoder for verifying plain-text byte payloads.
 */
const utf8FatalDecoder = new TextDecoder('utf-8', { fatal: true });

/**
 * EICAR test string used for antivirus testing.
 */
const eicarString = String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;

/**
 * Encodes the EICAR test string into a byte array.
 */
const eicarBytes = new TextEncoder().encode(eicarString);

/**
 * EICAR test string may have certain allowed trailing characters.
 */
const eicarAllowedTrailingCharacters = new Set([' ', '\t', '\n', '\r', String.fromCharCode(0x1a)]);

export interface HashedFile {
  readonly file: File;
  readonly hash: string;
}

/**
 * Computes SHA-256 hash while preserving file reference.
 *
 * @param file - File whose contents will be hashed.
 * @returns File paired with its lowercase hexadecimal SHA-256 hash.
 */
export async function hashFile(file: File): Promise<HashedFile> {
  return {
    file,
    hash: await hashFileBuffer(await file.arrayBuffer()),
  };
}

/**
 * Computes SHA-256 hashes while preserving each file reference.
 *
 * @param files - Files whose contents will be hashed.
 * @returns Files paired with their lowercase hexadecimal SHA-256 hashes.
 */
export async function hashFiles(files: ReadonlyArray<File>): Promise<ReadonlyArray<HashedFile>> {
  return await Promise.all(files.map(hashFile));
}

/**
 * Computes SHA-256 digest for a file buffer.
 *
 * @param fileBuffer - File contents to hash.
 * @returns Lowercase hexadecimal SHA-256 digest.
 */
export async function hashFileBuffer(fileBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
  return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Finds first file whose name, size, and SHA-256 hash match an earlier file.
 *
 * @param files - Files to inspect for duplicate content.
 * @returns Duplicate file, or `undefined` when every file is unique.
 */
export async function findDuplicateFile(files: ReadonlyArray<File>): Promise<File | undefined> {
  const candidateGroups = groupPotentialDuplicateFiles(files);
  const hashedFileGroups = await Promise.all(candidateGroups.map(hashFiles));

  for (const hashedFiles of hashedFileGroups) {
    const duplicateFile = findDuplicateByHash(hashedFiles);

    if (duplicateFile) {
      return duplicateFile;
    }
  }
}

/**
 * Groups files by metadata that can identify possible duplicates without reading file contents.
 *
 * @param files - Files to group by name and size.
 * @returns Groups containing at least two files with matching metadata.
 */
function groupPotentialDuplicateFiles(files: ReadonlyArray<File>): ReadonlyArray<ReadonlyArray<File>> {
  const filesByMetadata = new Map<string, File[]>();

  for (const file of files) {
    const metadataKey = JSON.stringify([file.name, file.size]);
    const matchingFiles = filesByMetadata.get(metadataKey);

    if (matchingFiles) {
      matchingFiles.push(file);
    } else {
      filesByMetadata.set(metadataKey, [file]);
    }
  }

  return [...filesByMetadata.values()].filter((matchingFiles) => matchingFiles.length > 1);
}

/**
 * Finds first file whose hash matches an earlier file in same metadata group.
 *
 * @param hashedFiles - Files and hashes from one metadata group.
 * @returns Duplicate file, or `undefined` when all hashes are unique.
 */
function findDuplicateByHash(hashedFiles: ReadonlyArray<HashedFile>): File | undefined {
  const seenHashes = new Set<string>();

  for (const { file, hash } of hashedFiles) {
    if (seenHashes.has(hash)) {
      return file;
    }

    seenHashes.add(hash);
  }
}

/**
 * Validates that a file's detected content matches the MIME type of its own allowed extension.
 *
 * The file extension must appear in `allowedExtensions`, and any detected MIME type must
 * equal the MIME type registered for that extension.
 *
 * Plain-text extensions (`text/plain`) have no magic-byte header, so they are validated by:
 * 1. Rejecting any non-colliding signature detected by `file-type` (e.g. PDF, PNG, RTF, ICS,
 *    XML, ELF, Mach-O) as well as genuine `GIF87a`/`GIF89a` headers.
 * 2. Allowing short ASCII-prefix false positives (`"BM"`, `"GIF"`, `"MZ"`) and undetected
 *    files to pass only when the declared MIME essence is compatible and the raw bytes are
 *    valid UTF-8 or Windows-1252 text without NUL or non-whitespace binary control characters.
 *
 * `file-type` is dynamically imported so `file-utils` (shared with `env-utils` in the root
 * client bundle) does not pull the binary-signature parser into non-upload routes.
 *
 * @param args - Allowed extensions and file to inspect
 * @returns Whether the content matches the expected MIME type for the file's allowed extension
 * @throws {Error} When the file's allowed extension has no registered MIME type
 */
export async function isFileContentTypeAllowed({ allowedExtensions, file }: IsFileContentTypeAllowedArgs): Promise<boolean> {
  if (file.size === 0) {
    return false;
  }

  const fileExtension = getFileExtension(file.name).toLowerCase();
  const normalizedAllowedExtensions = new Set(allowedExtensions.map((extension) => extension.toLowerCase()));

  if (!normalizedAllowedExtensions.has(fileExtension)) {
    return false;
  }

  const expectedMimeType = getMimeType(fileExtension);
  const { fileTypeFromBlob } = await import('file-type');
  const detectedFileType = await fileTypeFromBlob(file);

  if (expectedMimeType === 'text/plain') {
    return await isValidPlainTextContent(file, detectedFileType?.mime);
  }

  return detectedFileType?.mime === expectedMimeType;
}

/**
 * Verifies that a `.txt` candidate is genuinely plain text (UTF-8 or Windows-1252) rather
 * than a mislabeled binary or structured file.
 *
 * Rejects any `file-type` detection other than the short ASCII binary prefixes (`"BM"`,
 * `"GIF"`, `"MZ"`), rejects genuine `GIF87a`/`GIF89a` headers, rejects incompatible explicit
 * declared MIME types, and requires valid UTF-8 or Windows-1252 bytes without NUL or binary
 * control bytes.
 */
async function isValidPlainTextContent(file: File, detectedMimeType?: string): Promise<boolean> {
  if (detectedMimeType !== undefined && !shortAsciiBinaryMimeTypes.has(detectedMimeType)) {
    return false;
  }

  const declaredMimeType = file.type.split(';')[0]?.trim().toLowerCase() ?? '';

  if (!allowedPlainTextDeclaredMimeTypes.has(declaredMimeType)) {
    return false;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (detectedMimeType === 'image/gif' && hasGifVersionHeader(bytes)) {
    return false;
  }

  return isValidPlainTextBytes(bytes);
}

/**
 * Checks whether bytes begin with a genuine GIF87a or GIF89a header (after an optional UTF-8 BOM).
 */
function hasGifVersionHeader(bytes: Uint8Array): boolean {
  const offset = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;

  if (bytes.length < offset + 6) {
    return false;
  }

  const prefix = String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!, bytes[offset + 4]!, bytes[offset + 5]!);

  return prefix === 'GIF87a' || prefix === 'GIF89a';
}

/**
 * Checks that raw bytes contain no NUL or non-whitespace binary control characters
 * (allowing tab, LF, CR, and printable characters) and decode as valid UTF-8 or
 * Windows-1252 / ISO-8859-1 text (supporting French documents saved from Windows tools).
 */
function isValidPlainTextBytes(bytes: Uint8Array): boolean {
  for (const byte of bytes) {
    if ((byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) || byte === 0x7f) {
      return false;
    }
  }

  try {
    utf8FatalDecoder.decode(bytes);
    return true;
  } catch {
    return bytes.every((byte) => !undefinedWindows1252Bytes.has(byte));
  }
}

/**
 * Detects the EICAR test signature in a File.
 *
 * @param fileOrBuffer - File containing content to inspect.
 * @returns Promise resolving to true when content matches EICAR; otherwise false.
 */
export function detectEicarContent(fileOrBuffer: File): Promise<boolean>;

/**
 * Detects the EICAR test signature in an ArrayBuffer.
 *
 * Checks raw bytes directly and allows only official EICAR trailing characters.
 *
 * @param fileOrBuffer - ArrayBuffer containing content to inspect.
 * @returns true when content matches EICAR; otherwise false.
 */
export function detectEicarContent(fileOrBuffer: ArrayBuffer): boolean;

/**
 * Detects the EICAR test signature in a File or ArrayBuffer.
 *
 * Reads File content as an ArrayBuffer, then checks raw bytes.
 *
 * @param fileOrBuffer - File or ArrayBuffer containing content to inspect.
 * @returns Promise resolving to detection result for a File; boolean result for an ArrayBuffer.
 */
export function detectEicarContent(fileOrBuffer: ArrayBuffer | File): boolean | Promise<boolean> {
  if (fileOrBuffer instanceof File) {
    if (fileOrBuffer.size > 128) {
      return Promise.resolve(false);
    }

    return fileOrBuffer.arrayBuffer().then(detectEicarContent);
  }

  const fileBytes = new Uint8Array(fileOrBuffer);

  // Reject files that are too large or too small to be the EICAR test file.
  if (fileBytes.length > 128 || fileBytes.length < eicarBytes.length) {
    return false;
  }

  // Check each byte against the EICAR signature
  for (let index = 0; index < eicarBytes.length; index += 1) {
    if (fileBytes[index] !== eicarBytes[index]) {
      return false;
    }
  }

  // Check trailing characters after the EICAR signature
  for (const byte of fileBytes.slice(eicarBytes.length)) {
    if (!eicarAllowedTrailingCharacters.has(String.fromCharCode(byte))) {
      return false;
    }
  }

  return true;
}

/**
 * Decodes a standard Base64 string into an ArrayBuffer.
 *
 * @param base64Content - Standard Base64 content without whitespace.
 * @returns Decoded bytes, or undefined when content is invalid Base64.
 */
export function base64ToArrayBuffer(base64Content: string): ArrayBuffer | undefined {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64Content)) {
    return undefined;
  }

  try {
    const isNode = typeof Buffer !== 'undefined';
    const bytes = isNode //
      ? Uint8Array.from(Buffer.from(base64Content, 'base64'))
      : Uint8Array.from(atob(base64Content), (character) => character.codePointAt(0) ?? 0);
    return bytes.buffer;
  } catch {
    return undefined;
  }
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
export function findMimeType(extension: string): Option.Option<string> {
  if (!extension.startsWith('.')) {
    return Option.none();
  }

  return Option.fromNullishOr(mime.getType(extension));
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
  return Option.getOrElse(findMimeType(extension), () => {
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
  return Option.isSome(findMimeType(extension));
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
