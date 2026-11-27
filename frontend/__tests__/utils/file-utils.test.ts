import { Option } from 'effect';
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
    const rtfContent = String.raw`{\rtf1\ansi Test document}`;
    const pdfBytes = new TextEncoder().encode('%PDF-1.4\n%EOF\n');
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde]);
    const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x3b]);
    const bmpBytes = new Uint8Array([0x42, 0x4d, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00, 0x00, 0x00]);
    const tiffBytes = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const peExeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
    const elfBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);

    it.each([
      { name: 'document.pdf', type: 'application/pdf', content: pdfBytes, ext: '.pdf' },
      { name: 'document.rtf', type: 'application/rtf', content: rtfContent, ext: '.rtf' },
      { name: 'image.png', type: 'image/png', content: pngBytes, ext: '.png' },
      { name: 'image.gif', type: 'image/gif', content: gifBytes, ext: '.gif' },
      { name: 'image.bmp', type: 'image/bmp', content: bmpBytes, ext: '.bmp' },
      { name: 'scan.tif', type: 'image/tiff', content: tiffBytes, ext: '.tif' },
      { name: 'scan.tiff', type: 'image/tiff', content: tiffBytes, ext: '.tiff' },
    ])('should allow detected $ext content when its extension is allowed and matches', async ({ name, type, content, ext }) => {
      const file = new File([content], name, { type });

      await expect(isFileContentTypeAllowed({ allowedExtensions: [ext], file })).resolves.toBe(true);
    });

    it('should allow alias extensions and uppercase filenames sharing the same MIME type', async () => {
      const jpgFile = new File([jpegBytes], 'photo.jpg', { type: 'image/jpeg' });
      const jpegFile = new File([jpegBytes], 'photo.jpeg', { type: 'image/jpeg' });
      const uppercaseJpgFile = new File([jpegBytes], 'PHOTO.JPG', { type: 'image/jpeg' });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.jpg', '.jpeg'], file: jpgFile })).resolves.toBe(true);
      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.jpg', '.jpeg'], file: jpegFile })).resolves.toBe(true);
      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.jpg', '.jpeg'], file: uppercaseJpgFile })).resolves.toBe(true);
    });

    it('should reject detected content whose extension is not allowed', async () => {
      const file = new File([rtfContent], 'document.rtf', { type: 'application/rtf' });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.pdf'], file })).resolves.toBe(false);
    });

    it('should reject detected content from another allowed type when renamed to a different allowed extension', async () => {
      const file = new File([rtfContent], 'document.pdf', { type: 'application/pdf' });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.pdf', '.rtf'], file })).resolves.toBe(false);
    });

    it.each(['text/plain', 'text/plain;charset=utf-8', 'TEXT/PLAIN; charset=UTF-8', '', 'application/octet-stream'])('should allow valid UTF-8 .txt content with declared type %j when .txt is allowed', async (type) => {
      const file = new File(["Á Vérification d'admissibilité\r\nLine 2\tOK"], 'document.txt', { type });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.txt'], file })).resolves.toBe(true);
    });

    it('should allow French Windows-1252 .txt content (e.g. saved from Word or legacy Notepad)', async () => {
      // "Régime — 100 €" encoded in Windows-1252
      const win1252Bytes = new Uint8Array([0x52, 0xe9, 0x67, 0x69, 0x6d, 0x65, 0x20, 0x97, 0x20, 0x31, 0x30, 0x30, 0x20, 0x80]);
      const file = new File([win1252Bytes], 'attestation.txt', { type: 'text/plain' });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.txt'], file })).resolves.toBe(true);
    });

    it.each([
      { label: 'BM prefix (e.g. BMO)', content: 'BMO Bank Statement\nAccount: 12345' },
      { label: 'UTF-8 BOM + BM prefix', content: new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('BMO Insurance Letter')]) },
      { label: 'GIF prefix (e.g. GIFT)', content: 'GIFT letter from pension plan' },
      { label: 'MZ prefix', content: 'MZ employee confirmation letter' },
      { label: 'EICAR plain-text signature', content: eicarString },
    ])('should allow legitimate .txt files with $label instead of false-rejecting as binary', async ({ content }) => {
      const file = new File([content], 'letter.txt', { type: 'text/plain' });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.txt', '.bmp', '.gif'], file })).resolves.toBe(true);
    });

    it.each([
      { label: 'real BMP image', content: bmpBytes },
      { label: 'real GIF89a image', content: gifBytes },
      { label: 'UTF-8 BOM + GIF89a header', content: new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('GIF89a fake header text')]) },
      { label: 'text starting with GIF87a header', content: 'GIF87a fake header text' },
      { label: 'real Windows PE executable', content: peExeBytes },
      { label: 'real ELF executable', content: elfBytes },
      { label: 'iCalendar document', content: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR' },
      { label: 'RTF document', content: rtfContent },
      { label: 'PDF document', content: pdfBytes },
      { label: 'unknown binary with NUL byte', content: new Uint8Array([0x48, 0x65, 0x6c, 0x00, 0x6f]) },
      { label: 'binary containing DEL (0x7F) control byte', content: new Uint8Array([0x48, 0x65, 0x7f, 0x6c, 0x6f]) },
      { label: 'invalid UTF-8 and undefined Windows-1252 bytes', content: new Uint8Array([0x80, 0x81, 0xfe, 0xff]) },
    ])('should reject $label renamed to .txt even when declared as text/plain', async ({ content }) => {
      const file = new File([content], 'disallowed.txt', { type: 'text/plain' });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.txt', '.bmp', '.gif', '.pdf', '.rtf'], file })).resolves.toBe(false);
    });

    it('should reject .txt files with an explicit non-text declared MIME type or when .txt is not allowed', async () => {
      const txtFile = new File(['Plain text document'], 'document.txt', { type: 'text/plain' });
      const htmlDeclaredTxtFile = new File(['Plain text document'], 'document.txt', { type: 'text/html' });
      const renamedPdfFile = new File(['Plain text document'], 'document.pdf', { type: 'text/plain' });

      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.pdf'], file: txtFile })).resolves.toBe(false);
      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.txt'], file: htmlDeclaredTxtFile })).resolves.toBe(false);
      await expect(isFileContentTypeAllowed({ allowedExtensions: ['.pdf', '.txt'], file: renamedPdfFile })).resolves.toBe(false);
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
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result)).toBe('application/pdf');
    });

    it('should return Some with MIME type for .json extension', () => {
      const result = findMimeType('.json');
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result)).toBe('application/json');
    });

    it('should return None for extension without leading dot', () => {
      const result = findMimeType('pdf');
      expect(Option.isNone(result)).toBe(true);
    });

    it('should return None for unknown extension', () => {
      const result = findMimeType('.asdf');
      expect(Option.isNone(result)).toBe(true);
    });

    it('should return None for empty string', () => {
      const result = findMimeType('');
      expect(Option.isNone(result)).toBe(true);
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
