import { render } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import { AddressInvalidDialogContent, AddressSuggestionDialogContent } from '~/components/address-validation-dialog';
import { Dialog } from '~/components/dialog';

vi.mock('react-router', () => ({
  createContext: vi.fn(),
  useFetcher: vi.fn(() => ({
    Form: vi.fn(({ children, method, noValidate }) => <form method={method}>{children}</form>),
    state: 'idle',
  })),
}));

vi.mock('~/components/csrf-token-input');

describe('AddressInvalidDialogContent', () => {
  it('should render the AddressInvalidDialogContent', async () => {
    const { getByRole } = render(
      <Dialog open={true} defaultOpen={true}>
        <AddressInvalidDialogContent
          formAction="use-invalid-address"
          addressContext="mailingAddress"
          invalidAddress={{
            address: '1234 Retemele ST',
            city: 'Ottawa',
            countryId: '1',
            country: 'CA',
            postalZipCode: 'E5E 4A2',
            provinceStateId: '2',
            provinceState: 'ON',
          }}
        />
      </Dialog>,
    );

    await vi.waitFor(() => {
      expect(getByRole('dialog')).toBeInTheDocument();
    });

    expect(getByRole('dialog')).toMatchSnapshot('expected html');
  });
});

describe('AddressSuggestionDialogContent', () => {
  it('should render the AddressSuggestionDialogContent', async () => {
    const { getByRole } = render(
      <Dialog open={true} defaultOpen={true}>
        <AddressSuggestionDialogContent
          formAction="use-suggested-address"
          enteredAddress={{
            address: '1234 Retemele ST',
            city: 'Ottawa',
            countryId: '1',
            country: 'CA',
            postalZipCode: 'E5E 4A2',
            provinceStateId: '2',
            provinceState: 'ON',
          }}
          suggestedAddress={{
            address: '1234 Remetale Avenue',
            city: 'Ottawa',
            countryId: '1',
            country: 'CA',
            postalZipCode: 'K5E 4A2',
            provinceStateId: '2',
            provinceState: 'ON',
          }}
        />
      </Dialog>,
    );

    await vi.waitFor(() => {
      expect(getByRole('dialog')).toBeInTheDocument();
    });

    expect(getByRole('dialog')).toMatchSnapshot('expected html');
  });
});
