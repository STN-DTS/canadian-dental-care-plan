import { renderHook } from '@testing-library/react';

import { useNavigate, useNavigation } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useApplicationFlowCheck } from '~/hooks/use-application-flow-check';
import { useApplicationFlowStorage } from '~/hooks/use-application-flow-storage';

vi.mock('react-router', () => ({
  createContext: vi.fn(),
  useNavigate: vi.fn(),
  useNavigation: vi.fn(),
}));

vi.mock('~/hooks/use-application-flow-storage', () => ({
  useApplicationFlowStorage: vi.fn(),
}));

describe('useApplicationFlowCheck', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useNavigation, { partial: true }).mockReturnValue({ state: 'idle' });
    vi.mocked(useApplicationFlowStorage, { partial: true }).mockReturnValue({ enabled: true, value: 'active' });
  });

  it('should not navigate when flow is active', () => {
    vi.mocked(useApplicationFlowStorage, { partial: true }).mockReturnValue({ enabled: true, value: 'active' });

    renderHook(() => useApplicationFlowCheck({ id: 'test-id', indexRoutePath: '/index' }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should navigate to indexRoutePath when flow value is not active', () => {
    vi.mocked(useApplicationFlowStorage, { partial: true }).mockReturnValue({ enabled: true, value: undefined });

    renderHook(() => useApplicationFlowCheck({ id: 'test-id', indexRoutePath: '/index' }));

    expect(mockNavigate).toHaveBeenCalledWith('/index', { replace: true });
  });

  it('should not navigate when storage is not enabled', () => {
    vi.mocked(useApplicationFlowStorage, { partial: true }).mockReturnValue({ enabled: false, value: undefined });

    renderHook(() => useApplicationFlowCheck({ id: 'test-id', indexRoutePath: '/index' }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate when router is not idle', () => {
    vi.mocked(useNavigation, { partial: true }).mockReturnValue({ state: 'loading' });
    vi.mocked(useApplicationFlowStorage, { partial: true }).mockReturnValue({ enabled: true, value: undefined });

    renderHook(() => useApplicationFlowCheck({ id: 'test-id', indexRoutePath: '/index' }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should only check the flow once per render cycle (not navigate twice on rerender)', () => {
    vi.mocked(useApplicationFlowStorage, { partial: true }).mockReturnValue({ enabled: true, value: undefined });

    const { rerender } = renderHook(() => useApplicationFlowCheck({ id: 'test-id', indexRoutePath: '/index' }));
    rerender();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('should re-check the flow when the id changes', () => {
    vi.mocked(useApplicationFlowStorage, { partial: true }).mockReturnValue({ enabled: true, value: undefined });

    const { rerender } = renderHook(({ id, indexRoutePath }: { id: string; indexRoutePath: string }) => useApplicationFlowCheck({ id, indexRoutePath }), { initialProps: { id: 'id-1', indexRoutePath: '/index' } });

    expect(mockNavigate).toHaveBeenCalledTimes(1);

    // changing both id and indexRoutePath: the id change resets the completion ref,
    // and the indexRoutePath change triggers the second effect to re-run
    rerender({ id: 'id-2', indexRoutePath: '/new-index' });

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenLastCalledWith('/new-index', { replace: true });
  });

  it('should call useApplicationFlowStorage with the provided id', () => {
    renderHook(() => useApplicationFlowCheck({ id: 'my-app-id', indexRoutePath: '/index' }));

    expect(useApplicationFlowStorage).toHaveBeenCalledWith('my-app-id');
  });
});
