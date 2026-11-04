import { render, screen, within } from '@testing-library/react';

import { MemoryRouter } from 'react-router';

import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

import enDocuments from '~/.server/locales/en/documents';
import enGcweb from '~/.server/locales/en/gcweb';
import frDocuments from '~/.server/locales/fr/documents';
import frGcweb from '~/.server/locales/fr/gcweb';
import { ClientEnvProvider } from '~/components/client-env-context';
import { DocumentUploadInstructions } from '~/routes/protected/documents/upload/components/upload-instructions';
import { clientEnvSchema } from '~/utils/env-utils';

vi.unmock(import('react-i18next'));

const formLinks = {
  en: 'https://updated.example.test/en/applicant-eligibility',
  fr: 'https://updated.example.test/fr/admissibilite-demandeur',
} as const;

it('defaults the configurable eligibility links to the current Canada.ca pages', () => {
  const env = clientEnvSchema.parse({});

  expect(env.DOCUMENT_UPLOAD_ELIGIBILITY_FORM_LINK_EN).toBe('https://www.canada.ca/en/services/benefits/dental/dental-care-plan/member-eligibility-review.html#h2.3');
  expect(env.DOCUMENT_UPLOAD_ELIGIBILITY_FORM_LINK_FR).toBe('https://www.canada.ca/fr/services/prestations/dentaire/regime-soins-dentaires/examen-admissibilite-membres.html#h2.3');
});

async function renderInstructions(locale: 'en' | 'fr') {
  const i18n = createInstance();
  await i18n.init({ lng: locale, fallbackLng: false, resources: { en: { documents: enDocuments, gcweb: enGcweb }, fr: { documents: frDocuments, gcweb: frGcweb } } });
  const env = clientEnvSchema.parse({
    DOCUMENT_UPLOAD_ELIGIBILITY_FORM_LINK_EN: formLinks.en,
    DOCUMENT_UPLOAD_ELIGIBILITY_FORM_LINK_FR: formLinks.fr,
  });

  return render(
    <I18nextProvider i18n={i18n}>
      <ClientEnvProvider env={env}>
        <MemoryRouter>
          <DocumentUploadInstructions />
        </MemoryRouter>
      </ClientEnvProvider>
    </I18nextProvider>,
  );
}

describe.each(['en', 'fr'] as const)('document upload instructions (%s)', (locale) => {
  it('uses the localized configurable eligibility link and Figma copy without changing limits or accepted types', async () => {
    await renderInstructions(locale);
    const english = locale === 'en';
    const chooseSection = screen.getByRole('heading', { name: english ? 'Choose your documents' : 'Choisir vos documents' }).closest('section');
    expect(chooseSection).not.toBeNull();
    const eligibilityLink = within(chooseSection!).getByRole('link', { name: english ? /^Applicant eligibility verification form/ : /^Formulaire de vérification de l'admissibilité du demandeur/ });
    expect(eligibilityLink).toHaveAttribute('href', formLinks[locale]);
    expect(eligibilityLink).toHaveAttribute('target', '_blank');
    expect(eligibilityLink).not.toHaveTextContent('(PDF)');
    expect(within(chooseSection!).getAllByRole('listitem')[0]).toHaveTextContent(
      english ? 'a completed Applicant eligibility verification form (opens in a new tab) (recommended)' : "un Formulaire de vérification de l'admissibilité du demandeur (s'ouvre dans un nouvel onglet) complété (recommandé)",
    );
    expect(chooseSection).toHaveTextContent(english ? 'Canadian Dental Care Plan member ID' : "numéro d'identification du membre du Régime canadien de soins dentaires");

    const uploadFiles = (locale === 'en' ? enDocuments : frDocuments).upload.uploadFiles;
    const expectedUploadFiles = english
      ? { maxFilesOne: 'You can upload one file', maxFilesOther: 'You can upload up to {{count}} files', maxSize: 'Each file must be {{filesize}} or smaller', acceptedTypes: 'Accepted file types: {{extensions}}' }
      : {
          maxFilesOne: 'Vous pouvez téléverser un fichier.',
          maxFilesOther: "Vous pouvez soumettre jusqu'à {{count}} fichiers à la fois.",
          maxSize: 'La taille maximale du fichier est de {{filesize}}.',
          acceptedTypes: 'Types de fichiers acceptés\u00A0: {{extensions}}',
        };
    expect(uploadFiles.maxFiles_one).toBe(expectedUploadFiles.maxFilesOne);
    expect(uploadFiles.maxFiles_other).toBe(expectedUploadFiles.maxFilesOther);
    expect(uploadFiles.maxSize).toBe(expectedUploadFiles.maxSize);
    expect(uploadFiles.acceptedTypes).toBe(expectedUploadFiles.acceptedTypes);
  });
});
