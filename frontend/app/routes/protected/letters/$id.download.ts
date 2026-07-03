import { data } from 'react-router';

import { create } from 'content-disposition';
import { Buffer } from 'node:buffer';

import type { Route } from './+types/$id.download';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getLocale } from '~/.server/utils/locale.utils';
import type { IdToken, UserinfoToken } from '~/.server/utils/raoidc.utils';

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('view-letters');
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  if (!params.id) {
    throw data(null, { status: 400 });
  }

  const lettersOption = session.find('letters');

  // Optional TODO: add a check to see if the letter belongs to the user. (Done with LetterService call)
  if (lettersOption.isNone()) {
    throw data(null, { status: 404 });
  }

  const letter = lettersOption.unwrap().find((letter) => letter.id === params.id);

  if (!letter) {
    throw data(null, { status: 404 });
  }

  const locale = getLocale(url);
  const letterType = await appContainer.get(TYPES.LetterTypeService).getLocalizedLetterTypeById(letter.letterTypeId, locale);
  const documentName = `${letterType.name}.pdf`;

  const userInfoToken: UserinfoToken = session.get('userInfoToken');

  const pdfBytes = await appContainer.get(TYPES.LetterService).getPdfByLetterId({ letterId: params.id, userId: userInfoToken.sub });

  const idToken: IdToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('download.letter', { userId: idToken.sub });

  const decodedPdfBytes = Buffer.from(pdfBytes, 'base64');
  return new Response(decodedPdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': decodedPdfBytes.length.toString(),
      'Content-Disposition': create(documentName, { type: 'inline' }),
    },
  });
}
