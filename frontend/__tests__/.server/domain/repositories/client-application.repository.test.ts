import { None } from 'oxide.ts';
import { Response } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ServerConfig } from '~/.server/configs';
import type { ClientApplicationBasicInfoRequestEntity, ClientApplicationSinRequestEntity } from '~/.server/domain/entities';
import { DefaultClientApplicationRepository, MockClientApplicationRepository } from '~/.server/domain/repositories';
import type { HttpClient } from '~/.server/http';

const clientApplicationJsonDataSource = vi.hoisted(() => ({
  BenefitApplication: {
    Applicant: {
      ApplicantDetail: {
        InvitationToApplyIndicator: false,
        PreviousTaxesFiledIndicator: false,
      },
    },
  },
}));

const clientApplicationItaJsonDataSource = vi.hoisted(() => ({
  BenefitApplication: {
    Applicant: {
      ApplicantDetail: {
        InvitationToApplyIndicator: true,
        PreviousTaxesFiledIndicator: false,
      },
    },
  },
}));

vi.mock('~/.server/resources/power-platform/client-application.json', () => ({
  default: clientApplicationJsonDataSource,
}));

vi.mock('~/.server/resources/power-platform/client-application-ita.json', () => ({
  default: clientApplicationItaJsonDataSource,
}));

describe('DefaultClientApplicationRepository', () => {
  let serverConfigMock: Pick<ServerConfig, 'INTEROP_API_BASE_URI' | 'HTTP_PROXY_URL' | 'INTEROP_API_SUBSCRIPTION_KEY'>;

  beforeEach(() => {
    serverConfigMock = {
      INTEROP_API_BASE_URI: 'https://api.example.com',
      HTTP_PROXY_URL: 'https://proxy.example.com',
      INTEROP_API_SUBSCRIPTION_KEY: 'SUBSCRIPTION_KEY',
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  describe('findClientApplicationByBasicInfo', () => {
    it('should return client application when found (200)', async () => {
      const responseDataMock = {
        BenefitApplication: {
          Applicant: {},
        },
      };

      const httpClientMock = mock<HttpClient>();
      httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock, { status: 200 }));

      const repository = new DefaultClientApplicationRepository(serverConfigMock, httpClientMock);
      const requestEntity: ClientApplicationBasicInfoRequestEntity = {
        Applicant: {
          ClientIdentification: [{ IdentificationID: '123', IdentificationCategoryText: 'Client Number' }],
          PersonName: { PersonGivenName: ['John'], PersonSurName: 'Doe' },
          PersonBirthDate: { date: '2000-01-01' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      const result = await repository.findClientApplicationByBasicInfo(requestEntity);

      expect(result.unwrap()).toEqual(responseDataMock);
      expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith(
        'http.client.interop-api.retrieve-benefit-application_by-basic-info.posts',
        new URL('https://api.example.com/dental-care/applicant-information/dts/v1/retrieve-benefit-application'),
        {
          proxyUrl: serverConfigMock.HTTP_PROXY_URL,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': serverConfigMock.INTEROP_API_SUBSCRIPTION_KEY,
          },
          body: JSON.stringify(requestEntity),
        },
      );
    });

    it('should return null when not found (204)', async () => {
      const httpClientMock = mock<HttpClient>();
      httpClientMock.instrumentedFetch.mockResolvedValue(new Response(null, { status: 204 }));

      const repository = new DefaultClientApplicationRepository(serverConfigMock, httpClientMock);
      const requestEntity: ClientApplicationBasicInfoRequestEntity = {
        Applicant: {
          ClientIdentification: [{ IdentificationID: '123', IdentificationCategoryText: 'Client Number' }],
          PersonName: { PersonGivenName: ['John'], PersonSurName: 'Doe' },
          PersonBirthDate: { date: '2000-01-01' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      const result = await repository.findClientApplicationByBasicInfo(requestEntity);

      expect(result).toBe(None);
    });

    it('should throw Error for other non-200/204 responses', async () => {
      const httpClientMock = mock<HttpClient>();
      httpClientMock.instrumentedFetch.mockResolvedValue(new Response(null, { status: 500, statusText: 'Internal Server Error' }));

      const repository = new DefaultClientApplicationRepository(serverConfigMock, httpClientMock);
      const requestEntity: ClientApplicationBasicInfoRequestEntity = {
        Applicant: {
          ClientIdentification: [{ IdentificationID: '123', IdentificationCategoryText: 'Client Number' }],
          PersonName: { PersonGivenName: ['John'], PersonSurName: 'Doe' },
          PersonBirthDate: { date: '2000-01-01' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      await expect(repository.findClientApplicationByBasicInfo(requestEntity)).rejects.toThrow("Failed to 'POST' for client application data by basic info. Status: 500, Status Text: Internal Server Error");
    });
  });

  describe('findClientApplicationBySin', () => {
    it('should return client application when found (200)', async () => {
      const responseDataMock = {
        BenefitApplication: {
          Applicant: {
            /* mock data */
          },
        },
      };
      const httpClientMock = mock<HttpClient>();
      httpClientMock.instrumentedFetch.mockResolvedValue(Response.json(responseDataMock, { status: 200 }));

      const repository = new DefaultClientApplicationRepository(serverConfigMock, httpClientMock);
      const requestEntity: ClientApplicationSinRequestEntity = {
        Applicant: {
          PersonSINIdentification: { IdentificationID: '800000002' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      const result = await repository.findClientApplicationBySin(requestEntity);

      expect(result.unwrap()).toEqual(responseDataMock);
      expect(httpClientMock.instrumentedFetch).toHaveBeenCalledExactlyOnceWith('http.client.interop-api.retrieve-benefit-application_by-sin.posts', new URL('https://api.example.com/dental-care/applicant-information/dts/v1/retrieve-benefit-application'), {
        proxyUrl: serverConfigMock.HTTP_PROXY_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': serverConfigMock.INTEROP_API_SUBSCRIPTION_KEY,
        },
        body: JSON.stringify(requestEntity),
      });
    });

    it('should return null when not found (204)', async () => {
      const httpClientMock = mock<HttpClient>();
      httpClientMock.instrumentedFetch.mockResolvedValue(new Response(null, { status: 204 }));

      const repository = new DefaultClientApplicationRepository(serverConfigMock, httpClientMock);
      const requestEntity: ClientApplicationSinRequestEntity = {
        Applicant: {
          PersonSINIdentification: { IdentificationID: '900000001' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      const result = await repository.findClientApplicationBySin(requestEntity);

      expect(result).toBe(None);
    });

    it('should throw Error for other non-200/204 responses', async () => {
      const httpClientMock = mock<HttpClient>();
      httpClientMock.instrumentedFetch.mockResolvedValue(new Response(null, { status: 400, statusText: 'Bad Request' }));

      const repository = new DefaultClientApplicationRepository(serverConfigMock, httpClientMock);
      const requestEntity: ClientApplicationSinRequestEntity = {
        Applicant: {
          PersonSINIdentification: { IdentificationID: '800000002' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      await expect(repository.findClientApplicationBySin(requestEntity)).rejects.toThrow("Failed to 'POST' for client application data by sin. Status: 400, Status Text: Bad Request");
    });
  });
});

describe('MockClientApplicationRepository', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  describe('findClientApplicationByBasicInfo', () => {
    it('should return client application with ITA flag for specific ID', async () => {
      const repository = new MockClientApplicationRepository();
      const requestEntity: ClientApplicationBasicInfoRequestEntity = {
        Applicant: {
          ClientIdentification: [{ IdentificationID: '10000000001', IdentificationCategoryText: 'Client Number' }],
          PersonName: { PersonGivenName: ['John'], PersonSurName: 'Doe' },
          PersonBirthDate: { date: '2000-01-01' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      const resultOption = await repository.findClientApplicationByBasicInfo(requestEntity);
      const result = resultOption.unwrap();

      expect(result.BenefitApplication.Applicant.ApplicantDetail.InvitationToApplyIndicator).toBe(true);
      expect(result.BenefitApplication.Applicant.ApplicantDetail.PreviousTaxesFiledIndicator).toBe(false);
      expect(result.BenefitApplication.Applicant.PersonName[0]?.PersonGivenName[0]).toBe('John');
      expect(result.BenefitApplication.Applicant.PersonName[0]?.PersonSurName).toBe('Doe');
      expect(result.BenefitApplication.Applicant.PersonBirthDate.date).toBe('2000-01-01');
    });

    it('should return client application with default flags for unknown ID', async () => {
      const repository = new MockClientApplicationRepository();
      const requestEntity: ClientApplicationBasicInfoRequestEntity = {
        Applicant: {
          ClientIdentification: [{ IdentificationID: '9999999999', IdentificationCategoryText: 'Client Number' }],
          PersonName: { PersonGivenName: ['Jane'], PersonSurName: 'Smith' },
          PersonBirthDate: { date: '1990-01-01' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      const resultOption = await repository.findClientApplicationByBasicInfo(requestEntity);
      const result = resultOption.unwrap();

      expect(result.BenefitApplication.Applicant.ApplicantDetail.InvitationToApplyIndicator).toBe(false);
      expect(result.BenefitApplication.Applicant.ApplicantDetail.PreviousTaxesFiledIndicator).toBe(false);
      expect(result.BenefitApplication.Applicant.PersonName[0]?.PersonGivenName[0]).toBe('Jane');
      expect(result.BenefitApplication.Applicant.PersonName[0]?.PersonSurName).toBe('Smith');
      expect(result.BenefitApplication.Applicant.PersonBirthDate.date).toBe('1990-01-01');
    });

    it('should return null for specific ID (10000000000)', async () => {
      const repository = new MockClientApplicationRepository();
      const requestEntity: ClientApplicationBasicInfoRequestEntity = {
        Applicant: {
          ClientIdentification: [{ IdentificationID: '10000000000', IdentificationCategoryText: 'Client Number' }],
          PersonName: { PersonGivenName: ['John'], PersonSurName: 'Doe' },
          PersonBirthDate: { date: '2000-01-01' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      const result = await repository.findClientApplicationByBasicInfo(requestEntity);

      expect(result).toBe(None);
    });
  });

  describe('findClientApplicationBySin', () => {
    it('should return client application with ITA flag for specific SIN', async () => {
      const repository = new MockClientApplicationRepository();
      const requestEntity = {
        Applicant: {
          PersonSINIdentification: { IdentificationID: '800000002' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      const resultOption = await repository.findClientApplicationBySin(requestEntity);
      const result = resultOption.unwrap();

      expect(result.BenefitApplication.Applicant.ApplicantDetail.InvitationToApplyIndicator).toBe(true);
      expect(result.BenefitApplication.Applicant.ApplicantDetail.PreviousTaxesFiledIndicator).toBe(true);
      expect(result.BenefitApplication.Applicant.PersonSINIdentification.IdentificationID).toBe('800000002');
    });

    it('should return client application with default flags for unknown SIN', async () => {
      const repository = new MockClientApplicationRepository();
      const requestEntity = {
        Applicant: {
          PersonSINIdentification: { IdentificationID: '999999999' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      const resultOption = await repository.findClientApplicationBySin(requestEntity);
      const result = resultOption.unwrap();

      expect(result.BenefitApplication.Applicant.ApplicantDetail.InvitationToApplyIndicator).toBe(false);
      expect(result.BenefitApplication.Applicant.ApplicantDetail.PreviousTaxesFiledIndicator).toBe(false);
      expect(result.BenefitApplication.Applicant.PersonSINIdentification.IdentificationID).toBe('999999999');
    });

    it('should return null for specific SIN (900000001)', async () => {
      const repository = new MockClientApplicationRepository();
      const requestEntity = {
        Applicant: {
          PersonSINIdentification: { IdentificationID: '900000001' },
        },
        BenefitApplicationYear: {
          IdentificationID: '123',
        },
      };

      const result = await repository.findClientApplicationBySin(requestEntity);

      expect(result).toBe(None);
    });
  });
});
