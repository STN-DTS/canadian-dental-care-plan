import type { ServerBuild } from 'react-router';

import { describe, expect, test } from 'vitest';

import { createAgnosticRoutes, createServerRoutes } from '~/.server/utils/server-build-utils';
import type { ServerRoute } from '~/.server/utils/server-build-utils';

type ServerRouteManifest = NonNullable<ServerBuild['routes']>;

describe('createServerRoutes', () => {
  test('should correctly convert a flat route manifest into a hierarchical ServerRoute array', () => {
    const serverRoutesManifest = {
      root: {
        id: 'root',
        path: '',
      },
      'routes/catchall': {
        id: 'routes/catchall',
        parentId: 'root',
        path: '/:lang/*',
      },
      'routes/language-chooser': {
        id: 'routes/language-chooser',
        parentId: 'root',
        index: true,
      },
      'api/buildinfo': {
        id: 'api/buildinfo',
        parentId: 'root',
        path: '/api/buildinfo',
      },
      'public/apply/$id/adult/applicant-information-en': {
        id: 'public/apply/$id/adult/applicant-information-en',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/apply/:id/adult/applicant-information',
      },
      'public/apply/$id/adult/applicant-information-fr': {
        id: 'public/apply/$id/adult/applicant-information-fr',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/demander/:id/adulte/renseignements-demandeur',
      },
      'public/apply/$id/adult/confirmation-en': {
        id: 'public/apply/$id/adult/confirmation-en',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/apply/:id/adult/confirmation',
      },
      'public/apply/$id/adult/confirmation-fr': {
        id: 'public/apply/$id/adult/confirmation-fr',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/demander/:id/adulte/confirmation',
      },
      'public/apply/$id/adult/review-information-en': {
        id: 'public/apply/$id/adult/review-information-en',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/apply/:id/adult/review-information',
      },
      'public/apply/$id/adult/review-information-fr': {
        id: 'public/apply/$id/adult/review-information-fr',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/demander/:id/adulte/revue-renseignements',
      },
      'public/apply/$id/index-en': {
        id: 'public/apply/$id/index-en',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/apply/:id',
      },
      'public/apply/$id/index-fr': {
        id: 'public/apply/$id/index-fr',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/demander/:id',
      },
      'public/apply/$id/terms-and-conditions-en': {
        id: 'public/apply/$id/terms-and-conditions-en',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/apply/:id/terms-and-conditions',
      },
      'public/apply/$id/terms-and-conditions-fr': {
        id: 'public/apply/$id/terms-and-conditions-fr',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/demander/:id/conditions-utilisation',
      },
      'public/apply/$id/type-application-en': {
        id: 'public/apply/$id/type-application-en',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/apply/:id/type-application',
      },
      'public/apply/$id/type-application-fr': {
        id: 'public/apply/$id/type-application-fr',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/demander/:id/type-demande',
      },
      'public/apply/index-en': {
        id: 'public/apply/index-en',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/apply',
      },
      'public/apply/index-fr': {
        id: 'public/apply/index-fr',
        parentId: 'routes/public/apply/layout',
        path: '/:lang/demander',
      },
      'routes/public/apply/layout': {
        id: 'routes/public/apply/layout',
        parentId: 'routes/public/layout',
      },
      'routes/public/layout': {
        id: 'routes/public/layout',
        parentId: 'root',
      },
    } as unknown as ServerRouteManifest;

    const actual = createServerRoutes(serverRoutesManifest);

    expect(actual).toStrictEqual([
      {
        id: 'root',
        path: '',
        children: [
          {
            id: 'routes/catchall',
            parentId: 'root',
            path: '/:lang/*',
            children: [],
          },
          {
            id: 'routes/language-chooser',
            index: true,
            parentId: 'root',
            children: [],
          },
          {
            id: 'api/buildinfo',
            parentId: 'root',
            path: '/api/buildinfo',
            children: [],
          },
          {
            id: 'routes/public/layout',
            parentId: 'root',
            children: [
              {
                id: 'routes/public/apply/layout',
                parentId: 'routes/public/layout',
                children: [
                  {
                    id: 'public/apply/$id/adult/applicant-information-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/adult/applicant-information',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/adult/applicant-information-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/adulte/renseignements-demandeur',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/adult/confirmation-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/adult/confirmation',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/adult/confirmation-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/adulte/confirmation',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/adult/review-information-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/adult/review-information',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/adult/review-information-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/adulte/revue-renseignements',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/index-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/index-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/terms-and-conditions-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/terms-and-conditions',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/terms-and-conditions-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/conditions-utilisation',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/type-application-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/type-application',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/type-application-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/type-demande',
                    children: [],
                  },
                  {
                    id: 'public/apply/index-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply',
                    children: [],
                  },
                  {
                    id: 'public/apply/index-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander',
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });
});

describe('createAgnosticRoutes', () => {
  test('should convert ServerRoute array to AgnosticRoute array, handling index routes and children correctly', () => {
    const serverRoutes = [
      {
        id: 'root',
        path: '',
        children: [
          {
            id: 'routes/catchall',
            parentId: 'root',
            path: '/:lang/*',
            children: [],
          },
          {
            id: 'routes/language-chooser',
            index: true,
            parentId: 'root',
            children: [],
          },
          {
            id: 'api/buildinfo',
            parentId: 'root',
            path: '/api/buildinfo',
            children: [],
          },
          {
            id: 'routes/public/layout',
            parentId: 'root',
            children: [
              {
                id: 'routes/public/apply/layout',
                parentId: 'routes/public/layout',
                children: [
                  {
                    id: 'public/apply/$id/adult/applicant-information-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/adult/applicant-information',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/adult/applicant-information-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/adulte/renseignements-demandeur',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/adult/confirmation-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/adult/confirmation',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/adult/confirmation-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/adulte/confirmation',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/adult/review-information-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/adult/review-information',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/adult/review-information-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/adulte/revue-renseignements',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/index-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/index-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/terms-and-conditions-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/terms-and-conditions',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/terms-and-conditions-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/conditions-utilisation',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/type-application-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/type-application',
                    children: [],
                  },
                  {
                    id: 'public/apply/$id/type-application-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/type-demande',
                    children: [],
                  },
                  {
                    id: 'public/apply/index-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply',
                    children: [],
                  },
                  {
                    id: 'public/apply/index-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander',
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ] as unknown as ServerRoute[];

    const actual = createAgnosticRoutes(serverRoutes);

    expect(actual).toStrictEqual([
      {
        id: 'root',
        path: '',
        children: [
          {
            id: 'routes/catchall',
            parentId: 'root',
            path: '/:lang/*',
          },
          {
            id: 'routes/language-chooser',
            index: true,
            parentId: 'root',
          },
          {
            id: 'api/buildinfo',
            parentId: 'root',
            path: '/api/buildinfo',
          },
          {
            id: 'routes/public/layout',
            parentId: 'root',
            children: [
              {
                id: 'routes/public/apply/layout',
                parentId: 'routes/public/layout',
                children: [
                  {
                    id: 'public/apply/$id/adult/applicant-information-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/adult/applicant-information',
                  },
                  {
                    id: 'public/apply/$id/adult/applicant-information-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/adulte/renseignements-demandeur',
                  },
                  {
                    id: 'public/apply/$id/adult/confirmation-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/adult/confirmation',
                  },
                  {
                    id: 'public/apply/$id/adult/confirmation-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/adulte/confirmation',
                  },
                  {
                    id: 'public/apply/$id/adult/review-information-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/adult/review-information',
                  },
                  {
                    id: 'public/apply/$id/adult/review-information-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/adulte/revue-renseignements',
                  },
                  {
                    id: 'public/apply/$id/index-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id',
                  },
                  {
                    id: 'public/apply/$id/index-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id',
                  },
                  {
                    id: 'public/apply/$id/terms-and-conditions-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/terms-and-conditions',
                  },
                  {
                    id: 'public/apply/$id/terms-and-conditions-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/conditions-utilisation',
                  },
                  {
                    id: 'public/apply/$id/type-application-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply/:id/type-application',
                  },
                  {
                    id: 'public/apply/$id/type-application-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander/:id/type-demande',
                  },
                  {
                    id: 'public/apply/index-en',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/apply',
                  },
                  {
                    id: 'public/apply/index-fr',
                    parentId: 'routes/public/apply/layout',
                    path: '/:lang/demander',
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });
});
