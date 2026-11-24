import { Redacted } from 'effect';
import { MockAgent, Response, fetch } from 'undici';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { BenefitApplicationRequestEntity, BenefitRenewalRequestEntity } from '~/.server/domain/entities';
import { DefaultBenefitApplicationRepository } from '~/.server/domain/repositories/benefit-application-repository';
import { DefaultBenefitRenewalRepository } from '~/.server/domain/repositories/benefit-renewal-repository';
import { DefaultEvidentiaryDocumentRepository } from '~/.server/domain/repositories/evidentiary-document-repository';
import { DefaultProfileRepository } from '~/.server/domain/repositories/profile-repository';
import { DefaultHttpClient } from '~/.server/http';
import type { FetchFn } from '~/.server/http';
import type { InstrumentationService } from '~/.server/observability';
import { ErrorCodes } from '~/errors/error-codes';

const serverConfig = {
  INTEROP_API_BASE_URI: 'https://api.example.test',
  INTEROP_API_SUBSCRIPTION_KEY: Redacted.make('test-key'),
  INTEROP_BENEFIT_APPLICATION_PATHNAME: '/applications',
  INTEROP_BENEFIT_RENEWAL_PATHNAME: '/applications',
  INTEROP_PROFILE_UPDATE_BENEFIT_APPLICATION_PATHNAME: '/profile',
  INTEROP_EVIDENTIARY_DOCUMENT_PATHNAME: '/documents',
  INTEROP_EVIDENTIARY_DOCUMENT_UPLOAD_PATHNAME: '/clients/{clientId}/documents',
  INTEROP_API_MAX_RETRIES: 3,
  INTEROP_API_BACKOFF_MS: 0,
};

const benefitRequest = {
  BenefitApplication: {
    Applicant: {
      ApplicantDetail: {
        TermsAndConditionsIndicator: true,
        PrivacyStatementIndicator: true,
        SharingConsentIndicator: true,
        EligibilityAttestationIndicator: true,
        AccuracyConfirmationIndicator: true,
      },
      BenefitApplicationDetail: [],
      ClientIdentification: [],
      PersonBirthDate: { date: '2000-01-01' },
      PersonContactInformation: [],
      PersonLanguage: [],
      PersonMaritalStatus: { StatusCode: { ReferenceDataID: 'test' } },
      PersonName: [],
      PersonSINIdentification: { IdentificationID: 'test' },
      RelatedPerson: [],
      MailingSameAsHomeIndicator: true,
      PreferredMethodCommunicationCode: { ReferenceDataID: 'test' },
      PreferredMethodCommunicationGCCode: { ReferenceDataID: 'test' },
    },
    BenefitApplicationCategoryCode: { ReferenceDataID: 'test', ReferenceDataName: 'New' },
    BenefitApplicationChannelCode: { ReferenceDataID: 'test' },
    BenefitApplicationYear: { BenefitApplicationYearIdentification: [] },
  },
} as const satisfies BenefitApplicationRequestEntity & BenefitRenewalRequestEntity;

const profileRequest = {
  BenefitApplication: {
    Applicant: {
      ApplicantDetail: { ApplicantEmailVerifiedIndicator: true, InsurancePlan: [] },
      ClientIdentification: [],
      PersonContactInformation: [],
      MailingSameAsHomeIndicator: true,
      PersonLanguage: [],
      PreferredMethodCommunicationCode: { ReferenceDataID: 'test' },
      PreferredMethodCommunicationGCCode: { ReferenceDataID: 'test' },
    },
  },
} as const;

const benefitOperations = [
  {
    name: 'benefit application',
    submit: async (client: DefaultHttpClient) => await new DefaultBenefitApplicationRepository(serverConfig, client).createBenefitApplication(benefitRequest),
    errorCode: ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED,
  },
  {
    name: 'benefit renewal',
    submit: async (client: DefaultHttpClient) => await new DefaultBenefitRenewalRepository(serverConfig, client).createBenefitRenewal(benefitRequest),
    errorCode: ErrorCodes.API_BENEFIT_RENEWAL_CREATE_FAILED,
  },
];

const writeOperations = [
  ...benefitOperations,
  {
    name: 'communication preferences',
    submit: async (client: DefaultHttpClient) => await new DefaultProfileRepository(serverConfig, client).updateCommunicationPreferences(profileRequest),
    errorCode: ErrorCodes.API_PROF_COMMUNICATION_PREFERENCES_UPDATE_FAILED,
  },
  {
    name: 'phone numbers',
    submit: async (client: DefaultHttpClient) => await new DefaultProfileRepository(serverConfig, client).updatePhoneNumbers(profileRequest),
    errorCode: ErrorCodes.API_PROF_PHONE_NUMBERS_UPDATE_FAILED,
  },
  {
    name: 'email address',
    submit: async (client: DefaultHttpClient) => await new DefaultProfileRepository(serverConfig, client).updateEmailAddress(profileRequest),
    errorCode: ErrorCodes.API_PROF_EMAIL_ADDRESS_UPDATE_FAILED,
  },
  {
    name: 'dental benefits',
    submit: async (client: DefaultHttpClient) => await new DefaultProfileRepository(serverConfig, client).updateDentalBenefits(profileRequest),
    errorCode: ErrorCodes.API_PROF_DENTAL_BENEFITS_UPDATE_FAILED,
  },
  {
    name: 'addresses',
    submit: async (client: DefaultHttpClient) => await new DefaultProfileRepository(serverConfig, client).updateAddresses(profileRequest),
    errorCode: ErrorCodes.API_PROF_ADDRESSES_UPDATE_FAILED,
  },
  {
    name: 'evidentiary document metadata',
    submit: async (client: DefaultHttpClient) => await new DefaultEvidentiaryDocumentRepository(serverConfig, client).createEvidentiaryDocumentMetadata({ clientId: 'test', userId: 'test', documents: [] }),
    errorCode: ErrorCodes.API_DOC_EVIDENTIARY_METADATA_CREATE_FAILED,
  },
];

function createHttpClient(fetchFn: FetchFn): DefaultHttpClient {
  const client = new DefaultHttpClient(mock<InstrumentationService>());
  vi.spyOn(client, 'getFetchFn').mockReturnValue(fetchFn);
  return client;
}

describe.each(writeOperations)('$name', ({ submit, errorCode }) => {
  it('does not retry a transport error', async () => {
    const error = new TypeError('fetch failed', { cause: Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }) });
    const fetchFn = vi.fn<FetchFn>().mockRejectedValue(error);

    await expect(submit(createHttpClient(fetchFn))).rejects.toBe(error);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('does not retry a 502 response', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(new Response(null, { status: 502 }));

    await expect(submit(createHttpClient(fetchFn))).rejects.toMatchObject({ errorCode });
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

it.each(benefitOperations)('$name stops on a transport error after retrying a duplicate confirmation number', async ({ submit }) => {
  const error = new TypeError('fetch failed', { cause: Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }) });
  const fetchFn = vi
    .fn<FetchFn>()
    .mockResolvedValueOnce(new Response('A record with the same value for Application Confirmation Number already exists', { status: 400 }))
    .mockRejectedValue(error);

  await expect(submit(createHttpClient(fetchFn))).rejects.toBe(error);
  expect(fetchFn).toHaveBeenCalledTimes(2);
});

it('does not repeat an application POST when a redirect fails to connect', async () => {
  const agent = new MockAgent({ enableCallHistory: true });
  agent.disableNetConnect();
  const upstream = agent.get(serverConfig.INTEROP_API_BASE_URI);
  upstream
    .intercept({ path: '/applications', method: 'POST' })
    .reply(307, '', { headers: { location: '/redirected' } })
    .persist();
  upstream
    .intercept({ path: '/redirected', method: 'POST' })
    .replyWithError(Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }))
    .persist();

  try {
    const client = createHttpClient(async (input, init) => await fetch(input, { ...init, dispatcher: agent }));
    const repository = new DefaultBenefitApplicationRepository(serverConfig, client);

    await expect(repository.createBenefitApplication(benefitRequest)).rejects.toMatchObject({ cause: { code: 'ECONNREFUSED' } });
    expect(agent.getCallHistory()?.filterCallsByPath('/applications')).toHaveLength(1);
    expect(agent.getCallHistory()?.filterCallsByPath('/redirected')).toHaveLength(1);
  } finally {
    await agent.close();
  }
});
