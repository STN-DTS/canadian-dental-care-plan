import { Response } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AddressCorrectionRequestEntity } from '~/.server/domain/entities';
import { DefaultAddressValidationRepository, MockAddressValidationRepository } from '~/.server/domain/repositories';
import type { DefaultAddressValidationRepositoryServerConfig } from '~/.server/domain/repositories';
import type { HttpClient } from '~/.server/http';

describe('DefaultAddressValidationRepository', () => {
  let serverConfigMock: DefaultAddressValidationRepositoryServerConfig;

  beforeEach(() => {
    serverConfigMock = {
      INTEROP_API_BASE_URI: 'https://api.example.com',
      INTEROP_ADDRESS_VALIDATION_REQUEST_CITY_MAX_LENGTH: 30,
      INTEROP_API_SUBSCRIPTION_KEY: 'SUBSCRIPTION_KEY',
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  describe('getAddressCorrectionResult', () => {
    it('should return address correction results on successful fetch', async () => {
      // arrange
      const requestEntityMock: AddressCorrectionRequestEntity = {
        address: '123 Fake Street',
        city: 'North Pole',
        provinceCode: 'ON',
        postalCode: 'H0H 0H0',
      };

      const responseDataMock = {
        'wsaddr:CorrectionResults': {
          'nc:AddressFullText': '123 Fake St',
          'nc:AddressCityName': 'North Pole',
          'nc:AddressPostalCode': 'H0H 0H0',
          'can:ProvinceCode': 'ON',
          'wsaddr:Information': {
            'wsaddr:StatusCode': 'Corrected',
          },
        },
      };

      const httpClientMock = mock<HttpClient>();
      httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock));

      // act
      const repository = new DefaultAddressValidationRepository(serverConfigMock, httpClientMock);
      const actual = await repository.getAddressCorrectionResult(requestEntityMock);

      // assert
      expect(actual).toEqual(responseDataMock);
      expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
        'http.client.interop-api.address-validation-correct.gets',
        new URL('https://api.example.com/address/validation/v1/CAN/correct?AddressFullText=123+Fake+Street&AddressCityName=North+Pole&AddressPostalCode=H0H+0H0&ProvinceCode=ON'),
        {
          proxyUrl: serverConfigMock.HTTP_PROXY_URL,
          method: 'GET',
          headers: {
            'Accept-Language': 'en-CA',
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': serverConfigMock.INTEROP_API_SUBSCRIPTION_KEY,
          },
        },
      );
    });

    it('should truncate city to configured max length when preparing the request data', async () => {
      // arrange
      serverConfigMock.INTEROP_ADDRESS_VALIDATION_REQUEST_CITY_MAX_LENGTH = 4;

      const requestEntityMock: AddressCorrectionRequestEntity = {
        address: '123 Fake Street',
        city: 'North Pole',
        provinceCode: 'ON',
        postalCode: 'H0H 0H0',
      };

      const responseDataMock = {
        'wsaddr:CorrectionResults': {
          'nc:AddressFullText': '123 Fake St',
          'nc:AddressCityName': 'North Pole',
          'nc:AddressPostalCode': 'H0H 0H0',
          'can:ProvinceCode': 'ON',
          'wsaddr:Information': {
            'wsaddr:StatusCode': 'Corrected',
          },
        },
      };

      const httpClientMock = mock<HttpClient>();
      httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock));

      // act
      const repository = new DefaultAddressValidationRepository(serverConfigMock, httpClientMock);
      const actual = await repository.getAddressCorrectionResult(requestEntityMock);

      // assert
      expect(actual).toEqual(responseDataMock);
      expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
        'http.client.interop-api.address-validation-correct.gets',
        new URL('https://api.example.com/address/validation/v1/CAN/correct?AddressFullText=123+Fake+Street&AddressCityName=Nort&AddressPostalCode=H0H+0H0&ProvinceCode=ON'),
        {
          proxyUrl: serverConfigMock.HTTP_PROXY_URL,
          method: 'GET',
          headers: {
            'Accept-Language': 'en-CA',
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': serverConfigMock.INTEROP_API_SUBSCRIPTION_KEY,
          },
        },
      );
    });

    it('should throw an error when fetch response is not ok', async () => {
      // arrange
      const requestEntityMock: AddressCorrectionRequestEntity = {
        address: '123 Fake Street',
        city: 'North Pole',
        provinceCode: 'ON',
        postalCode: 'H0H 0H0',
      };

      const mockHttpClient = mock<HttpClient>();
      mockHttpClient.instrumentedFetch.mockResolvedValue(Response.json(null, { status: 500 }));

      // act & assert
      const repository = new DefaultAddressValidationRepository(serverConfigMock, mockHttpClient);
      await expect(repository.getAddressCorrectionResult(requestEntityMock)).rejects.toThrowError();
    });
  });
});

describe('MockAddressValidationRepository', () => {
  it('should return a mocked address correction result', async () => {
    const addressCorrectionRequest: AddressCorrectionRequestEntity = {
      address: '111 Wellington Street',
      city: 'Ottawa',
      postalCode: 'K1A 0A9',
      provinceCode: 'ON',
    };

    const repository = new MockAddressValidationRepository();
    const result = await repository.getAddressCorrectionResult(addressCorrectionRequest);

    expect(result).toEqual({
      'wsaddr:CorrectionResults': {
        'nc:AddressFullText': expect.any(String),
        'nc:AddressCityName': addressCorrectionRequest.city.toUpperCase(),
        'can:ProvinceCode': addressCorrectionRequest.provinceCode.toUpperCase(),
        'nc:AddressPostalCode': addressCorrectionRequest.postalCode.toUpperCase(),
        'wsaddr:Information': {
          'wsaddr:StatusCode': expect.any(String),
        },
      },
    });
  });
});
