import { None } from 'oxide.ts';
import { Response } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { DefaultClientFriendlyStatusRepositoryServerConfig } from '~/.server/domain/repositories';
import { DefaultClientFriendlyStatusRepository, MockClientFriendlyStatusRepository } from '~/.server/domain/repositories';
import type { HttpClient } from '~/.server/http';

const dataSource = vi.hoisted(() => ({
  default: {
    value: [
      {
        esdc_clientfriendlystatusid: '1',
        esdc_descriptionenglish: 'You have qualified for the Canadian Dental Care Plan.',
        esdc_descriptionfrench: 'Vous êtes admissible au Régime canadien de soins dentaires.',
      },
      {
        esdc_clientfriendlystatusid: '2',
        esdc_descriptionenglish: 'We reviewed your application for the Canadian Dental Care Plan.',
        esdc_descriptionfrench: "Nous avons examiné votre demande d'adhésion au Régime canadien de soins dentaires.",
      },
    ],
  },
}));

vi.mock('~/.server/resources/power-platform/client-friendly-status.json', () => dataSource);

describe('DefaultClientFriendlyStatusRepository', () => {
  let serverConfigMock: DefaultClientFriendlyStatusRepositoryServerConfig;

  beforeEach(() => {
    serverConfigMock = {
      INTEROP_API_BASE_URI: 'https://api.example.com',
      INTEROP_API_SUBSCRIPTION_KEY: 'SUBSCRIPTION_KEY',
      INTEROP_API_MAX_RETRIES: 10,
      INTEROP_API_BACKOFF_MS: 3,
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should fetch all client friendly statuses', async () => {
    const responseDataMock = {
      value: [
        {
          esdc_clientfriendlystatusid: '1',
          esdc_descriptionenglish: 'english',
          esdc_descriptionfrench: 'french',
        },
      ],
    };

    const httpClientMock = mock<HttpClient>();
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock));

    // act
    const repository = new DefaultClientFriendlyStatusRepository(serverConfigMock, httpClientMock);
    const actual = await repository.listAllClientFriendlyStatuses();

    expect(actual).toEqual(responseDataMock.value);
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
      'http.client.interop-api.client-friendly-statuses.gets',
      new URL('https://api.example.com/dental-care/code-list/pp/v1/esdc_clientfriendlystatuses?%24select=esdc_clientfriendlystatusid%2Cesdc_descriptionenglish%2Cesdc_descriptionfrench&%24filter=statecode+eq+0'),
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

  it('should fetch client friendly status by id', async () => {
    const responseDataMock = {
      value: [
        {
          esdc_clientfriendlystatusid: '1',
          esdc_descriptionenglish: 'english',
          esdc_descriptionfrench: 'french',
        },
      ],
    };

    const httpClientMock = mock<HttpClient>();
    httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock));

    // act
    const repository = new DefaultClientFriendlyStatusRepository(serverConfigMock, httpClientMock);
    const actual = await repository.findClientFriendlyStatusById('1');

    expect(actual.unwrap()).toEqual(responseDataMock.value[0]);
    expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
      'http.client.interop-api.client-friendly-statuses.gets',
      new URL('https://api.example.com/dental-care/code-list/pp/v1/esdc_clientfriendlystatuses?%24select=esdc_clientfriendlystatusid%2Cesdc_descriptionenglish%2Cesdc_descriptionfrench&%24filter=statecode+eq+0'),
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

describe('MockClientFriendlyStatusRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('should get all client friendly statuses', async () => {
    const repository = new MockClientFriendlyStatusRepository();

    const clientFriendlyStatuses = await repository.listAllClientFriendlyStatuses();

    expect(clientFriendlyStatuses).toEqual([
      {
        esdc_clientfriendlystatusid: '1',
        esdc_descriptionenglish: 'You have qualified for the Canadian Dental Care Plan.',
        esdc_descriptionfrench: 'Vous êtes admissible au Régime canadien de soins dentaires.',
      },
      {
        esdc_clientfriendlystatusid: '2',
        esdc_descriptionenglish: 'We reviewed your application for the Canadian Dental Care Plan.',
        esdc_descriptionfrench: "Nous avons examiné votre demande d'adhésion au Régime canadien de soins dentaires.",
      },
    ]);
  });

  it('should handle empty client friendly statuses data', async () => {
    vi.spyOn(dataSource, 'default', 'get').mockReturnValueOnce({ value: [] });

    const repository = new MockClientFriendlyStatusRepository();

    const clientFriendlyStatuses = await repository.listAllClientFriendlyStatuses();

    expect(clientFriendlyStatuses).toEqual([]);
  });

  it('should get a client friendly status by id', async () => {
    const repository = new MockClientFriendlyStatusRepository();

    const clientFriendlyStatus = await repository.findClientFriendlyStatusById('1');

    expect(clientFriendlyStatus.unwrap()).toEqual({
      esdc_clientfriendlystatusid: '1',
      esdc_descriptionenglish: 'You have qualified for the Canadian Dental Care Plan.',
      esdc_descriptionfrench: 'Vous êtes admissible au Régime canadien de soins dentaires.',
    });
  });

  it('should return null for non-existent client friendly status id', async () => {
    const repository = new MockClientFriendlyStatusRepository();

    const clientFriendlyStatus = await repository.findClientFriendlyStatusById('non-existent-id');

    expect(clientFriendlyStatus).toBe(None);
  });
});
