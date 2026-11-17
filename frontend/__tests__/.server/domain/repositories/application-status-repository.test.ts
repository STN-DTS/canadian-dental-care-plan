import { Redacted } from 'effect';
import { Response } from 'undici';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultApplicationStatusRepository, MOCK_TOO_MANY_REQUESTS_APPLICATION_CODE, MockApplicationStatusRepository } from '~/.server/domain/repositories/application-status-repository';
import type { HttpClient } from '~/.server/http';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

function requestFor(applicationCode: string) {
  return {
    BenefitApplication: {
      Applicant: {
        ClientIdentification: [{ IdentificationID: applicationCode }],
        PersonSINIdentification: { IdentificationID: '800000002' },
        PersonName: [{ PersonGivenName: ['John'], PersonSurName: 'Doe' }],
        PersonBirthDate: { date: '2000-01-01' },
      },
    },
  };
}

describe('MockApplicationStatusRepository', () => {
  const repository = new MockApplicationStatusRepository();

  it.each([
    ['getApplicationStatusBySin', ErrorCodes.API_STATUS_FIND_BY_SIN_RATE_LIMITED, async () => await repository.getApplicationStatusBySin(requestFor(MOCK_TOO_MANY_REQUESTS_APPLICATION_CODE))],
    ['getApplicationStatusByBasicInfo', ErrorCodes.API_STATUS_FIND_BY_BASIC_INFO_RATE_LIMITED, async () => await repository.getApplicationStatusByBasicInfo(requestFor(MOCK_TOO_MANY_REQUESTS_APPLICATION_CODE))],
  ])('%s fails like an interop API 429 for the reserved application code', async (_, errorCode, lookup) => {
    const error = await lookup().catch((error: unknown) => error);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ errorCode, message: expect.stringContaining('Status: 429') });
  });

  it('returns a status for other application codes', async () => {
    const status = await repository.getApplicationStatusBySin(requestFor('000001'));

    expect(status.BenefitApplication.BenefitApplicationStatus[0]?.ReferenceDataID).toEqual(expect.any(String));
  });
});

describe('DefaultApplicationStatusRepository', () => {
  it.each([
    ['getApplicationStatusBySin', ErrorCodes.API_STATUS_FIND_BY_SIN_RATE_LIMITED, async (repository: DefaultApplicationStatusRepository) => await repository.getApplicationStatusBySin(requestFor('000001'))],
    ['getApplicationStatusByBasicInfo', ErrorCodes.API_STATUS_FIND_BY_BASIC_INFO_RATE_LIMITED, async (repository: DefaultApplicationStatusRepository) => await repository.getApplicationStatusByBasicInfo(requestFor('000001'))],
  ])('%s uses its operation-specific rate-limit code', async (_, errorCode, lookup) => {
    const httpClient = mock<HttpClient>();
    httpClient.instrumentedFetch.mockResolvedValue(new Response('', { status: 429 }));
    const config = {
      HEALTH_PLACEHOLDER_REQUEST_VALUE: '000001',
      HTTP_PROXY_URL: undefined,
      INTEROP_API_BASE_URI: 'https://api.example.com',
      INTEROP_API_SUBSCRIPTION_KEY: Redacted.make('SUBSCRIPTION_KEY'),
      INTEROP_STATUS_CHECK_API_BASE_URI: undefined,
      INTEROP_STATUS_CHECK_API_SUBSCRIPTION_KEY: undefined,
      INTEROP_API_MAX_RETRIES: 0,
      INTEROP_API_BACKOFF_MS: 0,
    } satisfies ConstructorParameters<typeof DefaultApplicationStatusRepository>[0];
    const repository = new DefaultApplicationStatusRepository(config, httpClient);

    await expect(lookup(repository)).rejects.toMatchObject({ errorCode });
  });
});
