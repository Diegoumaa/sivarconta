import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsView } from '../components/settings/SettingsView';
import { AppProvider } from '../context/AppContext';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('SettingsView Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderSettings = () => {
    return render(
      <AppProvider>
        <SettingsView />
      </AppProvider>
    );
  };

  it('renders settings title and active company fiscal parameters', () => {
    renderSettings();
    expect(screen.getByText(/Configuración Fiscal & Ministerio de Hacienda/i)).toBeInTheDocument();
    expect(screen.getByText(/Distribuidora Cuscatlán, S.A. de C.V./i)).toBeInTheDocument();
    expect(screen.getByText('0614-120518-102-1')).toBeInTheDocument();
    expect(screen.getByText('289410-4')).toBeInTheDocument();
  });

  it('clearly identifies the pending MH integration without inventing a valid certificate', () => {
    renderSettings();
    expect(screen.getByText(/Integración DTE \(Hacienda DGII\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin integrar · demostración/i)).toBeInTheDocument();
    expect(screen.getByText('No hay certificado conectado')).toBeInTheDocument();
    expect(screen.queryByText(/FirmaSV_2026.crt|Sandbox Oficial|^Válido$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sucursales adicionales pendientes' })).toBeDisabled();
  });

  it('renders establishments and POS points of sale table', () => {
    renderSettings();
    expect(screen.getByText(/Establecimientos y Puntos de Venta \(Cajas\)/i)).toBeInTheDocument();
    expect(screen.getByText('M001')).toBeInTheDocument();
    expect(screen.getByText('P001')).toBeInTheDocument();
    expect(screen.getByText('Casa Matriz / Oficina Central')).toBeInTheDocument();
  });

  it('opens modal to register another company on button click', () => {
    renderSettings();
    const addBtn = screen.getByRole('button', { name: /\+ Registrar Otra Empresa/i });
    fireEvent.click(addBtn);

    expect(screen.getByText(/Registrar Nueva Empresa/i)).toBeInTheDocument();
  });
});
