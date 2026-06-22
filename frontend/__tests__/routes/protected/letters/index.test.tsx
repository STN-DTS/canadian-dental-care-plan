import type { RouterContextProvider } from 'react-router';

import { None } from 'oxide.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock, mockDeep } from 'vitest-mock-extended';

import type { ClientConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { AuditService, LetterService, LetterTypeService } from '~/.server/domain/services';
import type { SecurityHandler } from '~/.server/routes/security';
import type { IdToken, UserinfoToken } from '~/.server/utils/raoidc.utils';
import { loader } from '~/routes/protected/letters/index';

vi.mock('~/.server/utils/locale.utils');

describe('Letters Page', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loader()', () => {
    it('should return sorted letters', async () => {
      const mockRouterContext = mockDeep<RouterContextProvider>();

      mockRouterContext.session.get.calledWith('idToken').mockReturnValueOnce({ sub: '00000000-0000-0000-0000-000000000000' } as IdToken);
      mockRouterContext.session.get.calledWith('userInfoToken').mockReturnValueOnce({ sin: '999999999', sub: '1111111' } as UserinfoToken);
      mockRouterContext.session.find.calledWith('applicant').mockReturnValueOnce(None);

      mockRouterContext.appContainer.get.calledWith(TYPES.SecurityHandler).mockReturnValueOnce(
        mock<SecurityHandler>({
          requireApplicant: async () =>
            await Promise.resolve({
              clientId: 'some-client-id',
              clientNumber: 'some-client-number',
              dateOfBirth: '2000-01-01',
              firstName: 'John',
              lastName: 'Doe',
              socialInsuranceNumber: '999999999',
              communicationPreferences: {},
              contactInformation: {
                mailingAddress: {
                  address: '123 Main St',
                  city: 'Anytown',
                  country: 'Canada',
                },
              },
            }),
        }),
      );
      mockRouterContext.appContainer.get.calledWith(TYPES.ClientConfig).mockReturnValueOnce({
        SCCH_BASE_URI: 'https://api.example.com',
      } satisfies Partial<ClientConfig>);
      mockRouterContext.appContainer.get.calledWith(TYPES.AuditService).mockReturnValue({
        createAudit: vi.fn(),
      } satisfies Partial<AuditService>);
      mockRouterContext.appContainer.get.calledWith(TYPES.LetterService).mockReturnValue({
        findLettersByClientId: async () =>
          await Promise.resolve([
            { id: '1', date: '2024-12-25', letterTypeId: 'ACC' },
            { id: '2', date: '2004-02-29', letterTypeId: 'DEN' },
            { id: '3', date: '2004-02-29', letterTypeId: 'DEN' },
          ]),
      } satisfies Partial<LetterService>);
      mockRouterContext.appContainer.get.calledWith(TYPES.LetterTypeService).mockReturnValue({
        listLetterTypes: async () =>
          await Promise.resolve([
            { id: 'ACC', nameEn: 'Accepted', nameFr: '(FR) Accepted' },
            { id: 'DEN', nameEn: 'Denied', nameFr: '(FR) Denied' },
          ]),
      } satisfies Partial<LetterTypeService>);

      const response = await loader({
        request: new Request('http://localhost/letters?sort=desc'),
        context: mockRouterContext,
        params: { lang: 'en' },
        pattern: '',
        url: new URL('http://localhost/letters?sort=desc'),
      });

      expect(response.letters).toHaveLength(3);
      expect(response.letters[2]?.id).toEqual('3');
      expect(response.letters[2]?.letterTypeId).toEqual('DEN');
      expect(response.letters[1]?.date).toBeDefined();
      expect(response.letters[2]?.date).toBeDefined();
    });
  });

  it('retrieves letter types', async () => {
    const mockRouterContext = mockDeep<RouterContextProvider>();

    mockRouterContext.session.get.calledWith('idToken').mockReturnValueOnce({ sub: '00000000-0000-0000-0000-000000000000' } as IdToken);
    mockRouterContext.session.get.calledWith('userInfoToken').mockReturnValueOnce({ sin: '999999999' } as UserinfoToken);
    mockRouterContext.session.find.calledWith('applicant').mockReturnValueOnce(None);

    mockRouterContext.appContainer.get.calledWith(TYPES.SecurityHandler).mockReturnValueOnce(
      mock<SecurityHandler>({
        requireApplicant: async () =>
          await Promise.resolve({
            clientId: 'some-client-id',
            clientNumber: 'some-client-number',
            dateOfBirth: '2000-01-01',
            firstName: 'John',
            lastName: 'Doe',
            socialInsuranceNumber: '999999999',
            communicationPreferences: {},
            contactInformation: {
              mailingAddress: {
                address: '123 Main St',
                city: 'Anytown',
                country: 'Canada',
              },
            },
          }),
      }),
    );
    mockRouterContext.appContainer.get.calledWith(TYPES.ClientConfig).mockReturnValue({
      SCCH_BASE_URI: 'https://api.example.com',
    } satisfies Partial<ClientConfig>);
    mockRouterContext.appContainer.get.calledWith(TYPES.AuditService).mockReturnValue({
      createAudit: vi.fn(),
    } satisfies Partial<AuditService>);
    mockRouterContext.appContainer.get.calledWith(TYPES.LetterService).mockReturnValue({
      findLettersByClientId: async () =>
        await Promise.resolve([
          { id: '1', date: '2024-12-25', letterTypeId: 'ACC' },
          { id: '2', date: '2004-02-29', letterTypeId: 'DEN' },
          { id: '3', date: '2004-02-29', letterTypeId: 'DEN' },
        ]),
    } satisfies Partial<LetterService>);
    mockRouterContext.appContainer.get.calledWith(TYPES.LetterTypeService).mockReturnValue({
      listLetterTypes: async () =>
        await Promise.resolve([
          { id: 'ACC', nameEn: 'Accepted', nameFr: '(FR) Accepted' },
          { id: 'DEN', nameEn: 'Denied', nameFr: '(FR) Denied' },
        ]),
    } satisfies Partial<LetterTypeService>);

    const response = await loader({
      request: new Request('http://localhost/letters'),
      context: mockRouterContext,
      params: { lang: 'en' },
      pattern: '',
      url: new URL('http://localhost/letters'),
    });

    expect(response.letterTypes).toContainEqual({ id: 'DEN', nameEn: 'Denied', nameFr: '(FR) Denied' });
    expect(response.letterTypes).toContainEqual({ id: 'ACC', nameEn: 'Accepted', nameFr: '(FR) Accepted' });
  });
});
