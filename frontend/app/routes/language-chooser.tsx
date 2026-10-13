import { ButtonLink } from '~/components/buttons';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getDescriptionMetaTags, getTitleMetaTags } from '~/utils/seo-utils';

import type { Route } from './+types/language-chooser';

export const handle = {
  i18nPreloadNamespace: 'gcweb',
} as const satisfies RouteHandleData;

// Meta tags are constructed for a bilingual page.
export const meta: Route.MetaFunction = mergeMeta((args) => {
  const title = 'Canadian Dental Care Plan | Régime canadien de soins dentaires - Canada.ca';
  const description =
    'The Canadian Dental Care Plan (CDCP) will help cover some of the cost of various ' +
    'oral health care services for eligible Canadian residents. | Le Régime canadien ' +
    'de soins dentaires (RCSD) permet de couvrir une partie du coût de divers ' +
    'services de santé buccodentaire pour les résidents canadiens éligibles.';

  return [
    ...getTitleMetaTags(title),
    ...getDescriptionMetaTags(description),
    { name: 'author', content: 'Employment and Social Development Canada' },
    { name: 'author', lang: 'fr', content: 'Emploi et Développement social Canada' },
    { name: 'dcterms.accessRights', content: '2' },
    { name: 'dcterms.creator', content: 'Employment and Social Development Canada' },
    { name: 'dcterms.creator', lang: 'fr', content: 'Emploi et Développement social Canada' },
    { name: 'dcterms.language', content: 'eng' },
    { name: 'dcterms.language', lang: 'fr', content: 'fra' },
    { name: 'dcterms.service', content: 'ESDC-EDSC_CDCP-RCSD' },
    { name: 'dcterms.spatial', content: 'Canada' },
    { name: 'dcterms.subject', content: 'Economics and Industry;Insurance;Dental insurance' },
    { name: 'dcterms.subject', lang: 'fr', content: 'Économie et industrie;Assurance;Assurance dentaire' },
    { property: 'og:locale', content: 'en_CA' },
    { property: 'og:site_name', content: 'Canadian Dental Care Plan | Régime canadien de soins dentaires - Canada.ca' },
    { property: 'og:type', content: 'website' },
  ];
});

export default function LanguageChooser({ loaderData, params }: Route.ComponentProps) {
  return (
    <main role="main" className="bg-splash-page flex h-svh bg-cover bg-center" property="mainContentOfPage">
      <div className="m-auto w-[300px] bg-white md:w-[400px] lg:w-[500px]">
        <div className="p-8">
          <h1 className="sr-only">
            <span lang="en">Canadian Dental Care Plan</span>
            <span lang="fr">Régime canadien de soins dentaires</span>
          </h1>
          <div className="w-11/12 lg:w-8/12">
            <a href="https://www.canada.ca/en.html" property="url">
              <img className="h-8 w-auto" src="/assets/sig-blk-en.svg" alt="Government of Canada" property="logo" width="300" height="28" decoding="async" />
              <span className="sr-only">
                / <span lang="fr">Gouvernement du Canada</span>
              </span>
            </a>
          </div>
          <div className="mt-9 mb-2 grid grid-cols-2 gap-8 md:mx-4 lg:mx-8">
            <section lang="en">
              <h2 className="sr-only">Government of Canada</h2>
              <ButtonLink variant="primary" routeId="public/application/index" id="english-button" lang="en" targetLang="en" size="lg" className="w-full" reloadDocument>
                English
              </ButtonLink>
            </section>
            <section lang="fr">
              <h2 className="sr-only">Gouvernement du Canada</h2>
              <ButtonLink variant="primary" routeId="public/application/index" id="french-button" lang="fr" targetLang="fr" size="lg" className="w-full" reloadDocument>
                Français
              </ButtonLink>
            </section>
          </div>
        </div>
        <div className="flex items-center justify-between gap-6 bg-gray-200 p-8">
          <div className="w-7/12 md:w-8/12">
            <a className="text-slate-700 hover:underline" href="https://www.canada.ca/en/transparency/terms.html" lang="en">
              Terms & Conditions
            </a>
            <span className="text-gray-400"> • </span>
            <a className="text-slate-700 hover:underline" href="https://www.canada.ca/fr/transparence/avis.html" lang="fr">
              Avis
            </a>
          </div>
          <div className="w-5/12 md:w-4/12">
            <img src="/assets/wmms-blk.svg" alt="Symbol of the Government of Canada" width={300} height={71} className="h-10 w-auto" />
            <span className="sr-only">
              / <span lang="fr">Symbole du gouvernement du Canada</span>
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
