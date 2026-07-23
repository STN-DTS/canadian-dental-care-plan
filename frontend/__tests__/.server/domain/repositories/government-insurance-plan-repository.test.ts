import { Response } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultGovernmentInsurancePlanRepository, MockGovernmentInsurancePlanRepository } from '~/.server/domain/repositories';
import type { DefaultGovernmentInsurancePlanRepositoryServerConfig } from '~/.server/domain/repositories';
import type { HttpClient } from '~/.server/http';

const dataSource = vi.hoisted(() => ({
  default: {
    value: [
      {
        esdc_governmentinsuranceplanid: '1',
        esdc_nameenglish: 'First Provincial Insurance Plan',
        esdc_namefrench: "Premier plan d'assurance provincial",
        _esdc_provinceterritorystateid_value: '10',
      },
      {
        esdc_governmentinsuranceplanid: '2',
        esdc_nameenglish: 'Second Provincial Insurance Plan',
        esdc_namefrench: "Deuxième plan d'assurance provincial",
        _esdc_provinceterritorystateid_value: '20',
      },
      {
        esdc_governmentinsuranceplanid: '3',
        esdc_nameenglish: 'First Insurance Plan Federal',
        esdc_namefrench: "Premier plan d'assurance fédéral",
        _esdc_provinceterritorystateid_value: null,
      },
      {
        esdc_governmentinsuranceplanid: '4',
        esdc_nameenglish: 'Second Insurance Plan Federal',
        esdc_namefrench: "Deuxième plan d'assurance fédéral",
        _esdc_provinceterritorystateid_value: null,
      },
    ],
  },
}));

vi.mock('~/.server/resources/power-platform/government-insurance-plan.json', () => dataSource);

describe('DefaultGovernmentInsurancePlanRepository', () => {
  let serverConfigMock: DefaultGovernmentInsurancePlanRepositoryServerConfig;

  beforeEach(() => {
    serverConfigMock = {
      INTEROP_API_BASE_URI: 'https://api.example.com',
      INTEROP_API_SUBSCRIPTION_KEY: 'SUBSCRIPTION_KEY',
      INTEROP_API_MAX_RETRIES: 10,
      INTEROP_API_BACKOFF_MS: 3,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('should fetch all government insurance plans', async () => {
    const responseDataMock = {
      value: [
        {
          esdc_governmentinsuranceplanid: '0',
          esdc_nameenglish: 'name english',
          esdc_namefrench: 'name french',
          _esdc_provinceterritorystateid_value: null,
        },
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'name english',
          esdc_namefrench: 'name french',
          _esdc_provinceterritorystateid_value: '0',
        },
      ],
    };

    const httpClientMock = mock<HttpClient>();
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock));

    // act
    const repository = new DefaultGovernmentInsurancePlanRepository(serverConfigMock, httpClientMock);
    const actual = await repository.listAllGovernmentInsurancePlans();

    expect(actual).toEqual(responseDataMock.value);

    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
      'http.client.interop-api.government-insurance-plans.gets',
      new URL('https://api.example.com/dental-care/code-list/pp/v1/esdc_governmentinsuranceplans?%24select=esdc_governmentinsuranceplanid%2Cesdc_nameenglish%2Cesdc_namefrench%2C_esdc_provinceterritorystateid_value&%24filter=statecode+eq+0'),
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

  it('should fetch government insurance plan by id', async () => {
    const responseDataMock = {
      value: [
        {
          esdc_governmentinsuranceplanid: '0',
          esdc_nameenglish: 'name english',
          esdc_namefrench: 'name french',
          _esdc_provinceterritorystateid_value: null,
        },
        {
          esdc_governmentinsuranceplanid: '1',
          esdc_nameenglish: 'name english',
          esdc_namefrench: 'name french',
          _esdc_provinceterritorystateid_value: '1',
        },
      ],
    };

    const httpClientMock = mock<HttpClient>();
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock));

    // act
    const repository = new DefaultGovernmentInsurancePlanRepository(serverConfigMock, httpClientMock);
    const actual = await repository.findGovernmentInsurancePlanById('0');

    expect(actual.unwrap()).toEqual(responseDataMock.value[0]);

    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
      'http.client.interop-api.government-insurance-plans.gets',
      new URL('https://api.example.com/dental-care/code-list/pp/v1/esdc_governmentinsuranceplans?%24select=esdc_governmentinsuranceplanid%2Cesdc_nameenglish%2Cesdc_namefrench%2C_esdc_provinceterritorystateid_value&%24filter=statecode+eq+0'),
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

describe('MockGovernmentInsurancePlanRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('should get all government insurance plans', async () => {
    const repository = new MockGovernmentInsurancePlanRepository();

    const governmentInsurancePlans = await repository.listAllGovernmentInsurancePlans();

    expect(governmentInsurancePlans).toEqual([
      {
        esdc_governmentinsuranceplanid: '1',
        esdc_nameenglish: 'First Provincial Insurance Plan',
        esdc_namefrench: "Premier plan d'assurance provincial",
        _esdc_provinceterritorystateid_value: '10',
      },
      {
        esdc_governmentinsuranceplanid: '2',
        esdc_nameenglish: 'Second Provincial Insurance Plan',
        esdc_namefrench: "Deuxième plan d'assurance provincial",
        _esdc_provinceterritorystateid_value: '20',
      },
      {
        esdc_governmentinsuranceplanid: '3',
        esdc_nameenglish: 'First Insurance Plan Federal',
        esdc_namefrench: "Premier plan d'assurance fédéral",
        _esdc_provinceterritorystateid_value: null,
      },
      {
        esdc_governmentinsuranceplanid: '4',
        esdc_nameenglish: 'Second Insurance Plan Federal',
        esdc_namefrench: "Deuxième plan d'assurance fédéral",
        _esdc_provinceterritorystateid_value: null,
      },
    ]);
  });

  it('should handle empty government insurance plans data', async () => {
    vi.spyOn(dataSource, 'default', 'get').mockReturnValueOnce({ value: [] });

    const repository = new MockGovernmentInsurancePlanRepository();

    const governmentInsurancePlans = await repository.listAllGovernmentInsurancePlans();

    expect(governmentInsurancePlans).toEqual([]);
  });

  it('should get a government insurance plan by id', async () => {
    const repository = new MockGovernmentInsurancePlanRepository();

    const governmentInsurancePlan = await repository.findGovernmentInsurancePlanById('3');

    expect(governmentInsurancePlan.unwrap()).toEqual({
      esdc_governmentinsuranceplanid: '3',
      esdc_nameenglish: 'First Insurance Plan Federal',
      esdc_namefrench: "Premier plan d'assurance fédéral",
      _esdc_provinceterritorystateid_value: null,
    });
  });

  it('should return null for non-existent government insurance plan id', async () => {
    const repository = new MockGovernmentInsurancePlanRepository();

    const governmentInsurancePlan = await repository.findGovernmentInsurancePlanById('non-existent-id');

    expect(governmentInsurancePlan.isNone()).toBe(true);
  });
});
