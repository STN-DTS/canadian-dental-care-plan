import { render, screen } from '@testing-library/react';

import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

import en from '~/.server/locales/en/gcweb';
import fr from '~/.server/locales/fr/gcweb';
import { CorrelationDetail } from '~/components/correlation-detail';
import { AppError } from '~/errors/app-error';

vi.unmock('react-i18next');

describe('CorrelationDetail', () => {
  it.each(['en', 'fr'])('renders the existing ID in %s and preserves it on rerender', async (lng) => {
    const i18n = createInstance();
    await i18n.init({ lng, resources: { en: { gcweb: en }, fr: { gcweb: fr } } });
    const error = new AppError('Never display this message', undefined, { correlationId: 'AB-123456' });
    const view = render(
      <I18nextProvider i18n={i18n}>
        <CorrelationDetail error={error} />
      </I18nextProvider>,
    );

    expect(screen.getByText(lng === 'en' ? 'Correlation ID:' : 'Identifiant de corrélation :')).toBeVisible();
    expect(screen.getByText(error.correlationId)).toHaveClass('select-text');
    expect(view.container).not.toHaveTextContent(error.msg);
    expect(view.container).not.toHaveTextContent(error.errorCode);
    expect(view.container.querySelector('[tabindex], button, a')).toBeNull();

    view.rerender(
      <I18nextProvider i18n={i18n}>
        <CorrelationDetail error={{ status: 500, statusText: '', internal: false, data: JSON.parse(JSON.stringify(error)) }} />
      </I18nextProvider>,
    );
    expect(screen.getByText(error.correlationId)).toBeVisible();
  });

  it('forces both languages independently of the active language', async () => {
    const i18n = createInstance();
    await i18n.init({ lng: 'fr', resources: { en: { gcweb: en }, fr: { gcweb: fr } } });
    const error = new AppError('Synthetic failure', undefined, { correlationId: 'AB-123456' });
    render(
      <I18nextProvider i18n={i18n}>
        <CorrelationDetail error={error} lng="en" />
        <CorrelationDetail error={error} lng="fr" />
      </I18nextProvider>,
    );
    expect(screen.getByText('Correlation ID:')).toBeVisible();
    expect(screen.getByText('Identifiant de corrélation :')).toBeVisible();
    expect(screen.getAllByText(error.correlationId)).toHaveLength(2);
  });

  it.each([undefined, new Error('Synthetic failure'), { name: 'AppError' }, { name: 'AppError', correlationId: ' ' }])('renders nothing for unavailable IDs', (error) => {
    const { container } = render(<CorrelationDetail error={error} />);
    expect(container).toBeEmptyDOMElement();
  });
});
