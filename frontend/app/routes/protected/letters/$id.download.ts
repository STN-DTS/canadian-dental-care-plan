import { data } from 'react-router';

import { create } from 'content-disposition';
import { Option } from 'effect';
import { Buffer } from 'node:buffer';

import { AUDIT_EVENT_DOWNLOAD_LETTER } from '~/.server/audit/audit-event-ids';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import { getApplicant } from '~/.server/context/applicant-context';
import { findLettersState, setLettersState } from '~/.server/routes/helpers/letters-state-storage';
import { getLocale } from '~/.server/utils/locale-utils';

import type { Route } from './+types/$id.download';

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);

  if (!params.id) {
    throw data(null, { status: 400 });
  }

  const lettersOption = await findLettersState(session);
  let letters = Option.getOrUndefined(lettersOption);

  if (!letters) {
    const applicant = getApplicant(context);
    const [allLetters, letterTypes] = await Promise.all([appContainer.get(TYPES.LetterService).findLettersByClientId({ clientId: applicant.clientNumber, sortOrder: 'desc' }), appContainer.get(TYPES.LetterTypeService).listLetterTypes()]);
    letters = allLetters.filter(({ letterTypeId }) => letterTypes.some(({ id }) => letterTypeId === id));
    await setLettersState(session, letters);
  }

  const letter = letters.find((letter) => letter.id === params.id);

  if (!letter) {
    throw data(null, { status: 404 });
  }

  const locale = getLocale(url);
  const letterType = await appContainer.get(TYPES.LetterTypeService).getLocalizedLetterTypeById(letter.letterTypeId, locale);
  const documentName = `${letterType.name}.pdf`;

  const pdfBytes = await appContainer.get(TYPES.LetterService).getPdfByLetterId({ letterId: params.id });

  appContainer.get(TYPES.AuditService).createAudit(AUDIT_EVENT_DOWNLOAD_LETTER);

  const decodedPdfBytes = Buffer.from(pdfBytes, 'base64');
  return new Response(decodedPdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': decodedPdfBytes.length.toString(),
      'Content-Disposition': create(documentName, { type: 'inline' }),
    },
  });
}
