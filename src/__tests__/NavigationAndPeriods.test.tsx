import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';
import { MobileNav } from '../components/layout/MobileNav';
import { getReportRange, isInReportRange } from '../components/dashboard/reportPeriod';

vi.mock('../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

describe('Fechas contables de El Salvador', () => {
  it('uses the Salvadoran day when UTC has already advanced to the next day', () => {
    expect(getReportRange('hoy', new Date('2026-10-21T03:00:00Z'))).toEqual({ start: '2026-10-20', end: '2026-10-20' });
  });

  it('starts the current week on Monday and ends on the current local day', () => {
    expect(getReportRange('semana', new Date('2026-10-21T03:00:00Z'))).toEqual({ start: '2026-10-19', end: '2026-10-20' });
    expect(getReportRange('semana', new Date('2026-10-26T03:00:00Z'))).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });

  it('limits the current month to today rather than including future records', () => {
    expect(getReportRange('mes', new Date('2026-10-21T03:00:00Z'))).toEqual({ start: '2026-10-01', end: '2026-10-20' });
  });

  it('handles the previous month across a year boundary and leap-year February', () => {
    expect(getReportRange('anterior', new Date('2026-01-15T12:00:00Z'))).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    expect(getReportRange('anterior', new Date('2024-03-15T12:00:00Z'))).toEqual({ start: '2024-02-01', end: '2024-02-29' });
  });

  it('preserves explicit custom limits and includes both boundaries', () => {
    const range = getReportRange('personalizado', new Date('2026-10-20T12:00:00Z'), '2026-09-05', '2026-09-10');
    expect(isInReportRange('2026-09-05', range)).toBe(true);
    expect(isInReportRange('2026-09-10', range)).toBe(true);
    expect(isInReportRange('2026-09-04', range)).toBe(false);
    expect(isInReportRange('2026-09-11', range)).toBe(false);
  });

  it('excludes records when custom limits are empty or inverted', () => {
    expect(isInReportRange('2026-10-10', { start: '', end: '2026-10-20' })).toBe(false);
    expect(isInReportRange('2026-10-10', { start: '2026-10-20', end: '' })).toBe(false);
    expect(isInReportRange('2026-10-10', { start: '2026-10-20', end: '2026-10-01' })).toBe(false);
  });
});

const ActiveView = () => <output aria-label="Vista activa">{useApp().currentView}</output>;

describe('Navegación móvil', () => {
  beforeEach(() => localStorage.clear());
  const renderNavigation = () => render(<AppProvider><MobileNav /><ActiveView /></AppProvider>);

  it('opens Más módulos and navigates to Compras and Configuración', () => {
    renderNavigation();
    const more = screen.getByRole('button', { name: 'Más módulos' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Compras' }));
    expect(screen.getByLabelText('Vista activa')).toHaveTextContent('purchases');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('button', { name: 'Configuración' }));
    expect(screen.getByLabelText('Vista activa')).toHaveTextContent('settings');
    expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes Más módulos with Escape and restores keyboard focus', () => {
    renderNavigation();
    const more = screen.getByRole('button', { name: 'Más módulos' });
    fireEvent.click(more);
    screen.getByRole('button', { name: 'Compras' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Compras' })).not.toBeInTheDocument();
  });

  it('closes the extra modules when clicking outside the navigation', () => {
    renderNavigation();
    const more = screen.getByRole('button', { name: 'Más módulos' });
    fireEvent.click(more);
    fireEvent.mouseDown(document.body);
    expect(more).toHaveAttribute('aria-expanded', 'false');
  });
});
