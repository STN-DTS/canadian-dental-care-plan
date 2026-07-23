import { describe, expect, it } from 'vitest';

import { arrayBufferToBase64, findMimeType, getFileExtension, getMimeType, isValidExtension } from '~/utils/file-utils';

describe('file-utils', () => {
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
