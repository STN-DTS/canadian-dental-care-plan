// @vitest-environment node

import { RouterContextProvider } from 'react-router';

import { Option } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AuditService } from '~/.server/audit/audit-service';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import type { AppContext } from '~/.server/context/app-context';
import { applicantContext } from '~/.server/context/applicant-context';
import type { ApplicantDto, LetterDto } from '~/.server/domain/dtos';
import type { LetterService, LetterTypeService } from '~/.server/domain/services';
import { findLettersState, setLettersState } from '~/.server/routes/helpers/letters-state-storage';
import { getLocale } from '~/.server/utils/locale-utils';
import type { Session } from '~/.server/web/session';
import { loader } from '~/routes/protected/letters/$id.download';

vi.mock(import('~/.server/routes/helpers/letters-state-storage'));
vi.mock(import('~/.server/utils/locale-utils'));

describe('protected/letters/$id.download loader', () => {
  const session = mock<Session>({ id: 'session-a' });
  const appContainer = mock<AppContext['appContainer']>();
  const letterService = mock<LetterService>();
  const letterTypeService = mock<LetterTypeService>();
  const auditService = mock<AuditService>();
  const applicant = { clientNumber: 'client-123' } as ApplicantDto;
  const letter: LetterDto = { id: 'letter-1', letterTypeId: 'type-1', date: '2026-07-01' };

  function createArgs(id = 'letter-1'): Parameters<typeof loader>[0] {
    const context = new RouterContextProvider();
    context.set(appContext, { appContainer, session });
    context.set(applicantContext, applicant);
    const url = new URL(`https://example.test/en/protected/letters/${id}/download`);
    return { context, params: { id, lang: 'en' }, url, request: new Request(url), pattern: '/:lang/protected/letters/:id/download' };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocale).mockReturnValue('en');
    vi.mocked(setLettersState).mockResolvedValue();
    appContainer.get.calledWith(TYPES.LetterService).mockReturnValue(letterService);
    appContainer.get.calledWith(TYPES.LetterTypeService).mockReturnValue(letterTypeService);
    appContainer.get.calledWith(TYPES.AuditService).mockReturnValue(auditService);
    letterTypeService.listLetterTypes.mockResolvedValue([{ id: 'type-1', nameEn: 'Notice', nameFr: 'Avis' }]);
    letterTypeService.getLocalizedLetterTypeById.mockResolvedValue({ id: 'type-1', name: 'Notice' });
    letterService.getPdfByLetterId.mockResolvedValue(Buffer.from('%PDF-1.4').toString('base64'));
  });

  it('serves the PDF from cached letters without refetching the list', async () => {
    vi.mocked(findLettersState).mockResolvedValue(Option.some([letter]));

    const response = await loader(createArgs('letter-1'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(letterService.findLettersByClientId).not.toHaveBeenCalled();
    expect(setLettersState).not.toHaveBeenCalled();
  });

  it('refetches and re-caches letters when the cache has expired', async () => {
    vi.mocked(findLettersState).mockResolvedValue(Option.none());
    letterService.findLettersByClientId.mockResolvedValue([letter, { id: 'ignored', letterTypeId: 'unknown', date: '2026-07-01' }]);

    const response = await loader(createArgs('letter-1'));

    expect(response.status).toBe(200);
    expect(letterService.findLettersByClientId).toHaveBeenCalledExactlyOnceWith({ clientId: 'client-123', sortOrder: 'desc' });
    expect(setLettersState).toHaveBeenCalledExactlyOnceWith(session, [letter]);
  });

  it('throws 404 when the requested letter does not belong to the user after refetch', async () => {
    vi.mocked(findLettersState).mockResolvedValue(Option.none());
    letterService.findLettersByClientId.mockResolvedValue([letter]);

    await expect(loader(createArgs('other-letter'))).rejects.toMatchObject({ init: { status: 404 } });
    expect(letterService.getPdfByLetterId).not.toHaveBeenCalled();
  });
});
