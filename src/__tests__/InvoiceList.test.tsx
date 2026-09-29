import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceList } from '../components/billing/InvoiceList';
import { AppProvider } from '../context/AppContext';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('InvoiceList Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderInvoiceList = () => {
    return render(
      <AppProvider>
        <InvoiceList />
      </AppProvider>
    );
  };

  it('renders invoice list title and emit button', () => {
    renderInvoiceList();
    expect(screen.getByText(/Documentos Tributarios Emitidos \(DTE\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Emitir Nuevo DTE/i })).toBeInTheDocument();
  });

  it('renders initial mock invoices in table', () => {
    renderInvoiceList();
    expect(screen.getAllByText(/DTE-03/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/DTE-01/i).length).toBeGreaterThan(0);
    const verButtons = screen.getAllByRole('button', { name: /Ver/i });
    expect(verButtons.length).toBeGreaterThan(0);
  });

  it('filters invoices by search term (client or control number)', () => {
    renderInvoiceList();
    const searchInput = screen.getByPlaceholderText(/Buscar por cliente o # control/i);

    fireEvent.change(searchInput, { target: { value: 'Santa Lucía' } });
    expect(screen.getByText(/Santa Lucía/i)).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT_CLIENT_XYZ' } });
    expect(screen.getByText(/No se encontraron documentos emitidos en este filtro/i)).toBeInTheDocument();
  });

  it('filters invoices by DTE type button', () => {
    renderInvoiceList();

    // Click DTE-01 filter
    const dte01Btn = screen.getByRole('button', { name: 'DTE-01' });
    fireEvent.click(dte01Btn);

    // Click 'Todos' to restore
    const allBtn = screen.getByRole('button', { name: 'Todos' });
    fireEvent.click(allBtn);
    expect(screen.getAllByText(/DTE-03/i).length).toBeGreaterThan(0);
  });
});
