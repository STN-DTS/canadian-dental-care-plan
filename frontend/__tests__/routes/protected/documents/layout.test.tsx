import { describe, expect, it, vi } from 'vitest';

const { applicantMiddleware, featureMiddleware } = vi.hoisted(() => ({
  applicantMiddleware: vi.fn(),
  featureMiddleware: vi.fn(),
}));

vi.mock(import('~/middlewares/applicant.server'), () => ({
  applicantMiddleware,
  programApplicantMiddleware: vi.fn(),
}));

vi.mock(import('~/middlewares/feature.server'), () => ({
  createFeatureMiddleware: (feature: string) => (feature === 'doc-upload' ? featureMiddleware : vi.fn()),
}));

import { middleware } from '~/routes/protected/documents/layout';

describe('documents layout middleware', () => {
  it('validates the feature before resolving the applicant', () => {
    expect(middleware).toEqual([featureMiddleware, applicantMiddleware]);
  });
});
