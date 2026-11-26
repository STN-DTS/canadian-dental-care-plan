import { Option } from 'effect';
import { fileTypeFromBlob } from 'file-type';
import mime from 'mime';

type IsFileContentTypeAllowedArgs = {
  readonly allowedExtensions: readonly string[];
  readonly file: File;
};

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
 * equal the MIME type registered for that extension. When signature detection returns no
 * type, the file is allowed only when its extension maps to `text/plain` and its declared
 * MIME type is `text/plain`.
 *
 * @param args - Allowed extensions and file to inspect
 * @returns Whether the content matches the expected MIME type for the file's allowed extension
 * @throws {Error} When the file's allowed extension has no registered MIME type
 */
export async function isFileContentTypeAllowed({ allowedExtensions, file }: IsFileContentTypeAllowedArgs): Promise<boolean> {
  const fileExtension = getFileExtension(file.name).toLowerCase();
  const normalizedAllowedExtensions = new Set(allowedExtensions.map((extension) => extension.toLowerCase()));

  if (!normalizedAllowedExtensions.has(fileExtension)) {
    return false;
  }

  const expectedMimeType = getMimeType(fileExtension);
  const detectedFileType = await fileTypeFromBlob(file);

  // Plain text has no detectable signature, so fall back to its declared MIME type only for plain-text extensions.
  if (!detectedFileType) {
    return expectedMimeType === 'text/plain' && file.type === 'text/plain';
  }

  return detectedFileType.mime === expectedMimeType;
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
