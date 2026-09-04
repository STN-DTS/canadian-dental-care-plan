import { Response } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { DefaultProvinceTerritoryStateRepositoryServerConfig } from '~/.server/domain/repositories';
import { DefaultProvinceTerritoryStateRepository, MockProvinceTerritoryStateRepository } from '~/.server/domain/repositories';
import type { HttpClient } from '~/.server/http';

const dataSource = vi.hoisted(() => ({
  '@odata.context': 'https://api.example.com/$metadata#esdc_countries',
  value: [
    {
      '@odata.etag': 'W/"00000000"',
      esdc_countryid: 'country-id',
      esdc_groupkey: 'common',
      esdc_ProvinceTerritoryState_Countryid_esd: [
        {
          '@odata.etag': 'W/"00000001"',
          esdc_provinceterritorystateid: '1',
          _esdc_countryid_value: '10',
          esdc_nameenglish: 'Alabama',
          esdc_namefrench: 'Alabama',
          esdc_internationalalphacode: 'AL',
        },
        {
          '@odata.etag': 'W/"00000002"',
          esdc_provinceterritorystateid: '2',
          _esdc_countryid_value: '10',
          esdc_nameenglish: 'Alaska',
          esdc_namefrench: 'Alaska',
          esdc_internationalalphacode: 'AK',
        },
      ],
      'esdc_ProvinceTerritoryState_Countryid_esd@odata.nextLink': 'https://api.example.com/api/data/v9.2/esdc_countries(0cf5389e-97ae-eb11-8236-000d3af4bfc3)/esdc_ProvinceTerritoryState_Countryid_esd',
    },
  ],
}));

vi.mock(import('~/.server/resources/power-platform/province-territory-state.json'), () => ({
  default: dataSource,
}));

describe('DefaultProvinceTerritoryStateRepository', () => {
  let serverConfigMock: DefaultProvinceTerritoryStateRepositoryServerConfig;

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

  it('should return results from listAllProvinceTerritoryStates call', async () => {
    const responseDataMock = {
      value: [
        {
          esdc_ProvinceTerritoryState_Countryid_esd: [
            {
              '@odata.etag': 'W/"00000001"',
              _esdc_countryid_value: '10',
              esdc_internationalalphacode: 'AL',
              esdc_nameenglish: 'Alabama',
              esdc_namefrench: 'Alabama',
              esdc_provinceterritorystateid: '1',
            },
            {
              '@odata.etag': 'W/"00000002"',
              _esdc_countryid_value: '10',
              esdc_internationalalphacode: 'AK',
              esdc_nameenglish: 'Alaska',
              esdc_namefrench: 'Alaska',
              esdc_provinceterritorystateid: '2',
            },
          ],
        },
      ],
    };

    const httpClientMock = mock<HttpClient>();
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock));

    // act
    const repository = new DefaultProvinceTerritoryStateRepository(serverConfigMock, httpClientMock);
    const actual = await repository.listAllProvinceTerritoryStates();

    expect(actual).toEqual(responseDataMock.value[0]?.esdc_ProvinceTerritoryState_Countryid_esd);
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
      'http.client.interop-api.province-territory-states.gets',
      new URL(
        'https://api.example.com/dental-care/code-list/pp/v1/esdc_countries?%24select=esdc_groupkey&%24filter=statecode+eq+0+and+esdc_groupkey+ne+null&%24expand=esdc_ProvinceTerritoryState_Countryid_esd%28%24select%3Desdc_provinceterritorystateid%2Cesdc_nameenglish%2Cesdc_namefrench%2Cesdc_internationalalphacode%3B%24filter%3Dstatecode+eq+0+and+esdc_enabledentalapplicationportal+eq+true%29',
      ),
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

  it('should return result for findProvinceTerritoryStateById call', async () => {
    const responseDataMock = {
      value: [
        {
          esdc_ProvinceTerritoryState_Countryid_esd: [
            {
              '@odata.etag': 'W/"00000001"',
              _esdc_countryid_value: '10',
              esdc_internationalalphacode: 'AL',
              esdc_nameenglish: 'Alabama',
              esdc_namefrench: 'Alabama',
              esdc_provinceterritorystateid: '1',
            },
            {
              '@odata.etag': 'W/"00000002"',
              _esdc_countryid_value: '10',
              esdc_internationalalphacode: 'AK',
              esdc_nameenglish: 'Alaska',
              esdc_namefrench: 'Alaska',
              esdc_provinceterritorystateid: '2',
            },
          ],
        },
      ],
    };

    const httpClientMock = mock<HttpClient>();
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock));

    // act
    const repository = new DefaultProvinceTerritoryStateRepository(serverConfigMock, httpClientMock);
    const actual = await repository.findProvinceTerritoryStateById('1');

    expect(actual.unwrap()).toEqual(responseDataMock.value[0]?.esdc_ProvinceTerritoryState_Countryid_esd[0]);
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
      'http.client.interop-api.province-territory-states.gets',
      new URL(
        'https://api.example.com/dental-care/code-list/pp/v1/esdc_countries?%24select=esdc_groupkey&%24filter=statecode+eq+0+and+esdc_groupkey+ne+null&%24expand=esdc_ProvinceTerritoryState_Countryid_esd%28%24select%3Desdc_provinceterritorystateid%2Cesdc_nameenglish%2Cesdc_namefrench%2Cesdc_internationalalphacode%3B%24filter%3Dstatecode+eq+0+and+esdc_enabledentalapplicationportal+eq+true%29',
      ),
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

describe('MockProvinceTerritoryStateRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('should get all province territory states', async () => {
    const repository = new MockProvinceTerritoryStateRepository();

    const provinceTerritoryStates = await repository.listAllProvinceTerritoryStates();

    expect(provinceTerritoryStates).toEqual([
      {
        '@odata.etag': 'W/"00000001"',
        esdc_provinceterritorystateid: '1',
        _esdc_countryid_value: '10',
        esdc_nameenglish: 'Alabama',
        esdc_namefrench: 'Alabama',
        esdc_internationalalphacode: 'AL',
      },
      {
        '@odata.etag': 'W/"00000002"',
        esdc_provinceterritorystateid: '2',
        _esdc_countryid_value: '10',
        esdc_nameenglish: 'Alaska',
        esdc_namefrench: 'Alaska',
        esdc_internationalalphacode: 'AK',
      },
    ]);
  });

  it('should handle empty province territory states data', async () => {
    vi.spyOn(dataSource, 'value', 'get').mockReturnValueOnce([]);

    const repository = new MockProvinceTerritoryStateRepository();

    const provinceTerritoryStates = await repository.listAllProvinceTerritoryStates();

    expect(provinceTerritoryStates).toEqual([]);
  });

  it('should get a province territory state by id', async () => {
    const repository = new MockProvinceTerritoryStateRepository();

    const provinceTerritoryState = await repository.findProvinceTerritoryStateById('1');

    expect(provinceTerritoryState.unwrap()).toEqual({
      '@odata.etag': 'W/"00000001"',
      esdc_provinceterritorystateid: '1',
      _esdc_countryid_value: '10',
      esdc_nameenglish: 'Alabama',
      esdc_namefrench: 'Alabama',
      esdc_internationalalphacode: 'AL',
    });
  });

  it('should return null for non-existent province territory state id', async () => {
    const repository = new MockProvinceTerritoryStateRepository();

    const provinceTerritoryState = await repository.findProvinceTerritoryStateById('non-existent-id');

    expect(provinceTerritoryState.isNone()).toBe(true);
  });
});
