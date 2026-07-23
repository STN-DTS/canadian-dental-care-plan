import { None } from 'oxide.ts';
import { Response } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { DefaultCountryRepositoryServerConfig } from '~/.server/domain/repositories';
import { DefaultCountryRepository, MockCountryRepository } from '~/.server/domain/repositories';
import type { HttpClient } from '~/.server/http';

const dataSource = vi.hoisted(() => ({
  default: {
    value: [
      {
        esdc_countryid: '1',
        esdc_nameenglish: 'Canada English',
        esdc_namefrench: 'Canada Français',
        esdc_countrycodealpha3: 'CAN',
      },
      {
        esdc_countryid: '2',
        esdc_nameenglish: 'United States English',
        esdc_namefrench: 'États-Unis Français',
        esdc_countrycodealpha3: 'USA',
      },
    ],
  },
}));

vi.mock('~/.server/resources/power-platform/country.json', () => dataSource);

describe('DefaultCountryRepository', () => {
  let serverConfigMock: DefaultCountryRepositoryServerConfig;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    serverConfigMock = {
      INTEROP_API_BASE_URI: 'https://api.example.com',
      INTEROP_API_SUBSCRIPTION_KEY: 'SUBSCRIPTION_KEY',
      INTEROP_API_MAX_RETRIES: 10,
      INTEROP_API_BACKOFF_MS: 3,
    };
  });

  it('should return results for listAllCountries call', async () => {
    const responseDataMock = {
      value: [
        {
          esdc_countrycodealpha3: 'CAN',
          esdc_countryid: '1',
          esdc_nameenglish: 'Canada English',
          esdc_namefrench: 'Canada Français',
        },
        {
          esdc_countrycodealpha3: 'USA',
          esdc_countryid: '2',
          esdc_nameenglish: 'United States English',
          esdc_namefrench: 'États-Unis Français',
        },
      ],
    };

    const httpClientMock = mock<HttpClient>();
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock));

    // act
    const repository = new DefaultCountryRepository(serverConfigMock, httpClientMock);
    const actual = await repository.listAllCountries();

    expect(actual).toEqual(responseDataMock.value);
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
      'http.client.interop-api.countries.gets',
      new URL('https://api.example.com/dental-care/code-list/pp/v1/esdc_countries?%24select=esdc_countryid%2Cesdc_nameenglish%2Cesdc_namefrench%2Cesdc_countrycodealpha3&%24filter=statecode+eq+0+and+esdc_enabledentalapplicationportal+eq+true'),
      {
        proxyUrl: serverConfigMock.HTTP_PROXY_URL,
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': serverConfigMock.INTEROP_API_SUBSCRIPTION_KEY,
        },
        retryOptions: {
          backoffMs: 3,
          retries: 10,
          retryConditions: {
            '502': [],
          },
        },
      },
    );
  });

  it('should return singular result for findCountryById call', async () => {
    const responseDataMock = {
      value: [
        {
          esdc_countrycodealpha3: 'CAN',
          esdc_countryid: '1',
          esdc_nameenglish: 'Canada English',
          esdc_namefrench: 'Canada Français',
        },
      ],
    };

    const httpClientMock = mock<HttpClient>();
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock));

    // act
    const repository = new DefaultCountryRepository(serverConfigMock, httpClientMock);
    const actual = await repository.findCountryById('1');

    expect(actual.unwrap()).toEqual(responseDataMock.value[0]);
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
      'http.client.interop-api.countries.gets',
      new URL('https://api.example.com/dental-care/code-list/pp/v1/esdc_countries?%24select=esdc_countryid%2Cesdc_nameenglish%2Cesdc_namefrench%2Cesdc_countrycodealpha3&%24filter=statecode+eq+0+and+esdc_enabledentalapplicationportal+eq+true'),
      {
        proxyUrl: serverConfigMock.HTTP_PROXY_URL,
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': serverConfigMock.INTEROP_API_SUBSCRIPTION_KEY,
        },
        retryOptions: {
          backoffMs: 3,
          retries: 10,
          retryConditions: {
            '502': [],
          },
        },
      },
    );
  });
});

describe('MockCountryRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('should get all countries', async () => {
    const repository = new MockCountryRepository();

    const countries = await repository.listAllCountries();

    expect(countries).toEqual([
      {
        esdc_countryid: '1',
        esdc_nameenglish: 'Canada English',
        esdc_namefrench: 'Canada Français',
        esdc_countrycodealpha3: 'CAN',
      },
      {
        esdc_countryid: '2',
        esdc_nameenglish: 'United States English',
        esdc_namefrench: 'États-Unis Français',
        esdc_countrycodealpha3: 'USA',
      },
    ]);
  });

  it('should handle empty countries data', async () => {
    vi.spyOn(dataSource, 'default', 'get').mockReturnValueOnce({ value: [] });

    const repository = new MockCountryRepository();

    const countries = await repository.listAllCountries();

    expect(countries).toEqual([]);
  });

  it('should get a country by id', async () => {
    const repository = new MockCountryRepository();

    const country = await repository.findCountryById('1');

    expect(country.unwrap()).toEqual({
      esdc_countryid: '1',
      esdc_nameenglish: 'Canada English',
      esdc_namefrench: 'Canada Français',
      esdc_countrycodealpha3: 'CAN',
    });
  });

  it('should return null for non-existent country id', async () => {
    const repository = new MockCountryRepository();

    const country = await repository.findCountryById('non-existent-id');

    expect(country).toBe(None);
  });
});
