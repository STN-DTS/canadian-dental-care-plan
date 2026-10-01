import { describe, expect, it, vi } from 'vitest';

import { arrayBufferToBase64, base64ToArrayBuffer, detectEicarContent, findDuplicateFile, findMimeType, getFileExtension, getMimeType, hashFile, hashFileBuffer, hashFiles, isFileContentTypeAllowed, isValidExtension } from '~/utils/file-utils';

const eicarString = String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;

describe('file-utils', () => {
  describe('hashFileBuffer', () => {
    it('should return lowercase hexadecimal SHA-256 digest', async () => {
      const fileBuffer = new TextEncoder().encode('abc').buffer;

      await expect(hashFileBuffer(fileBuffer)).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
  });

  describe('hashFile', () => {
    it('should preserve file reference and include content hash', async () => {
      const file = new File(['abc'], 'document.txt');

      await expect(hashFile(file)).resolves.toEqual({
        file,
        hash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      });
    });
  });

  describe('hashFiles', () => {
    it('should hash every file in input order', async () => {
      const firstFile = new File(['abc'], 'first.txt');
      const secondFile = new File(['def'], 'second.txt');

      const hashedFiles = await hashFiles([firstFile, secondFile]);

      expect(hashedFiles.map(({ file }) => file)).toEqual([firstFile, secondFile]);
      expect(hashedFiles.map(({ hash }) => hash)).toEqual(['ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'cb8379ac2098aa165029e3938a51da0bcecfc008fd6795f401178647f96c5b34']);
    });
  });

  describe('findDuplicateFile', () => {
    it('should return later file when name, size, and content match', async () => {
      const originalFile = new File(['same content'], 'document.txt');
      const duplicateFile = new File(['same content'], 'document.txt');

      await expect(findDuplicateFile([originalFile, duplicateFile])).resolves.toBe(duplicateFile);
    });

    it('should return undefined when matching metadata has different content', async () => {
      const firstFile = new File(['first'], 'document.txt');
      const secondFile = new File(['other'], 'document.txt');

      await expect(findDuplicateFile([firstFile, secondFile])).resolves.toBeUndefined();
    });

    it('should return undefined when matching content has different metadata', async () => {
      const firstFile = new File(['same content'], 'first.txt');
      const secondFile = new File(['same content'], 'second.txt');

      await expect(findDuplicateFile([firstFile, secondFile])).resolves.toBeUndefined();
    });

    it('should return undefined for empty input', async () => {
      await expect(findDuplicateFile([])).resolves.toBeUndefined();
    });
  });

  describe('isFileContentTypeAllowed', () => {
    it('should allow detected RTF content when the extension is allowed', async () => {
      const file = new File([String.raw`{\rtf1\ansi Test document}`], 'document.rtf', { type: 'application/rtf' });
      const fileBuffer = await file.arrayBuffer();

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.rtf'], declaredMimeType: file.type, fileBuffer })).resolves.toBe(true);
    });

    it('should reject detected content when its MIME type is not allowed', async () => {
      const file = new File([String.raw`{\rtf1\ansi Test document}`], 'document.rtf', { type: 'application/rtf' });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.pdf'], file })).resolves.toBe(false);
    });

    it('should allow undetected content declared as text/plain', async () => {
      const file = new File(['Plain text document'], 'document.txt', { type: 'text/plain' });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.pdf'], file })).resolves.toBe(true);
    });

    it('should reject undetected content not declared as text/plain', async () => {
      const file = new File(['Unknown content'], 'document.pdf', { type: 'application/pdf' });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.pdf'], file })).resolves.toBe(false);
    });
  });

  describe('detectEicarContent', () => {
    it('should detect the exact EICAR signature in an ArrayBuffer', () => {
      expect(detectEicarContent(new TextEncoder().encode(eicarString).buffer)).toBe(true);
    });

    it('should detect EICAR content from a File', async () => {
      const file = new File([eicarString], 'document.txt');

      await expect(detectEicarContent(file)).resolves.toBe(true);
    });

    it('should reject invalid content even when the filename looks like EICAR', async () => {
      const file = new File(['not the EICAR signature'], 'eicar.com');

      await expect(detectEicarContent(file)).resolves.toBe(false);
    });

    it('should reject an oversized File without reading its content', async () => {
      const file = new File(['x'.repeat(129)], 'document.txt');
      const arrayBuffer = vi.spyOn(file, 'arrayBuffer');

      await expect(detectEicarContent(file)).resolves.toBe(false);
      expect(arrayBuffer).not.toHaveBeenCalled();
    });

    it('should allow only the official trailing whitespace characters', () => {
      expect(detectEicarContent(new TextEncoder().encode(`${eicarString} \t\n\r\x1a`).buffer)).toBe(true);
      expect(detectEicarContent(new TextEncoder().encode(`${eicarString}\u00a0`).buffer)).toBe(false);
      expect(detectEicarContent(new TextEncoder().encode(`${eicarString}0`).buffer)).toBe(false);
    });

    it('should reject content that does not start with the signature', () => {
      expect(detectEicarContent(new TextEncoder().encode(` ${eicarString}`).buffer)).toBe(false);
      expect(detectEicarContent(new TextEncoder().encode(eicarString.replace('EICAR', 'eicar')).buffer)).toBe(false);
    });

    it('should enforce the 128-byte maximum', () => {
      expect(detectEicarContent(new TextEncoder().encode(`${eicarString}${' '.repeat(128 - eicarString.length)}`).buffer)).toBe(true);
      expect(detectEicarContent(new TextEncoder().encode(`${eicarString}${' '.repeat(129 - eicarString.length)}`).buffer)).toBe(false);
    });

    it('should reject empty content', () => {
      expect(detectEicarContent(new ArrayBuffer(0))).toBe(false);
    });
  });

  describe('base64ToArrayBuffer', () => {
    it('should decode valid Base64 content', () => {
      const fileBuffer = base64ToArrayBuffer('SGVsbG8=');

      expect(fileBuffer).toBeDefined();
      expect(new TextDecoder().decode(fileBuffer)).toBe('Hello');
    });

    it('should return undefined for invalid Base64 content', () => {
      expect(base64ToArrayBuffer('not valid Base64*')).toBeUndefined();
    });
  });

  describe('findMimeType', () => {
    it('should return Some with MIME type for valid extension', () => {
      const result = findMimeType('.pdf');
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe('application/pdf');
    });

    it('should return Some with MIME type for .json extension', () => {
      const result = findMimeType('.json');
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe('application/json');
    });

    it('should return None for extension without leading dot', () => {
      const result = findMimeType('pdf');
      expect(result.isNone()).toBe(true);
    });

    it('should return None for unknown extension', () => {
      const result = findMimeType('.asdf');
      expect(result.isNone()).toBe(true);
    });

    it('should return None for empty string', () => {
      const result = findMimeType('');
      expect(result.isNone()).toBe(true);
    });
  });

  describe('getMimeType', () => {
    it('should return MIME type for valid extension', () => {
      expect(getMimeType('.pdf')).toBe('application/pdf');
    });

    it('should return MIME type for .json extension', () => {
      expect(getMimeType('.json')).toBe('application/json');
    });

    it('should throw error for extension without leading dot', () => {
      expect(() => getMimeType('pdf')).toThrow('MIME type not found for extension: pdf');
    });

    it('should throw error for unknown extension', () => {
      expect(() => getMimeType('.asdf')).toThrow('MIME type not found for extension: .asdf');
    });
  });

  describe('isValidExtension', () => {
    it('should return true for valid extension', () => {
      expect(isValidExtension('.pdf')).toBe(true);
    });

    it('should return true for .json extension', () => {
      expect(isValidExtension('.json')).toBe(true);
    });

    it('should return false for extension without leading dot', () => {
      expect(isValidExtension('pdf')).toBe(false);
    });

    it('should return false for unknown extension', () => {
      expect(isValidExtension('.asdf')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidExtension('')).toBe(false);
    });
  });
});

describe('getFileExtension', () => {
  it('should return the correct file extension for a simple filename', () => {
    expect(getFileExtension('document.pdf')).toBe('.pdf');
  });

  it('should return the correct file extension for a filename with multiple dots', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('.gz');
  });

  it('should return an empty string for a filename without an extension', () => {
    expect(getFileExtension('file_without_extension')).toBe('');
  });

  it('should return the correct file extension for hidden files', () => {
    expect(getFileExtension('.env')).toBe('');
    expect(getFileExtension('.env.local')).toBe('.local');
  });

  it('should return an empty string for an empty filename', () => {
    expect(getFileExtension('')).toBe('');
  });
});

describe('arrayBufferToBase64', () => {
  it('should convert an ArrayBuffer to a Base64 string', () => {
    const str = 'Hello, World!';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(str).buffer;

    const base64 = arrayBufferToBase64(buffer);
    expect(base64).toBe('SGVsbG8sIFdvcmxkIQ==');
  });

  it('should handle an empty ArrayBuffer', () => {
    const buffer = new ArrayBuffer(0);
    const base64 = arrayBufferToBase64(buffer);
    expect(base64).toBe('');
  });
});
