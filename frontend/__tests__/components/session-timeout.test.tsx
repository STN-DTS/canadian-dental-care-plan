import { act, fireEvent, render, screen } from '@testing-library/react';

import { createRoutesStub } from 'react-router';

import { useIdleTimer } from 'react-idle-timer';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionTimeoutProps } from '~/components/session-timeout';
import SessionTimeout from '~/components/session-timeout';

vi.mock(import('react-idle-timer'));

describe('SessionTimeout', () => {
  const mockActivate = vi.fn();
  const mockIsPrompted = vi.fn();
  const mockGetRemainingTime = vi.fn();

  beforeEach(() => {
    (useIdleTimer as Mock).mockReturnValue({
      activate: mockActivate,
      isPrompted: mockIsPrompted,
      getRemainingTime: mockGetRemainingTime,
    });
  });

  const setup = (props: Partial<SessionTimeoutProps> = {}) => {
    const defaultProps = {
      promptBeforeIdle: 30_000,
      timeout: 60_000,
      onSessionEnd: vi.fn(),
      onSessionExtend: vi.fn(),
    };

    const RoutesStub = createRoutesStub([
      {
        Component: () => <SessionTimeout {...defaultProps} {...props} />,
        path: '/',
      },
    ]);

    return render(<RoutesStub />);
  };

  it('should render the session timeout dialog when prompted', () => {
    mockIsPrompted.mockReturnValue(true);

    setup();

    expect(screen.getByText('sessionTimeout.header')).toBeInTheDocument();
    expect(screen.getByText('sessionTimeout.endSession')).toBeInTheDocument();
    expect(screen.getByText('sessionTimeout.continueSession')).toBeInTheDocument();
  });

  it('should call `onSessionEnd` when the "End Session" button is clicked', () => {
    const onSessionEnd = vi.fn();
    mockIsPrompted.mockReturnValue(true);

    setup({ onSessionEnd });

    const endSessionButton = screen.getByText('sessionTimeout.endSession');

    act(() => {
      fireEvent.click(endSessionButton);
    });

    expect(onSessionEnd).toHaveBeenCalled();
  });

  it('should call `onSessionExtend` when the "Continue Session" button is clicked', () => {
    const onSessionExtend = vi.fn();
    mockIsPrompted.mockReturnValue(true);

    setup({ onSessionExtend });

    const continueSessionButton = screen.getByText('sessionTimeout.continueSession');

    act(() => {
      fireEvent.click(continueSessionButton);
    });

    expect(onSessionExtend).toHaveBeenCalled();
  });

  it('should activate the IdleTimer on location change', () => {
    mockIsPrompted.mockReturnValue(false);

    setup();

    expect(mockActivate).toHaveBeenCalled();
  });

  it('should update the remaining time every second', () => {
    mockIsPrompted.mockReturnValue(true);
    mockGetRemainingTime.mockReturnValue(50_000);

    vi.useFakeTimers({ shouldAdvanceTime: true });

    setup();

    expect(screen.getByText(`{"key":"sessionTimeout.description","options":{"timeRemaining":"0:50"}}`)).toBeInTheDocument();

    act(() => {
      mockGetRemainingTime.mockReturnValue(49_000);
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(`{"key":"sessionTimeout.description","options":{"timeRemaining":"0:49"}}`)).toBeInTheDocument();

    vi.useRealTimers();
  });
});
