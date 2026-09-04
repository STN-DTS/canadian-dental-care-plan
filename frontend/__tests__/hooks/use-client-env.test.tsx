import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { ClientEnvProvider } from '~/components/client-env-context';
import { useClientEnv, useFeature } from '~/hooks';
import { clientEnvSchema } from '~/utils/env-utils';

const env = clientEnvSchema.parse({
  BUILD_ID: 'client-env-context-test',
  ENABLED_FEATURES: 'show-prototype-banner',
});

function ClientEnvConsumer() {
  const clientEnv = useClientEnv();
  const showPrototypeBanner = useFeature('show-prototype-banner');
  return <output>{`${clientEnv.BUILD_ID}:${showPrototypeBanner}`}</output>;
}

describe('useClientEnv', () => {
  it('provides client environment variables without route loader data', () => {
    render(
      <ClientEnvProvider env={env}>
        <ClientEnvConsumer />
      </ClientEnvProvider>,
    );

    expect(screen.getByText('client-env-context-test:true')).toBeInTheDocument();
  });

  it('throws when rendered without a provider', () => {
    expect(() => render(<ClientEnvConsumer />)).toThrow('Expected ClientEnvProvider to be defined');
  });
});
