import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Form, Link, MemoryRouter, createRoutesStub, data, isRouteErrorResponse, useRouteError } from 'react-router';

import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import en from '~/.server/locales/en/gcweb';
import fr from '~/.server/locales/fr/gcweb';
import { NotFoundError as ProtectedNotFoundError, ServerError as ProtectedServerError } from '~/components/layouts/protected-layout';
import { BilingualNotFoundError, BilingualServerError, NotFoundError, ServerError } from '~/components/layouts/public-layout';
import { AppError } from '~/errors/app-error';
import { getCorrelationId } from '~/errors/error-predicates';
import { ErrorBoundary as PublicErrorBoundary } from '~/routes/localized-layout';
import { ErrorBoundary as ProtectedErrorBoundary } from '~/routes/protected/layout';

vi.unmock('react-i18next');
vi.mock(import('~/middlewares/csrf-token.server'), () => ({ csrfTokenMiddleware: vi.fn(), getCsrfToken: vi.fn() }));
vi.mock(import('~/middlewares/csrf.server'), () => ({ csrfMiddleware: vi.fn() }));
vi.mock(import('~/middlewares/auth.server'), () => ({ authMiddleware: vi.fn() }));
vi.mock(import('~/utils/env-utils'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getClientEnv: () => mock<ReturnType<typeof actual.getClientEnv>>({ SCCH_BASE_URI: 'http://localhost', HEADER_LOGO_URL_EN: '/', HEADER_LOGO_URL_FR: '/' }) };
});
vi.mock(import('~/hooks'), () => ({ useCurrentLanguage: () => ({ currentLanguage: 'en', altLanguage: 'fr' }), useFeature: () => false }));
vi.mock(import('~/components/page-header-brand'), () => ({ PageHeaderBrand: () => <div /> }));
vi.mock(import('~/components/page-details'), () => ({ PageDetails: () => <div /> }));
vi.mock(import('~/components/browser-compatibility-banner'), () => ({ BrowserCompatibilityBanner: () => <div /> }));
vi.mock(import('~/utils/adobe-analytics.client'), () => ({ isConfigured: () => false }));

const layouts = [ServerError, NotFoundError, ProtectedServerError, ProtectedNotFoundError, BilingualServerError, BilingualNotFoundError];

describe('error layouts', () => {
  it.each(layouts.flatMap((Layout) => ['en', 'fr'].flatMap((lng) => ['direct', 'wrapped'].map((shape) => ({ Layout, lng, shape })))))('renders $Layout.name in $lng with a $shape ID', async ({ Layout, lng, shape }) => {
    const i18n = createInstance();
    await i18n.init({ lng, resources: { en: { gcweb: en }, fr: { gcweb: fr } } });
    const appError = new AppError('Never expose this message', undefined, { correlationId: 'AB-123456' });
    const error = shape === 'direct' ? appError : { status: 404, statusText: 'Not Found', internal: false, data: JSON.parse(JSON.stringify(appError)) };
    const view = render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <Layout error={error} />
        </MemoryRouter>
      </I18nextProvider>,
    );
    const bilingual = Layout === BilingualServerError || Layout === BilingualNotFoundError;
    expect(screen.getAllByText(appError.correlationId)).toHaveLength(bilingual ? 2 : 1);

    const sections = bilingual
      ? [
          { element: view.container.querySelector<HTMLElement>('#english')!, label: 'Correlation ID:' },
          { element: view.container.querySelector<HTMLElement>('#french')!, label: 'Identifiant de corrélation :' },
        ]
      : [{ element: view.container, label: lng === 'en' ? 'Correlation ID:' : 'Identifiant de corrélation :' }];

    for (const { element, label } of sections) {
      expect(within(element).getByText(label)).toBeVisible();
    }

    expect(view.container).not.toHaveTextContent(appError.msg);
    expect(view.container).not.toHaveTextContent(appError.errorCode);
    view.rerender(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <Layout error={error} />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getAllByText(appError.correlationId)).toHaveLength(bilingual ? 2 : 1);
  });

  it.each(layouts)('does not add a label to $name for a generic failure', async (Layout) => {
    const i18n = createInstance();
    await i18n.init({ lng: 'en', resources: { en: { gcweb: en }, fr: { gcweb: fr } } });
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <Layout error={new Error('Synthetic failure')} />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.queryByText('Correlation ID:')).not.toBeInTheDocument();
    expect(screen.queryByText('Identifiant de corrélation :')).not.toBeInTheDocument();
  });

  it('preserves the ID through real client navigation and action-error wrapping', async () => {
    const i18n = createInstance();
    await i18n.init({ lng: 'en', resources: { en: { gcweb: en } } });
    const error = new AppError('Synthetic failure', undefined, { correlationId: 'AB-123456' });
    const seen: unknown[] = [];
    const Stub = createRoutesStub([
      { path: '/', Component: () => <Link to="/failure">Navigate</Link> },
      {
        path: '/failure',
        loader: () => {
          throw JSON.parse(JSON.stringify(error));
        },
        ErrorBoundary: () => {
          const value = useRouteError();
          seen.push(value);
          return <ServerError error={value} />;
        },
        action: () => {
          throw JSON.parse(JSON.stringify(error));
        },
      },
    ]);
    const view = render(
      <I18nextProvider i18n={i18n}>
        <Stub />
      </I18nextProvider>,
    );
    await userEvent.click(screen.getByRole('link', { name: 'Navigate' }));
    expect(await screen.findByText(error.correlationId)).toBeVisible();
    expect(getCorrelationId(seen.at(-1))).toBe(error.correlationId);
    view.unmount();

    const ActionStub = createRoutesStub([
      {
        path: '/',
        Component: () => (
          <Form method="post">
            <button type="submit">Submit</button>
          </Form>
        ),
        action: () => {
          throw data(JSON.parse(JSON.stringify(error)), { status: 500 });
        },
        ErrorBoundary: () => {
          const value = useRouteError();
          seen.push(value);
          return <ServerError error={value} />;
        },
      },
    ]);
    render(
      <I18nextProvider i18n={i18n}>
        <ActionStub />
      </I18nextProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText(error.correlationId)).toBeVisible();
    expect(isRouteErrorResponse(seen.at(-1))).toBe(true);
    expect(getCorrelationId(seen.at(-1))).toBe(error.correlationId);
  });

  it.each(['public', 'protected', 'bilingual'])('preserves %s boundary page selection for direct and wrapped errors', async (layout) => {
    const i18n = createInstance();
    await i18n.init({ lng: 'en', resources: { en: { gcweb: en }, fr: { gcweb: fr } } });
    const appError = new AppError('Synthetic failure', undefined, { correlationId: 'AB-123456', httpStatusCode: 404 });
    const boundary = (error: unknown) =>
      layout === 'protected' ? (
        <ProtectedErrorBoundary {...mock<Parameters<typeof ProtectedErrorBoundary>[0]>()} error={error} />
      ) : (
        <PublicErrorBoundary {...mock<Parameters<typeof PublicErrorBoundary>[0]>()} error={error} params={{ lang: layout === 'bilingual' ? '' : 'en' }} />
      );
    const view = render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>{boundary(appError)}</MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getAllByText('(Error 500)')).toHaveLength(1);
    expect(screen.getAllByText(appError.correlationId)).toHaveLength(layout === 'bilingual' ? 2 : 1);
    view.rerender(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>{boundary({ status: 404, statusText: 'Not Found', internal: false, data: appError })}</MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getAllByText('(Error 404)')).toHaveLength(1);
    expect(screen.getAllByText(appError.correlationId)).toHaveLength(layout === 'bilingual' ? 2 : 1);
  });
});
