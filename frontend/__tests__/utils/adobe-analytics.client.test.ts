import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isConfigured, pushErrorEvent, pushFormSubmitEvent, pushPageviewEvent, pushValidationErrorEvent } from '~/utils/adobe-analytics.client';
import { getClientEnv } from '~/utils/env-utils';

/*
 * @vitest-environment jsdom
 */

vi.mock('~/utils/env-utils');

describe('isConfigured', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return true if all necessary environment variables are present and are valid URLs', () => {
    vi.mocked(getClientEnv, { partial: true }).mockReturnValue({
      ADOBE_ANALYTICS_JQUERY_SRC: 'https://example.com/jquery.min.js',
      ADOBE_ANALYTICS_SRC: 'https://example.com/adobe-analytics.min.js',
    });
    const result = isConfigured();
    expect(result).toBe(true);
  });

  it('should return false if ADOBE_ANALYTICS_SRC is missing', () => {
    vi.mocked(getClientEnv, { partial: true }).mockReturnValue({
      ADOBE_ANALYTICS_JQUERY_SRC: 'https://example.com/jquery.min.js',
    });
    const result = isConfigured();
    expect(result).toBe(false);
  });

  it('should return false if ADOBE_ANALYTICS_JQUERY_SRC is not a valid URL', () => {
    vi.mocked(getClientEnv, { partial: true }).mockReturnValue({
      ADOBE_ANALYTICS_JQUERY_SRC: 'invalid-url',
      ADOBE_ANALYTICS_SRC: 'https://example.com/adobe-analytics.min.js',
    });
    const result = isConfigured();
    expect(result).toBe(false);
  });

  it('should return false if ADOBE_ANALYTICS_SRC is not a valid URL', () => {
    vi.mocked(getClientEnv, { partial: true }).mockReturnValue({
      ADOBE_ANALYTICS_JQUERY_SRC: 'https://example.com/jquery.min.js',
      ADOBE_ANALYTICS_SRC: 'invalid-url',
    });
    const result = isConfigured();
    expect(result).toBe(false);
  });
});

describe('pushErrorEvent', () => {
  const originalAdobeDataLayer = window.adobeDataLayer;

  beforeEach(() => {
    vi.mocked(getClientEnv, { partial: true }).mockReturnValue({
      ADOBE_ANALYTICS_JQUERY_SRC: 'https://example.com/jquery.min.js',
      ADOBE_ANALYTICS_SRC: 'https://example.com/adobe-analytics.min.js',
    });
  });

  afterEach(() => {
    window.adobeDataLayer = originalAdobeDataLayer;
    vi.resetAllMocks();
  });

  it('does not send an event if window.adobeDataLayer is not defined', () => {
    const spyConsoleWarnSpy = vi.spyOn(console, 'warn').mockImplementationOnce(() => {});

    pushErrorEvent(404);

    expect(spyConsoleWarnSpy).toHaveBeenCalledWith('window.adobeDataLayer is not defined. This could mean your adobe analytics script has not loaded on the page yet.');
  });

  it('sends a pushErrorEvent event with the correct pushErrorEvent status code', () => {
    window.adobeDataLayer = { push: vi.fn() };

    pushErrorEvent(404);

    expect(window.adobeDataLayer.push).toHaveBeenCalledWith({
      event: 'error',
      error: { name: '404' },
    });
  });
});

describe('pushPageviewEvent', () => {
  const originalAdobeDataLayer = window.adobeDataLayer;

  beforeEach(() => {
    vi.mocked(getClientEnv, { partial: true }).mockReturnValue({
      ADOBE_ANALYTICS_JQUERY_SRC: 'https://example.com/jquery.min.js',
      ADOBE_ANALYTICS_SRC: 'https://example.com/adobe-analytics.min.js',
    });
  });

  afterEach(() => {
    window.adobeDataLayer = originalAdobeDataLayer;
    vi.resetAllMocks();
  });

  it('does not send an event if window.adobeDataLayer is not defined', () => {
    const spyConsoleWarnSpy = vi.spyOn(console, 'warn').mockImplementationOnce(() => {});

    pushPageviewEvent('https://www.example.com');

    expect(spyConsoleWarnSpy).toHaveBeenCalledWith('window.adobeDataLayer is not defined. This could mean your adobe analytics script has not loaded on the page yet.');
  });

  it('sends a pageLoad event with the correct URL', () => {
    window.adobeDataLayer = { push: vi.fn() };

    pushPageviewEvent('https://www.example.com/about-us');

    expect(window.adobeDataLayer.push).toHaveBeenCalledWith({
      event: 'pageLoad',
      page: { url: 'www.example.com/about-us' },
    });
  });
});

describe('pushValidationErrorEvent', () => {
  const originalAdobeDataLayer = window.adobeDataLayer;

  beforeEach(() => {
    vi.mocked(getClientEnv, { partial: true }).mockReturnValue({
      ADOBE_ANALYTICS_JQUERY_SRC: 'https://example.com/jquery.min.js',
      ADOBE_ANALYTICS_SRC: 'https://example.com/adobe-analytics.min.js',
    });
  });

  afterEach(() => {
    window.adobeDataLayer = originalAdobeDataLayer;
    vi.resetAllMocks();
  });

  it('does not send an event if window.adobeDataLayer is not defined', () => {
    const spyConsoleWarnSpy = vi.spyOn(console, 'warn').mockImplementationOnce(() => {});

    pushValidationErrorEvent([]);

    expect(spyConsoleWarnSpy).toHaveBeenCalledWith('window.adobeDataLayer is not defined. This could mean your adobe analytics script has not loaded on the page yet.');
  });

  it('sends a error event with the correct error name', () => {
    window.adobeDataLayer = { push: vi.fn() };

    pushValidationErrorEvent(['first-name', 'last-name', 'date-picker-date-of-birth-month', 'date-picker-date-of-birth-day', 'date-picker-date-of-birth-year']);

    expect(window.adobeDataLayer.push).toHaveBeenCalledWith({
      event: 'error',
      error: {
        name: 'ESDC-EDSC:CDCP Online Application:first-name|last-name|date-picker-date-of-birth-month|date-picker-date-of-birth-day|date-picker-date-of-birth-year',
      },
    });
  });

  it('sends a error event with the correct error name when length exceeds 255 characters', () => {
    window.adobeDataLayer = { push: vi.fn() };

    pushValidationErrorEvent([
      'input-radio-type-of-application-option-0',
      'input-radio-tax-filing-2023-option-0',
      'date-picker-date-of-birth-month',
      'date-picker-date-of-birth-day',
      'date-picker-date-of-birth-year',
      'first-name',
      'last-name',
      'input-radio-marital-status-option-0',
    ]);

    expect(window.adobeDataLayer.push).toHaveBeenCalledWith({
      event: 'error',
      error: {
        name: 'ESDC-EDSC:CDCP Online Application:input-radio-type-of-application-option-0|input-radio-tax-filing-2023-option-0|date-picker-date-of-birth-month|date-picker-date-of-birth-day|date-picker-date-of-birth-year|first-name|last-name|input-radio-marital-status-op',
      },
    });
  });
});

describe('pushFormSubmitEvent', () => {
  const originalAdobeDataLayer = window.adobeDataLayer;

  beforeEach(() => {
    vi.mocked(getClientEnv, { partial: true }).mockReturnValue({
      ADOBE_ANALYTICS_JQUERY_SRC: 'https://example.com/jquery.min.js',
      ADOBE_ANALYTICS_SRC: 'https://example.com/adobe-analytics.min.js',
    });
  });

  afterEach(() => {
    window.adobeDataLayer = originalAdobeDataLayer;
    vi.resetAllMocks();
  });

  it('does not send an event if window.adobeDataLayer is not defined', () => {
    const spyConsoleWarnSpy = vi.spyOn(console, 'warn').mockImplementationOnce(() => {});

    pushFormSubmitEvent('my-form', new Map());

    expect(spyConsoleWarnSpy).toHaveBeenCalledWith('window.adobeDataLayer is not defined. This could mean your adobe analytics script has not loaded on the page yet.');
  });

  it('sends a formSubmit event with the correct form name and formatted field values', () => {
    window.adobeDataLayer = { push: vi.fn() };

    pushFormSubmitEvent(
      'my-form',
      new Map([
        ['first-name', { elementType: 'radio', value: 'John' }],
        ['newsletter', { elementType: 'checkbox', value: 'yes' }],
      ]),
    );

    expect(window.adobeDataLayer.push).toHaveBeenCalledWith({
      event: 'formSubmit',
      form: {
        name: 'my-form',
        list: 'radio:first-name:John|checkbox:newsletter:yes',
      },
    });
  });

  it('sends a formSubmit event with an empty list when no form values are provided', () => {
    window.adobeDataLayer = { push: vi.fn() };

    pushFormSubmitEvent('my-form', new Map());

    expect(window.adobeDataLayer.push).toHaveBeenCalledWith({
      event: 'formSubmit',
      form: {
        name: 'my-form',
        list: '',
      },
    });
  });
});
