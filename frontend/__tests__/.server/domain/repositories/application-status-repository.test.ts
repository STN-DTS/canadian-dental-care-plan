import { describe, expect, it } from 'vitest';

import { MOCK_TOO_MANY_REQUESTS_APPLICATION_CODE, MockApplicationStatusRepository } from '~/.server/domain/repositories/application-status-repository';
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
    ['getApplicationStatusBySin', async () => await repository.getApplicationStatusBySin(requestFor(MOCK_TOO_MANY_REQUESTS_APPLICATION_CODE))],
    ['getApplicationStatusByBasicInfo', async () => await repository.getApplicationStatusByBasicInfo(requestFor(MOCK_TOO_MANY_REQUESTS_APPLICATION_CODE))],
  ])('%s fails like an interop API 429 for the reserved application code', async (_, lookup) => {
    const error = await lookup().catch((error: unknown) => error);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ errorCode: ErrorCodes.XAPI_TOO_MANY_REQUESTS, message: expect.stringContaining('Status: 429') });
  });

  it('returns a status for other application codes', async () => {
    const status = await repository.getApplicationStatusBySin(requestFor('000001'));

    expect(status.BenefitApplication.BenefitApplicationStatus[0]?.ReferenceDataID).toEqual(expect.any(String));
  });
});
