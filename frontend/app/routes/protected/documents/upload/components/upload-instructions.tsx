import { Trans, useTranslation } from 'react-i18next';

import { InlineLink } from '~/components/inline-link';
import { useClientEnv } from '~/hooks/use-client-env';

export function DocumentUploadInstructions() {
  const { t, i18n } = useTranslation('documents');
  const { DOCUMENT_UPLOAD_ELIGIBILITY_FORM_LINK_EN, DOCUMENT_UPLOAD_ELIGIBILITY_FORM_LINK_FR } = useClientEnv();
  const eligibilityFormHref = i18n.language.toLowerCase().startsWith('fr') ? DOCUMENT_UPLOAD_ELIGIBILITY_FORM_LINK_FR : DOCUMENT_UPLOAD_ELIGIBILITY_FORM_LINK_EN;
  const eligibilityFormLink = <InlineLink to={eligibilityFormHref} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <p>{t(($) => $.upload.intro)}</p>
      <section className="space-y-4">
        <h2 className="font-lato text-2xl font-bold">{t(($) => $.upload.chooseDocuments.title)}</h2>
        <p>{t(($) => $.upload.chooseDocuments.canUpload)}</p>
        <ul className="list-disc space-y-1 pl-7">
          <li>
            <Trans ns="documents" i18nKey={($) => $.upload.chooseDocuments.list.eligibilityForm} components={{ eligibilityFormLink }} />
          </li>
          <li>{t(($) => $.upload.chooseDocuments.list.letter)}</li>
          <li>{t(($) => $.upload.chooseDocuments.list.proof)}</li>
        </ul>
        <p>{t(($) => $.upload.chooseDocuments.mustInclude)}</p>
        <ul className="list-disc space-y-1 pl-7">
          <li>{t(($) => $.upload.chooseDocuments.mustIncludeList.name)}</li>
          <li>{t(($) => $.upload.chooseDocuments.mustIncludeList.memberId)}</li>
          <li>{t(($) => $.upload.chooseDocuments.mustIncludeList.signature)}</li>
        </ul>
      </section>
    </>
  );
}
