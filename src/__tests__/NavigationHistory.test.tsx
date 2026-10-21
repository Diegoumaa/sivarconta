import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NavigationProvider, useNavigation, viewFromHash } from '../context/NavigationContext';
import { INITIAL_INVOICES } from '../data/mockData';
const wrapper = ({ children }: { children: React.ReactNode }) => <NavigationProvider>{children}</NavigationProvider>;

describe('Shareable navigation and browser history', () => {
  it('restores the requested view after reloading the provider', () => {
    window.history.replaceState(null, '', '#/compras');
    const first = renderHook(useNavigation, { wrapper });
    expect(first.result.current.currentView).toBe('purchases');
    first.unmount();
    expect(renderHook(useNavigation, { wrapper }).result.current.currentView).toBe('purchases');
  });
  it('supports Back and Forward and closes an unrelated invoice preview', async () => {
    window.history.replaceState(null, '', '#/inicio');
    const { result } = renderHook(useNavigation, { wrapper });
    act(() => result.current.setCurrentView('clients'));
    act(() => result.current.setActiveDtePreview(INITIAL_INVOICES[0]));
    act(() => window.history.back());
    await waitFor(() => expect(result.current.currentView).toBe('dashboard'));
    expect(result.current.activeDtePreview).toBeNull();
    act(() => window.history.forward());
    await waitFor(() => expect(result.current.currentView).toBe('clients'));
  });
  it('keeps the chosen DTE type when starting a new document', () => {
    const { result } = renderHook(useNavigation, { wrapper });
    act(() => result.current.startNewInvoiceWithDte('03'));
    expect(result.current.selectedDteTypeForNew).toBe('03');
    expect(result.current.currentView).toBe('new-invoice');
    expect(window.location.hash).toBe('#/facturas/nueva');
  });
  it('safely handles unknown URLs and object prototype property names', () => {
    expect(viewFromHash('#/no-existe')).toBe('dashboard');
    const { result } = renderHook(useNavigation, { wrapper });
    act(() => result.current.setCurrentView('__proto__'));
    expect(result.current.currentView).toBe('dashboard');
    expect(window.location.hash).toBe('#/inicio');
  });
});
