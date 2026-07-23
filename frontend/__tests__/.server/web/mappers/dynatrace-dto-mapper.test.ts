import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { DefaultDynatraceDtoMapper } from '~/.server/web/mappers';

describe('DefaultDynatraceDtoMapper', () => {
  let mapper: DefaultDynatraceDtoMapper;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    mockLogger = mock<Logger>();
    vi.mocked(createLogger).mockReturnValueOnce(mockLogger);
    mapper = new DefaultDynatraceDtoMapper();
  });

  it('should map valid XML with correct script attributes', () => {
    const validXml = '<script src="/app.js" data-dtconfig="some-config"></script>';
    const result = mapper.mapDynatraceRumScriptToDynatraceRumScriptDto(validXml);

    expect(result).toEqual({ src: '/app.js', 'data-dtconfig': 'some-config' });
  });

  it('should throw error when src attribute is invalid', () => {
    const invalidXml = '<script src="invalid.js" data-dtconfig="some-config"></script>';

    expect(() => mapper.mapDynatraceRumScriptToDynatraceRumScriptDto(invalidXml)).toThrow('Mapping validation failed for Dynatrace RUM Script');
  });

  it('should throw error when data-dtconfig attribute is missing', () => {
    const invalidXml = '<script src="/app.js"></script>';

    expect(() => mapper.mapDynatraceRumScriptToDynatraceRumScriptDto(invalidXml)).toThrow('Mapping validation failed for Dynatrace RUM Script');
  });

  it('should throw error when src attribute is missing', () => {
    const invalidXml = '<script data-dtconfig="some-config"></script>';

    expect(() => mapper.mapDynatraceRumScriptToDynatraceRumScriptDto(invalidXml)).toThrow('Mapping validation failed for Dynatrace RUM Script');
  });

  it('should map XML with src containing underscores', () => {
    const validXml = '<script src="/my_app.js" data-dtconfig="config"></script>';
    const result = mapper.mapDynatraceRumScriptToDynatraceRumScriptDto(validXml);

    expect(result).toEqual({ src: '/my_app.js', 'data-dtconfig': 'config' });
  });

  it('should throw error when src does not start with forward slash', () => {
    const invalidXml = '<script src="app.js" data-dtconfig="config"></script>';

    expect(() => mapper.mapDynatraceRumScriptToDynatraceRumScriptDto(invalidXml)).toThrow();
  });
});
