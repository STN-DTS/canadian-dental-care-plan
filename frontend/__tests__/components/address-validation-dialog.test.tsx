import { render } from '@testing-library/react';

import type { Form, useFetcher } from 'react-router';

import { describe, expect, it, vi } from 'vitest';

import { AddressInvalidDialogContent, AddressSuggestionDialogContent } from '~/components/address-validation-dialog';
import { Dialog } from '~/components/dialog';

vi.mock(import('react-router'), () => {
  return {
    createContext: vi.fn(),
    useFetcher: vi.fn<typeof useFetcher<undefined>>().mockImplementation(() => ({
      data: undefined,
      Form: vi.fn<typeof Form>().mockImplementation(({ children, method }) => {
        return <form method={method}>{children}</form>;
      }),
      formAction: undefined,
      formData: undefined,
      formEncType: undefined,
      formMethod: undefined,
      json: undefined,
      load: vi.fn(),
      reset: vi.fn(),
      state: 'idle',
      submit: vi.fn(),
      text: undefined,
    })),
  };
});

vi.mock(import('~/components/csrf-token-input'));

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
