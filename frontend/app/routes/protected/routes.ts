import type { I18nRoute } from '~/routes/routes';

export const routes = [
  {
    file: 'routes/protected/layout.tsx',
    children: [
      {
        file: 'routes/protected/application/base-layout.tsx',
        children: [
          {
            id: 'protected/application/index',
            file: 'routes/protected/application/index.tsx',
            paths: { en: '/:lang/protected/application', fr: '/:lang/protege/demande' },
          },
          {
            file: 'routes/protected/application/layout.tsx',
            children: [
              {
                id: 'protected/application/$id/eligibility-requirements',
                file: 'routes/protected/application/entry/eligibility-requirements.tsx',
                paths: { en: '/:lang/protected/application/:id/eligibility-requirements', fr: '/:lang/protege/demande/:id/criteres-admissibilite' },
              },
              {
                id: 'protected/application/$id/your-application',
                file: 'routes/protected/application/entry/your-application.tsx',
                paths: { en: '/:lang/protected/application/:id/your-application', fr: '/:lang/protege/demande/:id/votre-demande' },
              },
              {
                id: 'protected/application/$id/renew',
                file: 'routes/protected/application/entry/renew.tsx',
                paths: { en: '/:lang/protected/application/:id/renew', fr: '/:lang/protege/demande/:id/renouveler' },
              },
              {
                id: 'protected/application/$id/intake-adult/marital-status',
                file: 'routes/protected/application/intake-adult/marital-status.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/adult/marital-status', fr: '/:lang/protege/demande/:id/admission/adulte/etat-civil' },
              },
              {
                id: 'protected/application/$id/intake-adult/dental-insurance',
                file: 'routes/protected/application/intake-adult/dental-insurance.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/adult/dental-insurance', fr: '/:lang/protege/demande/:id/admission/adulte/assurance-dentaire' },
              },
              {
                id: 'protected/application/$id/intake-adult/contact-information',
                file: 'routes/protected/application/intake-adult/contact-information.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/adult/contact-information', fr: '/:lang/protege/demande/:id/admission/adulte/coordonnees' },
              },
              {
                id: 'protected/application/$id/intake-adult/submit',
                file: 'routes/protected/application/intake-adult/submit.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/adult/submit', fr: '/:lang/protege/demande/:id/admission/adulte/soumettre' },
              },
              {
                id: 'protected/application/$id/intake-adult/exit-application',
                file: 'routes/protected/application/intake-adult/exit-application.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/adult/exit-application', fr: '/:lang/protege/demande/:id/admission/adulte/quitter-demande' },
              },
              {
                id: 'protected/application/$id/intake-adult/confirmation',
                file: 'routes/protected/application/intake-adult/confirmation.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/adult/confirmation', fr: '/:lang/protege/demande/:id/admission/adulte/confirmation' },
              },

              {
                id: 'protected/application/$id/intake-children/parent-or-guardian',
                file: 'routes/protected/application/intake-children/parent-or-guardian.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/children/parent-or-guardian', fr: '/:lang/protege/demande/:id/admission/enfants/parent-ou-tuteur' },
              },
              {
                id: 'protected/application/$id/intake-children/submit',
                file: 'routes/protected/application/intake-children/submit.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/children/submit', fr: '/:lang/protege/demande/:id/admission/enfants/soumettre' },
              },
              {
                id: 'protected/application/$id/intake-children/exit-application',
                file: 'routes/protected/application/intake-children/exit-application.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/children/exit-application', fr: '/:lang/protege/demande/:id/admission/enfants/quitter-demande' },
              },
              {
                id: 'protected/application/$id/intake-children/confirmation',
                file: 'routes/protected/application/intake-children/confirmation.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/children/confirmation', fr: '/:lang/protege/demande/:id/admission/enfants/confirmation' },
              },
              {
                id: 'protected/application/$id/intake-children/childrens-application',
                file: 'routes/protected/application/intake-children/childrens-application.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/children/childrens-application', fr: '/:lang/protege/demande/:id/admission/enfants/demande-enfants' },
              },

              {
                id: 'protected/application/$id/intake-family/marital-status',
                file: 'routes/protected/application/intake-family/marital-status.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/family/marital-status', fr: '/:lang/protege/demande/:id/admission/famille/etat-civil' },
              },
              {
                id: 'protected/application/$id/intake-family/contact-information',
                file: 'routes/protected/application/intake-family/contact-information.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/family/contact-information', fr: '/:lang/protege/demande/:id/admission/famille/coordonnees' },
              },
              {
                id: 'protected/application/$id/intake-family/dental-insurance',
                file: 'routes/protected/application/intake-family/dental-insurance.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/family/dental-insurance', fr: '/:lang/protege/demande/:id/admission/famille/assurance-dentaire' },
              },
              {
                id: 'protected/application/$id/intake-family/childrens-application',
                file: 'routes/protected/application/intake-family/childrens-application.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/family/childrens-application', fr: '/:lang/protege/demande/:id/admission/famille/demande-enfants' },
              },
              {
                id: 'protected/application/$id/intake-family/confirmation',
                file: 'routes/protected/application/intake-family/confirmation.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/family/confirmation', fr: '/:lang/protege/demande/:id/admission/famille/confirmation' },
              },
              {
                id: 'protected/application/$id/intake-family/submit',
                file: 'routes/protected/application/intake-family/submit.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/family/submit', fr: '/:lang/protege/demande/:id/admission/famille/soumettre' },
              },
              {
                id: 'protected/application/$id/intake-family/exit-application',
                file: 'routes/protected/application/intake-family/exit-application.tsx',
                paths: { en: '/:lang/protected/application/:id/intake/family/exit-application', fr: '/:lang/protege/demande/:id/admission/famille/quitter-demande' },
              },
              {
                id: 'protected/application/$id/renewal-adult/marital-status',
                file: 'routes/protected/application/renewal-adult/marital-status.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/adult/marital-status', fr: '/:lang/protege/demande/:id/renouvellement/adulte/etat-civil' },
              },
              {
                id: 'protected/application/$id/renewal-adult/contact-information',
                file: 'routes/protected/application/renewal-adult/contact-information.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/adult/contact-information', fr: '/:lang/protege/demande/:id/renouvellement/adulte/coordonnees' },
              },
              {
                id: 'protected/application/$id/renewal-adult/dental-insurance',
                file: 'routes/protected/application/renewal-adult/dental-insurance.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/adult/dental-insurance', fr: '/:lang/protege/demande/:id/renouvellement/adulte/assurance-dentaire' },
              },
              {
                id: 'protected/application/$id/renewal-adult/submit',
                file: 'routes/protected/application/renewal-adult/submit.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/adult/submit', fr: '/:lang/protege/demande/:id/renouvellement/adulte/soumettre' },
              },
              {
                id: 'protected/application/$id/renewal-adult/confirmation',
                file: 'routes/protected/application/renewal-adult/confirmation.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/adult/confirmation', fr: '/:lang/protege/demande/:id/renouvellement/adulte/confirmation' },
              },
              {
                id: 'protected/application/$id/renewal-adult/exit-application',
                file: 'routes/protected/application/renewal-adult/exit-application.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/adult/exit-application', fr: '/:lang/protege/demande/:id/renouvellement/adulte/quitter-demande' },
              },

              {
                id: 'protected/application/$id/renewal-children/parent-or-guardian',
                file: 'routes/protected/application/renewal-children/parent-or-guardian.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/children/parent-or-guardian', fr: '/:lang/protege/demande/:id/renouvellement/enfants/parent-ou-tuteur' },
              },
              {
                id: 'protected/application/$id/renewal-children/submit',
                file: 'routes/protected/application/renewal-children/submit.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/children/submit', fr: '/:lang/protege/demande/:id/renouvellement/enfants/soumettre' },
              },
              {
                id: 'protected/application/$id/renewal-children/exit-application',
                file: 'routes/protected/application/renewal-children/exit-application.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/children/exit-application', fr: '/:lang/protege/demande/:id/renouvellement/enfants/quitter-demande' },
              },
              {
                id: 'protected/application/$id/renewal-children/childrens-application',
                file: 'routes/protected/application/renewal-children/childrens-application.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/children/childrens-application', fr: '/:lang/protege/demande/:id/renouvellement/enfants/demande-enfants' },
              },
              {
                id: 'protected/application/$id/renewal-children/confirmation',
                file: 'routes/protected/application/renewal-children/confirmation.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/children/confirmation', fr: '/:lang/protege/demande/:id/renouvellement/enfants/confirmation' },
              },
              {
                id: 'protected/application/$id/renewal-family/marital-status',
                file: 'routes/protected/application/renewal-family/marital-status.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/family/marital-status', fr: '/:lang/protege/demande/:id/renouvellement/famille/etat-civil' },
              },
              {
                id: 'protected/application/$id/renewal-family/contact-information',
                file: 'routes/protected/application/renewal-family/contact-information.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/family/contact-information', fr: '/:lang/protege/demande/:id/renouvellement/famille/coordonnees' },
              },
              {
                id: 'protected/application/$id/renewal-family/dental-insurance',
                file: 'routes/protected/application/renewal-family/dental-insurance.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/family/dental-insurance', fr: '/:lang/protege/demande/:id/renouvellement/famille/assurance-dentaire' },
              },
              {
                id: 'protected/application/$id/renewal-family/childrens-application',
                file: 'routes/protected/application/renewal-family/childrens-application.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/family/childrens-application', fr: '/:lang/protege/demande/:id/renouvellement/famille/demande-enfants' },
              },
              {
                id: 'protected/application/$id/renewal-family/submit',
                file: 'routes/protected/application/renewal-family/submit.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/family/submit', fr: '/:lang/protege/demande/:id/renouvellement/famille/soumettre' },
              },
              {
                id: 'protected/application/$id/renewal-family/confirmation',
                file: 'routes/protected/application/renewal-family/confirmation.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/family/confirmation', fr: '/:lang/protege/demande/:id/renouvellement/famille/confirmation' },
              },
              {
                id: 'protected/application/$id/renewal-family/exit-application',
                file: 'routes/protected/application/renewal-family/exit-application.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal/family/exit-application', fr: '/:lang/protege/demande/:id/renouvellement/famille/quitter-demande' },
              },

              // spokes
              {
                id: 'protected/application/$id/application-delegate',
                file: 'routes/protected/application/spokes/application-delegate.tsx',
                paths: { en: '/:lang/protected/application/:id/application-delegate', fr: '/:lang/protege/demande/:id/delegue-demande' },
              },
              {
                id: 'protected/application/$id/new-or-returning-member',
                file: 'routes/protected/application/spokes/new-or-returning-member.tsx',
                paths: { en: '/:lang/protected/application/:id/new-or-returning-member', fr: '/:lang/protege/demande/:id/membre-nouveau-ou-actuel' },
              },
              { id: 'protected/application/$id/file-taxes', file: 'routes/protected/application/spokes/file-taxes.tsx', paths: { en: '/:lang/protected/application/:id/file-taxes', fr: '/:lang/protege/demande/:id/produire-declaration-revenus' } },
              { id: 'protected/application/$id/marital-status', file: 'routes/protected/application/spokes/marital-status.tsx', paths: { en: '/:lang/protected/application/:id/marital-status', fr: '/:lang/protege/demande/:id/etat-civil' } },
              { id: 'protected/application/$id/dental-insurance', file: 'routes/protected/application/spokes/dental-insurance.tsx', paths: { en: '/:lang/protected/application/:id/dental-insurance', fr: '/:lang/protege/demande/:id/assurance-dentaire' } },
              {
                id: 'protected/application/$id/dental-insurance-exit-application',
                file: 'routes/protected/application/spokes/dental-insurance-exit-application.tsx',
                paths: { en: '/:lang/protected/application/:id/dental-insurance-exit-application', fr: '/:lang/protege/demande/:id/quitter-demande-assurance-dentaire' },
              },
              { id: 'protected/application/$id/tax-filing', file: 'routes/protected/application/spokes/tax-filing.tsx', paths: { en: '/:lang/protected/application/:id/tax-filing', fr: '/:lang/protege/demande/:id/declaration-impot' } },
              {
                id: 'protected/application/$id/renewal-selection',
                file: 'routes/protected/application/spokes/renewal-selection.tsx',
                paths: { en: '/:lang/protected/application/:id/renewal-selection', fr: '/:lang/protege/demande/:id/selection-renouvellement' },
              },
              {
                id: 'protected/application/$id/terms-conditions',
                file: 'routes/protected/application/spokes/terms-conditions.tsx',
                paths: { en: '/:lang/protected/application/:id/terms-conditions', fr: '/:lang/protege/demande/:id/conditions-utilisation' },
              },
              { id: 'protected/application/$id/type-application', file: 'routes/protected/application/spokes/type-application.tsx', paths: { en: '/:lang/protected/application/:id/type-application', fr: '/:lang/protege/demande/:id/type-demande' } },
              {
                id: 'protected/application/$id/personal-information',
                file: 'routes/protected/application/spokes/personal-information.tsx',
                paths: { en: '/:lang/protected/application/:id/personal-information', fr: '/:lang/protege/demande/:id/renseignements-personnels' },
              },
              {
                id: 'protected/application/$id/federal-provincial-territorial-benefits',
                file: 'routes/protected/application/spokes/federal-provincial-territorial-benefits.tsx',
                paths: { en: '/:lang/protected/application/:id/federal-provincial-territorial-benefits', fr: '/:lang/protege/demande/:id/prestations-dentaires-federales-provinciales-territoriales' },
              },
              {
                id: 'protected/application/$id/living-independently',
                file: 'routes/protected/application/spokes/living-independently.tsx',
                paths: { en: '/:lang/protected/application/:id/living-independently', fr: '/:lang/protege/demande/:id/vivre-maniere-independante' },
              },
              {
                id: 'protected/application/$id/parent-or-guardian',
                file: 'routes/protected/application/spokes/parent-or-guardian.tsx',
                paths: { en: '/:lang/protected/application/:id/parent-or-guardian', fr: '/:lang/protege/demande/:id/parent-ou-tuteur' },
              },
              { id: 'protected/application/$id/phone-number', file: 'routes/protected/application/spokes/phone-number.tsx', paths: { en: '/:lang/protected/application/:id/phone-number', fr: '/:lang/protege/demande/:id/numero-telephone' } },
              { id: 'protected/application/$id/mailing-address', file: 'routes/protected/application/spokes/mailing-address.tsx', paths: { en: '/:lang/protected/application/:id/mailing-address', fr: '/:lang/protege/demande/:id/adresse-postale' } },
              { id: 'protected/application/$id/home-address', file: 'routes/protected/application/spokes/home-address.tsx', paths: { en: '/:lang/protected/application/:id/home-address', fr: '/:lang/protege/demande/:id/adresse-domicile' } },
              {
                id: 'protected/application/$id/communication-preferences',
                file: 'routes/protected/application/spokes/communication-preferences.tsx',
                paths: { en: '/:lang/protected/application/:id/communication-preferences', fr: '/:lang/protege/demande/:id/preference-communication' },
              },
              { id: 'protected/application/$id/email', file: 'routes/protected/application/spokes/email.tsx', paths: { en: '/:lang/protected/application/:id/email', fr: '/:lang/protege/demande/:id/adresse-courriel' } },
              { id: 'protected/application/$id/verify-email', file: 'routes/protected/application/spokes/verify-email.tsx', paths: { en: '/:lang/protected/application/:id/verify-email', fr: '/:lang/protege/demande/:id/verifier-courriel' } },
              {
                id: 'protected/application/$id/children/$childId/information',
                file: 'routes/protected/application/spokes/child-information.tsx',
                paths: { en: '/:lang/protected/application/:id/children/:childId/information', fr: '/:lang/protege/demande/:id/enfant/:childId/information' },
              },
              {
                id: 'protected/application/$id/children/$childId/parent-or-guardian',
                file: 'routes/protected/application/spokes/child-parent-guardian.tsx',
                paths: { en: '/:lang/protected/application/:id/children/:childId/parent-or-guardian', fr: '/:lang/protege/demande/:id/enfant/:childId/parent-ou-tuteur' },
              },
              {
                id: 'protected/application/$id/children/$childId/cannot-apply-child',
                file: 'routes/protected/application/spokes/cannot-apply-child.tsx',
                paths: { en: '/:lang/protected/application/:id/children/:childId/cannot-apply-child', fr: '/:lang/protege/demande/:id/enfant/:childId/pas-demande-enfant' },
              },
              {
                id: 'protected/application/$id/children/$childId/federal-provincial-territorial-benefits',
                file: 'routes/protected/application/spokes/child-federal-provincial-territorial-benefits.tsx',
                paths: { en: '/:lang/protected/application/:id/children/:childId/federal-provincial-territorial-benefits', fr: '/:lang/protege/demande/:id/enfant/:childId/prestations-dentaires-federales-provinciales-territoriales' },
              },
              {
                id: 'protected/application/$id/children/$childId/dental-insurance',
                file: 'routes/protected/application/spokes/child-dental-insurance.tsx',
                paths: { en: '/:lang/protected/application/:id/children/:childId/dental-insurance', fr: '/:lang/protege/demande/:id/enfant/:childId/assurance-dentaire' },
              },
              {
                id: 'protected/application/$id/children/$childId/parent-guardian',
                file: 'routes/protected/application/spokes/parent-guardian.tsx',
                paths: { en: '/:lang/protected/application/:id/children/:childId/parent-guardian', fr: '/:lang/protege/demande/:id/enfant/:childId/parent-tuteur' },
              },
              {
                id: 'protected/application/$id/children/$childId/social-insurance-number',
                file: 'routes/protected/application/spokes/child-social-insurance-number.tsx',
                paths: { en: '/:lang/protected/application/:id/children/:childId/social-insurance-number', fr: '/:lang/protege/demande/:id/enfant/:childId/numero-assurance-sociale' },
              },
            ],
          },
        ],
      },
      // NOTE: protected application that has no application state, therefore not nested under the application layout
      {
        id: 'protected/application/renewal-submitted',
        file: 'routes/protected/application/renewal-submitted.tsx',
        paths: { en: '/:lang/protected/application/renewal-submitted', fr: '/:lang/protege/demande/renouvellement-soumise' },
      },
      {
        id: 'protected/data-unavailable',
        file: 'routes/protected/data-unavailable.tsx',
        paths: { en: '/:lang/protected/data-unavailable', fr: '/:lang/protege/donnees-indisponibles' },
      },
      {
        id: 'protected/documents/layout',
        file: 'routes/protected/documents/layout.tsx',
        children: [
          {
            id: 'protected/documents/index',
            file: 'routes/protected/documents/index.tsx',
            paths: { en: '/:lang/protected/documents', fr: '/:lang/protege/documents' },
          },
          {
            id: 'protected/documents/upload',
            file: 'routes/protected/documents/upload.tsx',
            paths: { en: '/:lang/protected/documents/upload', fr: '/:lang/protege/documents/televerser' },
          },
          {
            id: 'protected/documents/not-required',
            file: 'routes/protected/documents/not-required.tsx',
            paths: { en: '/:lang/protected/documents/not-required', fr: '/:lang/protege/documents/non-requis' },
          },
          {
            id: 'protected/documents/submitted',
            file: 'routes/protected/documents/submitted.tsx',
            paths: { en: '/:lang/protected/documents/submitted', fr: '/:lang/protege/documents/soumis' },
          },
        ],
      },
      {
        id: 'protected/unable-to-process-request',
        file: 'routes/protected/unable-to-process-request.tsx',
        paths: { en: '/:lang/protected/unable-to-process-request', fr: '/:lang/protege/impossible-de-traiter-la-demande' },
      },
      {
        id: 'protected/letters/index',
        file: 'routes/protected/letters/index.tsx',
        paths: { en: '/:lang/protected/letters', fr: '/:lang/protege/lettres' },
      },
      {
        id: 'protected/letters/$id.download',
        file: 'routes/protected/letters/$id.download.ts',
        paths: { en: '/:lang/protected/letters/:id/download', fr: '/:lang/protege/lettres/:id/telecharger' },
      },
      {
        id: 'protected/profile/eligibility',
        file: 'routes/protected/profile/eligibility.tsx',
        paths: { en: '/:lang/protected/profile/eligibility', fr: '/:lang/protege/profil/admissibilite' },
      },
      {
        id: 'protected/profile/applicant-information',
        file: 'routes/protected/profile/applicant-information.tsx',
        paths: { en: '/:lang/protected/profile/applicant', fr: '/:lang/protege/profil/demandeur' },
      },
      {
        id: 'protected/profile/dental-benefits',
        file: 'routes/protected/profile/dental-benefits.tsx',
        paths: { en: '/:lang/protected/profile/dental-benefits', fr: '/:lang/protege/profil/prestations-dentaires' },
      },
      {
        id: 'protected/profile/dental-benefits/edit',
        file: 'routes/protected/profile/edit-dental-benefits.tsx',
        paths: { en: '/:lang/protected/profile/dental-benefits/edit', fr: '/:lang/protege/profil/prestations-dentaires/modifier' },
      },
      {
        id: 'protected/profile/dental-benefits/:childId/edit',
        file: 'routes/protected/profile/edit-child-dental-benefits.tsx',
        paths: { en: '/:lang/protected/profile/dental-benefits/:childId/edit', fr: '/:lang/protege/profil/prestations-dentaires/:childId/modifier' },
      },
      {
        id: 'protected/profile/communication-preferences',
        file: 'routes/protected/profile/communication-preferences.tsx',
        paths: { en: '/:lang/protected/profile/communication-preferences', fr: '/:lang/protege/profil/preferences-communication' },
      },
      {
        id: 'protected/profile/communication-preferences/edit',
        file: 'routes/protected/profile/edit-communication-preferences.tsx',
        paths: { en: '/:lang/protected/profile/communication-preferences/edit', fr: '/:lang/protege/profil/preferences-communication/modifier' },
      },
      {
        id: 'protected/profile/contact/phone',
        file: 'routes/protected/profile/phone-number.tsx',
        paths: { en: '/:lang/protected/profile/contact/phone', fr: '/:lang/protege/profil/coordonnees/telephone' },
      },
      {
        id: 'protected/profile/contact-information',
        file: 'routes/protected/profile/contact-information.tsx',
        paths: { en: '/:lang/protected/profile/contact', fr: '/:lang/protege/profil/coordonnees' },
      },
      {
        id: 'protected/profile/contact/email-address',
        file: 'routes/protected/profile/email.tsx',
        paths: { en: '/:lang/protected/profile/contact/email-address', fr: '/:lang/protege/profil/coordonnees/adresse-courriel' },
      },
      {
        id: 'protected/profile/contact/email-address/verify',
        file: 'routes/protected/profile/verify-email.tsx',
        paths: { en: '/:lang/protected/profile/contact/email-address/verify', fr: '/:lang/protege/profil/coordonnees/adresse-courriel/verifier' },
      },
      {
        id: 'protected/profile/contact/mailing-address',
        file: 'routes/protected/profile/mailing-address.tsx',
        paths: { en: '/:lang/protected/profile/contact/mailing-address', fr: '/:lang/protege/profil/coordonnees/adresse-postale' },
      },
      {
        id: 'protected/profile/contact/home-address',
        file: 'routes/protected/profile/home-address.tsx',
        paths: { en: '/:lang/protected/profile/contact/home-address', fr: '/:lang/protege/profil/coordonnees/adresse-domicile' },
      },
    ],
  },
] as const satisfies I18nRoute[];
