import { use } from 'react';

import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { NonceContext, NonceProvider } from '~/components/nonce-context';

describe('NonceContext', () => {
  it('should provide the NonceContext to its children', () => {
    const TestComponent = () => <div>nonce is [{use(NonceContext).nonce}]</div>;

    render(
      <NonceProvider nonce={'0123456789ABCDEF'}>
        <TestComponent />
      </NonceProvider>,
    );

    expect(screen.getByText('nonce is [0123456789ABCDEF]')).toBeInTheDocument();
  });
});
