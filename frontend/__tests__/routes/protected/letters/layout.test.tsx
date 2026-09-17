import { describe, expect, it, vi } from 'vitest';

const { createFeatureMiddleware, featureMiddleware, programApplicantMiddleware } = vi.hoisted(() => ({
  createFeatureMiddleware: vi.fn((feature: string) => (feature === 'view-letters' ? vi.fn() : vi.fn())),
  featureMiddleware: vi.fn(),
  programApplicantMiddleware: vi.fn(),
}));

vi.mock(import('~/middlewares/applicant.server'), () => ({
  applicantMiddleware: vi.fn(),
  programApplicantMiddleware,
}));

vi.mock(import('~/middlewares/feature.server'), () => ({
  createFeatureMiddleware: (feature: string) => {
    createFeatureMiddleware(feature);
    return feature === 'view-letters' ? featureMiddleware : vi.fn();
  },
}));

import { middleware } from '~/routes/protected/letters/layout';

describe('letters layout middleware', () => {
  it('validates the feature before resolving the program applicant', () => {
    expect(middleware).toEqual([featureMiddleware, programApplicantMiddleware]);
  });
});
