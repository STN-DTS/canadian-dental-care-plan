import type { GetAnnotations } from 'react-router/internal';

import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { mergeMeta } from '~/utils/meta-utils';

describe('mergeMeta', () => {
  it('should merge parent and leaf meta correctly', () => {
    const parentMeta = [
      { title: 'Parent Title' }, //
      { name: 'description', content: 'Parent Description' },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type MetaArgs = GetAnnotations<any>['MetaArgs'];

    const args: MetaArgs = {
      loaderData: undefined,
      location: mock<MetaArgs['location']>({ pathname: '/leaf' }),
      matches: [
        {
          loaderData: undefined,
          id: 'parent',
          meta: parentMeta,
          params: {},
          pathname: '/',
        },
      ],
      params: {},
    };

    const mergedMeta = mergeMeta(() => {
      return [{ title: 'Leaf Title' }];
    })(args);

    expect(mergedMeta).toEqual([
      { title: 'Leaf Title' }, //
      { name: 'description', content: 'Parent Description' },
    ]);
  });
});
