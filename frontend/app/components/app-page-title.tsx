import type { PropsWithChildren } from 'react';
import { useRef } from 'react';

import { useTranslation } from 'react-i18next';

import { PageTitle } from '~/components/page-title';
import { useAccessibleFocusManagement } from '~/hooks';

export function AppPageTitle({ children }: PropsWithChildren) {
  const { t } = useTranslation('gcweb');

  const focusableElementRef = useRef<HTMLHeadingElement | null>(null);
  useAccessibleFocusManagement(focusableElementRef);

  return (
    <div className="my-8 max-w-prose after:mt-2 after:block after:h-1.5 after:w-18 after:bg-[#a62a1e] after:content-['']">
      <h2 className="mb-2 font-lato font-semibold">{t(($) => $.header.applicationTitle)}</h2>
      <PageTitle ref={focusableElementRef}>{children}</PageTitle>
    </div>
  );
}
