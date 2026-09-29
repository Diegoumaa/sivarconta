import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../components/layout/Header';
import { AppProvider } from '../context/AppContext';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('Header Component & Company Switching', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderHeader = () => {
    return render(
      <AppProvider>
        <Header />
      </AppProvider>
    );
  };

  it('renders branding and active company indicator', () => {
    renderHeader();
    expect(screen.getByText(/SIVAR/i)).toBeInTheDocument();
    expect(screen.getByText(/CONTA/i)).toBeInTheDocument();
    expect(screen.getByText(/Distribuidora Cuscatlán/i)).toBeInTheDocument();
  });

  it('opens and closes company switcher dropdown on click', () => {
    renderHeader();

    const companyDropdownTrigger = screen.getByRole('button', { name: /Distribuidora Cuscatlán/i });
    fireEvent.click(companyDropdownTrigger);

    expect(screen.getByText(/Cambiar de Empresa \/ Cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/SIVARCONTA Despacho/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Registrar Nueva Empresa/i })).toBeInTheDocument();

    // Toggle close
    fireEvent.click(companyDropdownTrigger);
    expect(screen.queryByText(/Cambiar de Empresa \/ Cliente/i)).not.toBeInTheDocument();
  });

  it('switches active company when clicking another company in dropdown', () => {
    renderHeader();

    const companyDropdownTrigger = screen.getByRole('button', { name: /Distribuidora Cuscatlán/i });
    fireEvent.click(companyDropdownTrigger);

    const secondCompanyBtn = screen.getByText(/SIVARCONTA Despacho/i);
    fireEvent.click(secondCompanyBtn);

    // Header now reflects the second company
    expect(screen.getByText(/SIVARCONTA Despacho/i)).toBeInTheDocument();
  });

  it('opens NewCompanyModal when clicking "+ Registrar Nueva Empresa" inside dropdown', () => {
    renderHeader();

    const trigger = screen.getByRole('button', { name: /Distribuidora Cuscatlán/i });
    fireEvent.click(trigger);

    const newCompanyBtn = screen.getByRole('button', { name: /\+ Registrar Nueva Empresa/i });
    fireEvent.click(newCompanyBtn);

    expect(screen.getByText(/Registrar Nueva Empresa/i)).toBeInTheDocument();
  });
});
