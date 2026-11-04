import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enDocuments from '~/.server/locales/en/documents';
import frDocuments from '~/.server/locales/fr/documents';
import { FileUpload, FileUploadList } from '~/components/file-upload';
import { TooltipProvider } from '~/components/tooltip';
import { useHints } from '~/hooks/use-hints';
import { UploadedDocumentUploadItem } from '~/routes/protected/documents/upload/components/uploaded-document-upload-item';
import { toLocaleString } from '~/utils/date-utils';

vi.unmock(import('react-i18next'));
vi.mock(import('~/hooks/use-hints'));

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const dateCases = [
  { uploadDate: '2026-03-08T06:59:00Z', timeZone: 'America/Toronto', en: 'March 8, 2026 at 1:59 a.m. EST', fr: '8 mars 2026 \u00e0 01 h 59 HNE' },
  { uploadDate: '2026-03-08T07:00:00Z', timeZone: 'America/Toronto', en: 'March 8, 2026 at 3:00 a.m. EDT', fr: '8 mars 2026 \u00e0 03 h 00 HAE' },
  { uploadDate: '2026-11-01T05:30:00Z', timeZone: 'America/Toronto', en: 'November 1, 2026 at 1:30 a.m. EDT', fr: '1 novembre 2026 \u00e0 01 h 30 HAE' },
  { uploadDate: '2026-11-01T06:30:00Z', timeZone: 'America/Toronto', en: 'November 1, 2026 at 1:30 a.m. EST', fr: '1 novembre 2026 \u00e0 01 h 30 HNE' },
  { uploadDate: '2026-03-08T09:59:00Z', timeZone: 'America/Vancouver', en: 'March 8, 2026 at 1:59 a.m. PST', fr: '8 mars 2026 \u00e0 01 h 59 HNP' },
  { uploadDate: '2026-03-08T10:00:00Z', timeZone: 'America/Vancouver', en: 'March 8, 2026 at 3:00 a.m. PDT', fr: '8 mars 2026 \u00e0 03 h 00 HAP' },
  { uploadDate: '2025-11-02T08:30:00Z', timeZone: 'America/Vancouver', en: 'November 2, 2025 at 1:30 a.m. PDT', fr: '2 novembre 2025 \u00e0 01 h 30 HAP' },
  { uploadDate: '2025-11-02T09:30:00Z', timeZone: 'America/Vancouver', en: 'November 2, 2025 at 1:30 a.m. PST', fr: '2 novembre 2025 \u00e0 01 h 30 HNP' },
  { uploadDate: '2026-11-01T06:30:00Z', timeZone: 'America/Regina', en: 'November 1, 2026 at 12:30 a.m. CST', fr: '1 novembre 2026 \u00e0 00 h 30 HNC' },
];

async function renderItem(locale: 'en' | 'fr', uploadDate: string, timeZone: string) {
  vi.mocked(useHints).mockReturnValue({ timeZone });
  const i18n = createInstance();
  await i18n.init({ lng: locale, fallbackLng: false, resources: { en: { documents: enDocuments }, fr: { documents: frDocuments } } });
  const file = new File(['evidence'], 'EmploymentLetter.pdf', { type: 'application/pdf' });

  return render(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <FileUpload value={[{ id: 'uploaded', file }]} onValueChange={vi.fn()}>
          <FileUploadList>
            <UploadedDocumentUploadItem id="uploaded" fileName={file.name} documentTypeName={locale === 'en' ? 'Employment Letter' : "Lettre de l'employeur"} uploadDate={uploadDate} />
          </FileUploadList>
        </FileUpload>
      </TooltipProvider>
    </I18nextProvider>,
  );
}

describe.each(['en', 'fr'] as const)('uploaded document date (%s)', (locale) => {
  it.each(dateCases)('shows retained $uploadDate inline and in the tooltip in $timeZone', async ({ uploadDate, timeZone, ...expected }) => {
    const user = userEvent.setup();
    const { container } = await renderItem(locale, uploadDate, timeZone);
    const dateText = expected[locale];
    const item = screen.getByRole('listitem');
    const time = container.querySelector('time');

    expect(time).toHaveAttribute('dateTime', uploadDate);
    expect(time).toHaveTextContent(dateText);
    expect(dateText).toBe(toLocaleString(Temporal.Instant.from(uploadDate), locale, { timeZone }));
    expect(time?.parentElement).toHaveAccessibleName(dateText);
    const uploadedOnLabel = within(item).getAllByRole('term')[2];
    expect(uploadedOnLabel?.textContent).toBe(locale === 'en' ? 'Uploaded on: ' : 'T\u00e9l\u00e9vers\u00e9 le\u00A0: ');
    expect(within(item).getByText('EmploymentLetter.pdf')).toHaveRole('definition');
    expect(within(item).getByText(locale === 'en' ? 'Employment Letter' : "Lettre de l'employeur")).toHaveRole('definition');
    expect(item).toHaveClass('rounded-none', 'border-green-700', 'p-4');
    expect(item.querySelector('input, select, textarea, button')).toBeNull();

    await user.hover(time!.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(dateText);
  });
});
