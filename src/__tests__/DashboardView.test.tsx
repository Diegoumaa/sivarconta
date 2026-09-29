import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardView } from '../components/dashboard/DashboardView';
import { AppProvider } from '../context/AppContext';

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
  });

  const renderDashboard = () => {
    return render(
      <AppProvider>
        <DashboardView />
      </AppProvider>
    );
  };

  it('renders dashboard title, active company name and NRC', () => {
    renderDashboard();
    expect(screen.getByText(/Dashboard Financiero & Tributario/i)).toBeInTheDocument();
    expect(screen.getByText(/Distribuidora Cuscatlán, S.A. de C.V./i)).toBeInTheDocument();
    expect(screen.getByText(/289410-4/i)).toBeInTheDocument();
  });

  it('renders KPI metric cards for Ventas, Débito Fiscal, Compras and Crédito Fiscal', () => {
    renderDashboard();
    expect(screen.getByText(/Ventas Facturadas/i)).toBeInTheDocument();
    expect(screen.getByText(/Débito Fiscal \(IVA 13%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Compras Registradas/i)).toBeInTheDocument();
    expect(screen.getByText(/Crédito Fiscal \(Compras\)/i)).toBeInTheDocument();
  });

  it('renders F07 liquidación box with tax balance', () => {
    renderDashboard();
    expect(screen.getByText(/FORMULARIO F07 MINISTERIO DE HACIENDA/i)).toBeInTheDocument();
    expect(screen.getByText(/Liquidación de IVA del Mes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver Libros Oficiales F07/i })).toBeInTheDocument();
  });

  it('allows switching period filter (mes, semana, hoy)', () => {
    renderDashboard();
    const hoyBtn = screen.getByRole('button', { name: /Hoy/i });
    fireEvent.click(hoyBtn);
    expect(hoyBtn).toHaveClass('bg-white');

    const mesBtn = screen.getByRole('button', { name: /^Este Mes$/i });
    fireEvent.click(mesBtn);
    expect(mesBtn).toHaveClass('bg-white');
  });

  it('renders quick launchpad for all 5 DTE types', () => {
    renderDashboard();
    expect(screen.getByText(/Emisión Rápida de DTEs/i)).toBeInTheDocument();
    expect(screen.getByText(/Factura de Consumidor Final/i)).toBeInTheDocument();
    expect(screen.getByText(/Comprobante de Crédito Fiscal/i)).toBeInTheDocument();
    expect(screen.getByText(/Factura de Sujeto Excluido/i)).toBeInTheDocument();
  });

  it('renders recent DTE transactions table', () => {
    renderDashboard();
    expect(screen.getByText(/Últimos Documentos Transmitidos a Hacienda/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver todos/i })).toBeInTheDocument();
  });
});
