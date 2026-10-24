import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { DataProvider, useDataContext } from '../DataContext';

/**
 * Tests for the Phase 6 readOnly connection state in DataContext.
 */
describe('DataContext - readOnly', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DataProvider>{children}</DataProvider>
  );

  test('defaults to writable (false)', () => {
    const { result } = renderHook(() => useDataContext(), { wrapper });
    expect(result.current.state.readOnly).toBe(false);
  });

  test('setReadOnly toggles the flag', () => {
    const { result } = renderHook(() => useDataContext(), { wrapper });

    act(() => {
      result.current.actions.setReadOnly(true);
    });
    expect(result.current.state.readOnly).toBe(true);

    act(() => {
      result.current.actions.setReadOnly(false);
    });
    expect(result.current.state.readOnly).toBe(false);
  });
});
