import type { LiteralToPrimitiveDeep } from 'type-fest';

import applicationEn from '~/.server/locales/en/application';
import applicationFullAdultEn from '~/.server/locales/en/application-full-adult';
import applicationFullChildEn from '~/.server/locales/en/application-full-child';
import applicationFullFamilyEn from '~/.server/locales/en/application-full-family';
import applicationSimplifiedAdultEn from '~/.server/locales/en/application-simplified-adult';
import applicationSimplifiedChildEn from '~/.server/locales/en/application-simplified-child';
import applicationSimplifiedFamilyEn from '~/.server/locales/en/application-simplified-family';
import applicationSpokesEn from '~/.server/locales/en/application-spokes';
import commonEn from '~/.server/locales/en/common';
import dataUnavailableEn from '~/.server/locales/en/data-unavailable';
import documentsEn from '~/.server/locales/en/documents';
import gcwebEn from '~/.server/locales/en/gcweb';
import lettersEn from '~/.server/locales/en/letters';
import protectedApplicationEn from '~/.server/locales/en/protected-application';
import protectedApplicationIntakeAdultEn from '~/.server/locales/en/protected-application-intake-adult';
import protectedApplicationIntakeChildEn from '~/.server/locales/en/protected-application-intake-child';
import protectedApplicationIntakeFamilyEn from '~/.server/locales/en/protected-application-intake-family';
import protectedApplicationRenewalAdultEn from '~/.server/locales/en/protected-application-renewal-adult';
import protectedApplicationRenewalChildEn from '~/.server/locales/en/protected-application-renewal-child';
import protectedApplicationRenewalFamilyEn from '~/.server/locales/en/protected-application-renewal-family';
import protectedApplicationSpokesEn from '~/.server/locales/en/protected-application-spokes';
import protectedProfileEn from '~/.server/locales/en/protected-profile';
import statusEn from '~/.server/locales/en/status';
import stubLoginEn from '~/.server/locales/en/stub-login';
import unableToProcessRequestEn from '~/.server/locales/en/unable-to-process-request';
import applicationFr from '~/.server/locales/fr/application';
import applicationFullAdultFr from '~/.server/locales/fr/application-full-adult';
import applicationFullChildFr from '~/.server/locales/fr/application-full-child';
import applicationFullFamilyFr from '~/.server/locales/fr/application-full-family';
import applicationSimplifiedAdultFr from '~/.server/locales/fr/application-simplified-adult';
import applicationSimplifiedChildFr from '~/.server/locales/fr/application-simplified-child';
import applicationSimplifiedFamilyFr from '~/.server/locales/fr/application-simplified-family';
import applicationSpokesFr from '~/.server/locales/fr/application-spokes';
import commonFr from '~/.server/locales/fr/common';
import dataUnavailableFr from '~/.server/locales/fr/data-unavailable';
import documentsFr from '~/.server/locales/fr/documents';
import gcwebFr from '~/.server/locales/fr/gcweb';
import lettersFr from '~/.server/locales/fr/letters';
import protectedApplicationFr from '~/.server/locales/fr/protected-application';
import protectedApplicationIntakeAdultFr from '~/.server/locales/fr/protected-application-intake-adult';
import protectedApplicationIntakeChildFr from '~/.server/locales/fr/protected-application-intake-child';
import protectedApplicationIntakeFamilyFr from '~/.server/locales/fr/protected-application-intake-family';
import protectedApplicationRenewalAdultFr from '~/.server/locales/fr/protected-application-renewal-adult';
import protectedApplicationRenewalChildFr from '~/.server/locales/fr/protected-application-renewal-child';
import protectedApplicationRenewalFamilyFr from '~/.server/locales/fr/protected-application-renewal-family';
import protectedApplicationSpokesFr from '~/.server/locales/fr/protected-application-spokes';
import protectedProfileFr from '~/.server/locales/fr/protected-profile';
import statusFr from '~/.server/locales/fr/status';
import stubLoginFr from '~/.server/locales/fr/stub-login';
import unableToProcessRequestFr from '~/.server/locales/fr/unable-to-process-request';

const i18nResourcesEn = {
  application: applicationEn,
  applicationSpokes: applicationSpokesEn,
  applicationFullAdult: applicationFullAdultEn,
  applicationFullChild: applicationFullChildEn,
  applicationFullFamily: applicationFullFamilyEn,
  applicationSimplifiedAdult: applicationSimplifiedAdultEn,
  applicationSimplifiedChild: applicationSimplifiedChildEn,
  applicationSimplifiedFamily: applicationSimplifiedFamilyEn,
  common: commonEn,
  dataUnavailable: dataUnavailableEn,
  documents: documentsEn,
  gcweb: gcwebEn,
  letters: lettersEn,
  protectedApplication: protectedApplicationEn,
  protectedApplicationIntakeAdult: protectedApplicationIntakeAdultEn,
  protectedApplicationIntakeChild: protectedApplicationIntakeChildEn,
  protectedApplicationIntakeFamily: protectedApplicationIntakeFamilyEn,
  protectedApplicationRenewalAdult: protectedApplicationRenewalAdultEn,
  protectedApplicationRenewalChild: protectedApplicationRenewalChildEn,
  protectedApplicationRenewalFamily: protectedApplicationRenewalFamilyEn,
  protectedApplicationSpokes: protectedApplicationSpokesEn,
  protectedProfile: protectedProfileEn,
  status: statusEn,
  stubLogin: stubLoginEn,
  unableToProcessRequest: unableToProcessRequestEn,
} as const;

const i18nResourcesFr = {
  application: applicationFr,
  applicationFullAdult: applicationFullAdultFr,
  applicationFullChild: applicationFullChildFr,
  applicationFullFamily: applicationFullFamilyFr,
  applicationSimplifiedAdult: applicationSimplifiedAdultFr,
  applicationSimplifiedChild: applicationSimplifiedChildFr,
  applicationSimplifiedFamily: applicationSimplifiedFamilyFr,
  applicationSpokes: applicationSpokesFr,
  common: commonFr,
  dataUnavailable: dataUnavailableFr,
  documents: documentsFr,
  gcweb: gcwebFr,
  letters: lettersFr,
  protectedApplication: protectedApplicationFr,
  protectedApplicationIntakeAdult: protectedApplicationIntakeAdultFr,
  protectedApplicationIntakeChild: protectedApplicationIntakeChildFr,
  protectedApplicationIntakeFamily: protectedApplicationIntakeFamilyFr,
  protectedApplicationRenewalAdult: protectedApplicationRenewalAdultFr,
  protectedApplicationRenewalChild: protectedApplicationRenewalChildFr,
  protectedApplicationRenewalFamily: protectedApplicationRenewalFamilyFr,
  protectedApplicationSpokes: protectedApplicationSpokesFr,
  protectedProfile: protectedProfileFr,
  status: statusFr,
  stubLogin: stubLoginFr,
  unableToProcessRequest: unableToProcessRequestFr,
} as const satisfies LiteralToPrimitiveDeep<typeof i18nResourcesEn>;

export const i18nResources = {
  en: i18nResourcesEn,
  fr: i18nResourcesFr,
} as const;
