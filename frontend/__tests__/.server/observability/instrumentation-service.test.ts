import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import { mock } from 'vitest-mock-extended';

import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { DefaultInstrumentationService } from '~/.server/observability/instrumentation-service';

describe('DefaultInstrumentationService', () => {
  let service: DefaultInstrumentationService;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    mockLogger = mock<Logger>();
    vi.mocked(createLogger).mockReturnValueOnce(mockLogger);

    service = new DefaultInstrumentationService({ OTEL_SERVICE_NAME: 'test-service' }, { getBuildInfo: vi.fn().mockReturnValue({ buildVersion: '1.0.0' }) });

    // Reset the mock before each test
    vi.clearAllMocks();
  });

  describe('sanitizeMetricName', () => {
    it('should return the original name if it is valid', () => {
      const validName = 'valid.metric.name';
      expect(service['sanitizeMetricName'](validName)).toBe(validName);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should replace invalid characters with underscore', () => {
      const invalidCharsName = 'name with spaces!';
      expect(service['sanitizeMetricName'](invalidCharsName)).toBe('name_with_spaces_');
      expect(mockLogger.warn).toHaveBeenCalledWith(`Invalid metric name "${invalidCharsName}". Sanitized to "name_with_spaces_"`);
    });

    it('should strip leading non-letter characters', () => {
      const leadingInvalidName = '123invalid';
      expect(service['sanitizeMetricName'](leadingInvalidName)).toBe('invalid');
      expect(mockLogger.warn).toHaveBeenCalledWith(`Invalid metric name "${leadingInvalidName}". Sanitized to "invalid"`);
    });

    it('should truncate the name to 255 characters', () => {
      const longName = 'a'.repeat(300);
      const truncatedName = 'a'.repeat(255);
      expect(service['sanitizeMetricName'](longName)).toBe(truncatedName);
      expect(mockLogger.warn).toHaveBeenCalledWith(`Invalid metric name "${longName}". Sanitized to "${truncatedName}"`);
    });

    it('should handle a combination of invalid characters', () => {
      const complexInvalidName = '  $Invalid Name with#SpecialChars  ';
      expect(service['sanitizeMetricName'](complexInvalidName)).toBe('Invalid_Name_with_SpecialChars__');
      expect(mockLogger.warn).toHaveBeenCalledWith(`Invalid metric name "${complexInvalidName}". Sanitized to "Invalid_Name_with_SpecialChars__"`);
    });

    it('should handle leading and trailing invalid characters', () => {
      const leadingTrailingInvalid = '!!!test_name!!!';
      expect(service['sanitizeMetricName'](leadingTrailingInvalid)).toBe('test_name___');
      expect(mockLogger.warn).toHaveBeenCalledWith(`Invalid metric name "${leadingTrailingInvalid}". Sanitized to "test_name___"`);
    });
  });
});
