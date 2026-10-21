import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardView } from '../components/dashboard/DashboardView';
import { AppProvider } from '../context/AppContext';
import { INITIAL_INVOICES, INITIAL_PURCHASES } from '../data/mockData';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('DashboardView Component & Fiscal Calculations', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T03:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const renderDashboard = () => {
    return render(
      <AppProvider>
        <DashboardView />
      </AppProvider>
    );
  };

  it('renders dashboard title, active company name and NRC', () => {
    renderDashboard();
    expect(screen.getByText(/Así va tu negocio/i)).toBeInTheDocument();
    expect(screen.getByText(/Distribuidora Cuscatlán, S.A. de C.V./i)).toBeInTheDocument();
    expect(screen.getByText(/289410-4/i)).toBeInTheDocument();
  });

  it('renders KPI metric cards for Ventas, Débito Fiscal, Compras and Crédito Fiscal', () => {
    renderDashboard();
    expect(screen.getByText(/Ventas Facturadas/i)).toBeInTheDocument();
    expect(screen.getByText(/IVA de tus ventas/i)).toBeInTheDocument();
    expect(screen.getByText(/Compras Registradas/i)).toBeInTheDocument();
    expect(screen.getByText(/IVA de tus compras/i)).toBeInTheDocument();
  });

  it('renders F07 liquidación box with tax balance', () => {
    renderDashboard();
    expect(screen.getByText(/FORMULARIO F07 MINISTERIO DE HACIENDA/i)).toBeInTheDocument();
    expect(screen.getByText(/Liquidación de IVA del período/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar libros de IVA/i })).toBeInTheDocument();
  });

  it('allows switching period filter (mes, semana, hoy)', () => {
    renderDashboard();
    const hoyBtn = screen.getByRole('button', { name: /Hoy/i });
    fireEvent.click(hoyBtn);
    expect(hoyBtn).toHaveAttribute('aria-pressed', 'true');

    const mesBtn = screen.getByRole('button', { name: /^Este Mes$/i });
    fireEvent.click(mesBtn);
    expect(mesBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders quick launchpad for all 5 DTE types', () => {
    renderDashboard();
    expect(screen.getByText(/Preparar un documento/i)).toBeInTheDocument();
    expect(screen.getByText(/Factura de Consumidor Final/i)).toBeInTheDocument();
    expect(screen.getByText(/Comprobante de Crédito Fiscal/i)).toBeInTheDocument();
    expect(screen.getByText(/Factura de Sujeto Excluido/i)).toBeInTheDocument();
  });

  it('renders recent DTE transactions table', () => {
    renderDashboard();
    expect(screen.getByText(/Documentos recientes del período/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver todos/i })).toBeInTheDocument();
  });

  const seedFinancialDocuments = () => {
    const base = INITIAL_INVOICES[0];
    localStorage.setItem('sivarconta_invoices', JSON.stringify([
      { ...base, id: 'sale', clientName: 'Venta de hoy', emissionDate: '2026-10-20', dteType: '03', status: 'PROCESADO_MH', totalPagar: 1130, iva13: 130 },
      { ...base, id: 'credit-note', clientName: 'Devolución de ayer', emissionDate: '2026-10-19', dteType: '05', status: 'PROCESADO_MH', totalPagar: 226, iva13: 26 },
      { ...base, id: 'draft', emissionDate: '2026-10-20', status: 'BORRADOR', totalPagar: 5000, iva13: 500 },
      { ...base, id: 'invalidated', emissionDate: '2026-10-20', status: 'INVALIDADO', totalPagar: 6000, iva13: 600 },
      { ...base, id: 'excluded', emissionDate: '2026-10-20', dteType: '14', status: 'PROCESADO_MH', totalPagar: 7000, iva13: 700 },
      { ...base, id: 'previous', clientName: 'Venta del mes anterior', emissionDate: '2026-09-15', status: 'PROCESADO_MH', totalPagar: 345.67, iva13: 39.77 },
    ]));
    localStorage.setItem('sivarconta_purchases', JSON.stringify([
      { ...INITIAL_PURCHASES[0], id: 'purchase', emissionDate: '2026-10-20', docType: 'CCF', totalPagar: 452, creditoFiscal: 52 },
      { ...INITIAL_PURCHASES[0], id: 'purchase-credit', emissionDate: '2026-10-19', docType: 'NOTA_CREDITO', totalPagar: 56.5, creditoFiscal: 6.5 },
      { ...INITIAL_PURCHASES[0], id: 'old-purchase', emissionDate: '2026-09-15', totalPagar: 9000, creditoFiscal: 1000 },
    ]));
  };

  it('uses only processed sales in the period, subtracting credit notes and excluding drafts, invalidated documents and DTE-14', () => {
    seedFinancialDocuments();
    renderDashboard();
    expect(screen.getByText('$904.00')).toBeInTheDocument();
    expect(screen.getByText('$104.00')).toBeInTheDocument();
    expect(screen.getByText('$395.50')).toBeInTheDocument();
    expect(screen.getByText('$45.50')).toBeInTheDocument();
    expect(screen.queryByText('Venta del mes anterior')).not.toBeInTheDocument();
  });

  it('changes dates and amounts when switching Hoy and Mes anterior', () => {
    seedFinancialDocuments();
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.getByRole('status')).toHaveTextContent('2026-10-20 al 2026-10-20');
    expect(screen.queryByText('$904.00')).not.toBeInTheDocument();
    expect(screen.getAllByText('$1,130.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('Devolución de ayer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('status')).toHaveTextContent('2026-09-01 al 2026-09-30');
    expect(screen.getByText('Venta del mes anterior')).toBeInTheDocument();
    expect(screen.queryByText('Venta de hoy')).not.toBeInTheDocument();
    expect(screen.getAllByText('$345.67').length).toBeGreaterThan(0);
  });

  it('applies a custom date interval and announces an inverted interval', () => {
    seedFinancialDocuments();
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Rango personalizado' }));
    fireEvent.change(screen.getByLabelText('Desde', { exact: true }), { target: { value: '2026-10-19' } });
    fireEvent.change(screen.getByLabelText('Hasta', { exact: true }), { target: { value: '2026-10-19' } });
    expect(screen.getAllByText('$-226.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Devolución de ayer')).toBeInTheDocument();
    expect(screen.queryByText('Venta de hoy')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Desde', { exact: true }), { target: { value: '2026-10-21' } });
    expect(screen.getByRole('alert')).toHaveTextContent('rango válido');
    expect(screen.getByRole('status')).toHaveTextContent('Período pendiente de corregir');
    expect(screen.queryByText('Devolución de ayer')).not.toBeInTheDocument();
  });
});
