import { Trans, useTranslation } from 'react-i18next';

import { InlineLink } from '~/components/inline-link';

export function DocumentUploadInstructions() {
  const { t } = useTranslation('documents');
  const eligibilityFormLink = <InlineLink to={t(($) => $.upload.chooseDocuments.eligibilityFormHref)} className="external-link" newTabIndicator target="_blank" />;

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
