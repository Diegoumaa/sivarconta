import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { InvoiceList } from '../components/billing/InvoiceList';
import { AppProvider } from '../context/AppContext';
import { INITIAL_INVOICES } from '../data/mockData';

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
    expect(screen.getByText(/Facturas y documentos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nueva factura/i })).toBeInTheDocument();
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

  const seedInvoices = () => {
    const base = INITIAL_INVOICES[0];
    localStorage.setItem('sivarconta_invoices', JSON.stringify([
      { ...base, id: 'processed', controlNumber: 'DTE-01-M001P001-000000000000901', clientName: 'Cliente procesado', dteType: '01', emissionDate: '2026-10-01', status: 'PROCESADO_MH' },
      { ...base, id: 'draft', controlNumber: 'DTE-03-M001P001-000000000000902', clientName: 'Cliente borrador', dteType: '03', emissionDate: '2026-10-20', status: 'BORRADOR' },
      { ...base, id: 'invalidated', controlNumber: 'DTE-03-M001P001-000000000000903', clientName: 'Cliente invalidado', dteType: '03', emissionDate: '2026-09-30', status: 'INVALIDADO' },
    ]));
  };

  it('searches documents by emission date', () => {
    seedInvoices();
    renderInvoiceList();
    fireEvent.change(screen.getByRole('textbox', { name: /Buscar facturas/i }), { target: { value: '2026-10-20' } });
    expect(screen.getByText('Cliente borrador')).toBeInTheDocument();
    expect(screen.queryByText('Cliente procesado')).not.toBeInTheDocument();
    expect(screen.queryByText('Cliente invalidado')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 documentos');
  });

  it('identifies missing items within the active company even when search hides the row', () => {
    const base = INITIAL_INVOICES[0];
    localStorage.setItem('sivarconta_invoices', JSON.stringify([
      { ...base, id: 'missing', clientName: 'Registro incompleto', items: [] },
      { ...base, id: 'complete', clientName: 'Registro completo' },
      { ...base, id: 'other-company', companyId: 'other-company', items: [] },
    ]));
    renderInvoiceList();
    expect(screen.getByRole('alert')).toHaveTextContent('1 documento sin partidas');
    const incompleteRow = screen.getByText('Registro incompleto').closest('tr')!;
    expect(within(incompleteRow).getByText('Incompleto · sin partidas')).toBeInTheDocument();
    expect(within(incompleteRow).getByRole('button', { name: 'Ver' })).toBeEnabled();
    expect(within(screen.getByText('Registro completo').closest('tr')!).queryByText('Incompleto · sin partidas')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /Buscar facturas/i }), { target: { value: 'Registro completo' } });
    expect(screen.queryByText('Registro incompleto')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('1 documento sin partidas');
  });

  it('includes both boundaries in the date interval', () => {
    seedInvoices();
    renderInvoiceList();
    fireEvent.change(screen.getByLabelText('Facturas desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Facturas hasta'), { target: { value: '2026-10-20' } });
    expect(screen.getByText('Cliente procesado')).toBeInTheDocument();
    expect(screen.getByText('Cliente borrador')).toBeInTheDocument();
    expect(screen.queryByText('Cliente invalidado')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 documentos');
  });

  it('shows an actual draft or invalidated status instead of calling every document processed', () => {
    seedInvoices();
    renderInvoiceList();
    expect(within(screen.getByText('Cliente borrador').closest('tr')!).getByText('Borrador · sin transmitir')).toBeInTheDocument();
    expect(within(screen.getByText('Cliente invalidado').closest('tr')!).getByText('Invalidado')).toBeInTheDocument();
    expect(within(screen.getByText('Cliente procesado').closest('tr')!).getByText('Procesado MH')).toBeInTheDocument();
  });

  it('combines status and date filters, then clears them together', () => {
    seedInvoices();
    renderInvoiceList();
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado del documento' }), { target: { value: 'BORRADOR' } });
    fireEvent.change(screen.getByLabelText('Facturas desde'), { target: { value: '2026-10-01' } });
    expect(screen.getByText('Cliente borrador')).toBeInTheDocument();
    expect(screen.queryByText('Cliente procesado')).not.toBeInTheDocument();
    expect(screen.queryByText('Cliente invalidado')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('status')).toHaveTextContent('3 documentos');
    expect(screen.getByLabelText('Facturas desde')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Estado del documento' })).toHaveValue('ALL');
  });

  it('announces an inverted interval and restores documents from the empty state', () => {
    seedInvoices();
    renderInvoiceList();
    fireEvent.change(screen.getByLabelText('Facturas desde'), { target: { value: '2026-10-21' } });
    fireEvent.change(screen.getByLabelText('Facturas hasta'), { target: { value: '2026-10-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('fecha inicial');
    expect(screen.getByRole('status')).toHaveTextContent('0 documentos');
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer filtros' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('3 documentos');
  });
});
