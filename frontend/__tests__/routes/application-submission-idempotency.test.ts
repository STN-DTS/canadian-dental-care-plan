// @vitest-environment node

import { RouterContextProvider } from 'react-router';

import { Redacted } from 'effect';
import { Headers, Response } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, mockFn } from 'vitest-mock-extended';

import type { AuditService } from '~/.server/audit/audit-service';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import type { AppContext } from '~/.server/context/app-context';
import type { BenefitApplicationDto, BenefitRenewalDto } from '~/.server/domain/dtos';
import type { BenefitApplicationRequestEntity, BenefitRenewalRequestEntity } from '~/.server/domain/entities';
import type { BenefitApplicationDtoMapper, BenefitRenewalDtoMapper } from '~/.server/domain/mappers';
import { DefaultBenefitApplicationRepository } from '~/.server/domain/repositories/benefit-application-repository';
import { DefaultBenefitRenewalRepository } from '~/.server/domain/repositories/benefit-renewal-repository';
import { DefaultBenefitApplicationService } from '~/.server/domain/services/benefit-application-service';
import { DefaultBenefitRenewalService } from '~/.server/domain/services/benefit-renewal-service';
import { DefaultHttpClient } from '~/.server/http';
import type { FetchFn } from '~/.server/http';
import type { InstrumentationService } from '~/.server/observability';
import { loadProtectedApplicationIntakeAdultStateForReview } from '~/.server/routes/helpers/protected-application-intake-adult-route-helpers';
import { loadProtectedApplicationIntakeChildStateForReview } from '~/.server/routes/helpers/protected-application-intake-child-route-helpers';
import { loadProtectedApplicationIntakeFamilyStateForReview } from '~/.server/routes/helpers/protected-application-intake-family-route-helpers';
import { loadProtectedApplicationRenewalAdultStateForReview } from '~/.server/routes/helpers/protected-application-renewal-adult-route-helpers';
import { loadProtectedApplicationRenewalChildStateForReview } from '~/.server/routes/helpers/protected-application-renewal-child-route-helpers';
import { loadProtectedApplicationRenewalFamilyStateForReview } from '~/.server/routes/helpers/protected-application-renewal-family-route-helpers';
import { loadPublicApplicationFullAdultStateForReview } from '~/.server/routes/helpers/public-application-full-adult-route-helpers';
import { loadPublicApplicationFullChildStateForReview } from '~/.server/routes/helpers/public-application-full-child-route-helpers';
import { loadPublicApplicationFullFamilyStateForReview } from '~/.server/routes/helpers/public-application-full-family-route-helpers';
import { loadPublicApplicationSimplifiedAdultStateForReview } from '~/.server/routes/helpers/public-application-simplified-adult-route-helpers';
import { loadPublicApplicationSimplifiedChildStateForReview } from '~/.server/routes/helpers/public-application-simplified-child-route-helpers';
import { loadPublicApplicationSimplifiedFamilyStateForReview } from '~/.server/routes/helpers/public-application-simplified-family-route-helpers';
import type { BenefitApplicationStateMapper } from '~/.server/routes/mappers/benefit-application-state-mapper';
import type { BenefitRenewalStateMapper } from '~/.server/routes/mappers/benefit-renewal-state-mapper';
import type { SecurityHandler } from '~/.server/routes/security/security-handler';
import { getFixedT } from '~/.server/utils/locale-utils';
import type { Session } from '~/.server/web/session';
import { action as protectedIntakeAdult } from '~/routes/protected/application/intake-adult/submit';
import { action as protectedIntakeChildren } from '~/routes/protected/application/intake-children/submit';
import { action as protectedIntakeFamily } from '~/routes/protected/application/intake-family/submit';
import { action as protectedRenewalAdult } from '~/routes/protected/application/renewal-adult/submit';
import { action as protectedRenewalChildren } from '~/routes/protected/application/renewal-children/submit';
import { action as protectedRenewalFamily } from '~/routes/protected/application/renewal-family/submit';
import { action as publicFullAdult } from '~/routes/public/application/full-adult/submit';
import { action as publicFullChildren } from '~/routes/public/application/full-children/submit';
import { action as publicFullFamily } from '~/routes/public/application/full-family/submit';
import { action as publicSimplifiedAdult } from '~/routes/public/application/simplified-adult/submit';
import { action as publicSimplifiedChildren } from '~/routes/public/application/simplified-children/submit';
import { action as publicSimplifiedFamily } from '~/routes/public/application/simplified-family/submit';

vi.mock(import('~/.server/logging'), async () => ({
  ...(await import('~/.server/logging/__mocks__/index')),
  ...(await import('~/.server/logging/mask-application-confirmation-code')),
}));
vi.mock(import('~/.server/routes/helpers/protected-application-intake-adult-route-helpers'));
vi.mock(import('~/.server/routes/helpers/protected-application-intake-child-route-helpers'));
vi.mock(import('~/.server/routes/helpers/protected-application-intake-family-route-helpers'));
vi.mock(import('~/.server/routes/helpers/protected-application-renewal-adult-route-helpers'));
vi.mock(import('~/.server/routes/helpers/protected-application-renewal-child-route-helpers'));
vi.mock(import('~/.server/routes/helpers/protected-application-renewal-family-route-helpers'));
vi.mock(import('~/.server/routes/helpers/protected-application-route-helpers'));
vi.mock(import('~/.server/routes/helpers/public-application-full-adult-route-helpers'));
vi.mock(import('~/.server/routes/helpers/public-application-full-child-route-helpers'));
vi.mock(import('~/.server/routes/helpers/public-application-full-family-route-helpers'));
vi.mock(import('~/.server/routes/helpers/public-application-simplified-adult-route-helpers'));
vi.mock(import('~/.server/routes/helpers/public-application-simplified-child-route-helpers'));
vi.mock(import('~/.server/routes/helpers/public-application-simplified-family-route-helpers'));
vi.mock(import('~/.server/routes/helpers/public-application-route-helpers'));
vi.mock(import('~/.server/utils/locale-utils'));

const applicationId = 'c48267e0-f11c-4624-bba2-3501b2c33aa1';
const anotherApplicationId = '8264181c-e8ec-4d60-a57c-815af94394f2';
const serverConfig = {
  INTEROP_API_BASE_URI: 'https://api.example.test',
  INTEROP_API_SUBSCRIPTION_KEY: Redacted.make('test-key'),
  INTEROP_BENEFIT_APPLICATION_PATHNAME: '/applications',
  INTEROP_BENEFIT_RENEWAL_PATHNAME: '/applications',
  INTEROP_API_MAX_RETRIES: 3,
  INTEROP_API_BACKOFF_MS: 0,
};

const benefitRequest = {
  BenefitApplication: {
    Applicant: {
      ApplicantDetail: {
        TermsAndConditionsIndicator: true,
        PrivacyStatementIndicator: true,
        SharingConsentIndicator: true,
        EligibilityAttestationIndicator: true,
        AccuracyConfirmationIndicator: true,
      },
      BenefitApplicationDetail: [],
      ClientIdentification: [],
      PersonBirthDate: { date: '2000-01-01' },
      PersonContactInformation: [],
      PersonLanguage: [],
      PersonMaritalStatus: { StatusCode: { ReferenceDataID: 'test' } },
      PersonName: [],
      PersonSINIdentification: { IdentificationID: 'test' },
      RelatedPerson: [],
      MailingSameAsHomeIndicator: true,
      PreferredMethodCommunicationCode: { ReferenceDataID: 'test' },
      PreferredMethodCommunicationGCCode: { ReferenceDataID: 'test' },
    },
    BenefitApplicationCategoryCode: { ReferenceDataID: 'test', ReferenceDataName: 'New' },
    BenefitApplicationChannelCode: { ReferenceDataID: 'test' },
    BenefitApplicationYear: { BenefitApplicationYearIdentification: [] },
  },
} as const satisfies BenefitApplicationRequestEntity & BenefitRenewalRequestEntity;

function setReviewState(id: string, context: 'intake' | 'renewal') {
  vi.mocked(loadPublicApplicationFullAdultStateForReview).mockReturnValue(mock<ReturnType<typeof loadPublicApplicationFullAdultStateForReview>>({ id, context }));
  vi.mocked(loadPublicApplicationFullChildStateForReview).mockReturnValue(mock<ReturnType<typeof loadPublicApplicationFullChildStateForReview>>({ id, context }));
  vi.mocked(loadPublicApplicationFullFamilyStateForReview).mockReturnValue(mock<ReturnType<typeof loadPublicApplicationFullFamilyStateForReview>>({ id, context }));
  vi.mocked(loadPublicApplicationSimplifiedAdultStateForReview).mockReturnValue(mock<ReturnType<typeof loadPublicApplicationSimplifiedAdultStateForReview>>({ id, context: 'renewal' }));
  vi.mocked(loadPublicApplicationSimplifiedChildStateForReview).mockReturnValue(mock<ReturnType<typeof loadPublicApplicationSimplifiedChildStateForReview>>({ id, context: 'renewal' }));
  vi.mocked(loadPublicApplicationSimplifiedFamilyStateForReview).mockReturnValue(mock<ReturnType<typeof loadPublicApplicationSimplifiedFamilyStateForReview>>({ id, context: 'renewal' }));
  vi.mocked(loadProtectedApplicationIntakeAdultStateForReview).mockReturnValue(mock<ReturnType<typeof loadProtectedApplicationIntakeAdultStateForReview>>({ id, context: 'intake' }));
  vi.mocked(loadProtectedApplicationIntakeChildStateForReview).mockReturnValue(mock<ReturnType<typeof loadProtectedApplicationIntakeChildStateForReview>>({ id, context: 'intake' }));
  vi.mocked(loadProtectedApplicationIntakeFamilyStateForReview).mockReturnValue(mock<ReturnType<typeof loadProtectedApplicationIntakeFamilyStateForReview>>({ id, context: 'intake' }));
  vi.mocked(loadProtectedApplicationRenewalAdultStateForReview).mockReturnValue(mock<ReturnType<typeof loadProtectedApplicationRenewalAdultStateForReview>>({ id, context: 'renewal' }));
  vi.mocked(loadProtectedApplicationRenewalChildStateForReview).mockReturnValue(mock<ReturnType<typeof loadProtectedApplicationRenewalChildStateForReview>>({ id, context: 'renewal' }));
  vi.mocked(loadProtectedApplicationRenewalFamilyStateForReview).mockReturnValue(mock<ReturnType<typeof loadProtectedApplicationRenewalFamilyStateForReview>>({ id, context: 'renewal' }));
}

const cases = [
  { name: 'public full adult intake', action: publicFullAdult, channel: 'public', context: 'intake' },
  { name: 'public full children intake', action: publicFullChildren, channel: 'public', context: 'intake' },
  { name: 'public full family intake', action: publicFullFamily, channel: 'public', context: 'intake' },
  { name: 'public full adult renewal', action: publicFullAdult, channel: 'public', context: 'renewal' },
  { name: 'public full children renewal', action: publicFullChildren, channel: 'public', context: 'renewal' },
  { name: 'public full family renewal', action: publicFullFamily, channel: 'public', context: 'renewal' },
  { name: 'public simplified adult renewal', action: publicSimplifiedAdult, channel: 'public', context: 'renewal' },
  { name: 'public simplified children renewal', action: publicSimplifiedChildren, channel: 'public', context: 'renewal' },
  { name: 'public simplified family renewal', action: publicSimplifiedFamily, channel: 'public', context: 'renewal' },
  { name: 'protected adult intake', action: protectedIntakeAdult, channel: 'protected', context: 'intake' },
  { name: 'protected children intake', action: protectedIntakeChildren, channel: 'protected', context: 'intake' },
  { name: 'protected family intake', action: protectedIntakeFamily, channel: 'protected', context: 'intake' },
  { name: 'protected adult renewal', action: protectedRenewalAdult, channel: 'protected', context: 'renewal' },
  { name: 'protected children renewal', action: protectedRenewalChildren, channel: 'protected', context: 'renewal' },
  { name: 'protected family renewal', action: protectedRenewalFamily, channel: 'protected', context: 'renewal' },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getFixedT).mockResolvedValue(mockFn<Awaited<ReturnType<typeof getFixedT>>>().mockReturnValue('test'));
});

describe.each(cases)('$name', ({ action, channel, context: applicationContext }) => {
  it('reuses the flow key after an ambiguous failure and sends a different key for another flow', async () => {
    setReviewState(applicationId, applicationContext);
    const error = new TypeError('fetch failed');
    const fetchFn = vi
      .fn<FetchFn>()
      .mockRejectedValueOnce(error)
      .mockImplementation(async () => await Promise.resolve(new Response('{}')));
    const httpClient = new DefaultHttpClient(mock<InstrumentationService>());
    vi.spyOn(httpClient, 'getFetchFn').mockReturnValue(fetchFn);

    const applicationStateMapper = mock<BenefitApplicationStateMapper>();
    applicationStateMapper.mapApplicationAdultStateToBenefitApplicationDto.mockImplementation((state) => mock<BenefitApplicationDto>({ applicationId: state.id, applicationChannelCode: channel }));
    applicationStateMapper.mapApplicationChildrenStateToBenefitApplicationDto.mockImplementation((state) => mock<BenefitApplicationDto>({ applicationId: state.id, applicationChannelCode: channel }));
    applicationStateMapper.mapApplicationFamilyStateToBenefitApplicationDto.mockImplementation((state) => mock<BenefitApplicationDto>({ applicationId: state.id, applicationChannelCode: channel }));
    const renewalStateMapper = mock<BenefitRenewalStateMapper>();
    renewalStateMapper.mapBenefitRenewalAdultStateToBenefitRenewalDto.mockImplementation((state) => mock<BenefitRenewalDto>({ applicationId: state.id, applicationChannelCode: channel }));
    renewalStateMapper.mapBenefitRenewalChildStateToBenefitRenewalDto.mockImplementation((state) => mock<BenefitRenewalDto>({ applicationId: state.id, applicationChannelCode: channel }));
    renewalStateMapper.mapBenefitRenewalFamilyStateToBenefitRenewalDto.mockImplementation((state) => mock<BenefitRenewalDto>({ applicationId: state.id, applicationChannelCode: channel }));

    const applicationDtoMapper = mock<BenefitApplicationDtoMapper>();
    applicationDtoMapper.mapBenefitApplicationDtoToBenefitApplicationRequestEntity.mockReturnValue(benefitRequest);
    applicationDtoMapper.mapBenefitApplicationResponseEntityToApplicationCode.mockReturnValue('confirmation');
    const renewalDtoMapper = mock<BenefitRenewalDtoMapper>();
    renewalDtoMapper.mapBenefitRenewalDtoToBenefitRenewalRequestEntity.mockReturnValue(benefitRequest);
    renewalDtoMapper.mapBenefitRenewalResponseEntityToApplicationCode.mockReturnValue('confirmation');

    const applicationService = new DefaultBenefitApplicationService(applicationDtoMapper, new DefaultBenefitApplicationRepository(serverConfig, httpClient), mock<AuditService>(), mock<ServerConfig>());
    const renewalService = new DefaultBenefitRenewalService(renewalDtoMapper, new DefaultBenefitRenewalRepository(serverConfig, httpClient), mock<AuditService>(), mock<ServerConfig>());
    const securityHandler = mock<SecurityHandler>();
    securityHandler.validateHCaptchaResponse.mockResolvedValue(undefined);
    const session = mock<Session>({ id: 'different-session-id' });
    const appContainer = mock<AppContext['appContainer']>();
    appContainer.get.calledWith(TYPES.SecurityHandler).mockReturnValue(securityHandler);
    appContainer.get.calledWith(TYPES.BenefitApplicationStateMapper).mockReturnValue(applicationStateMapper);
    appContainer.get.calledWith(TYPES.BenefitRenewalStateMapper).mockReturnValue(renewalStateMapper);
    appContainer.get.calledWith(TYPES.BenefitApplicationService).mockReturnValue(applicationService);
    appContainer.get.calledWith(TYPES.BenefitRenewalService).mockReturnValue(renewalService);
    const context = new RouterContextProvider();
    context.set(appContext, { appContainer, session });

    const formData = new FormData();
    formData.set('acknowledgeInfo', 'yes');
    formData.set('acknowledgeCriteria', 'yes');

    const createActionArgs = (id: string) => {
      const url = new URL(`https://example.test/en/application/${id}/submit`);
      const request = mock<Request>({ formData: async () => await Promise.resolve(formData) });
      return { context, params: { id, lang: 'en' }, request, url, pattern: '/:lang/application/:id/submit' };
    };

    await expect(action(createActionArgs(applicationId))).rejects.toBe(error);
    expect(fetchFn).toHaveBeenCalledOnce();
    const retryResult = await action(createActionArgs(applicationId));
    setReviewState(anotherApplicationId, applicationContext);
    const newFlowResult = await action(createActionArgs(anotherApplicationId));

    expect(retryResult).toMatchObject({ status: 302 });
    expect(newFlowResult).toMatchObject({ status: 302 });
    expect(fetchFn.mock.calls.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key'))).toEqual([applicationId, applicationId, anotherApplicationId]);
  });
});
