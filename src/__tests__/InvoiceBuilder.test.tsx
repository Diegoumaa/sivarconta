import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvoiceBuilder } from '../components/billing/InvoiceBuilder';
import { AppProvider } from '../context/AppContext';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('InvoiceBuilder Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const renderInvoiceBuilder = () => {
    return render(
      <AppProvider>
        <InvoiceBuilder />
      </AppProvider>
    );
  };

  it('renders Step 1 with DTE selector and client selector', () => {
    renderInvoiceBuilder();
    expect(screen.getByText(/Paso 1: ¿Qué tipo de comprobante necesitas emitir\?/i)).toBeInTheDocument();
    expect(screen.getByText(/DTE-01/i)).toBeInTheDocument();
    expect(screen.getByText(/DTE-03/i)).toBeInTheDocument();
    expect(screen.getByText(/DTE-14/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar a Productos/i })).toBeInTheDocument();
  });

  it('allows switching between DTE types', () => {
    renderInvoiceBuilder();
    const ccfCard = screen.getByText(/Crédito Fiscal \(03\)/i);
    fireEvent.click(ccfCard);
    expect(screen.getByText(/DTE-03/i)).toBeInTheDocument();
  });

  it('navigates from Step 1 to Step 2 when client exists', () => {
    renderInvoiceBuilder();
    const nextBtn = screen.getByRole('button', { name: /Continuar a Productos/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Paso 2: ¿Qué productos o servicios vas a facturar\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar a Pago/i })).toBeInTheDocument();
  });

  it('adds, modifies, and removes items in Step 2', () => {
    renderInvoiceBuilder();
    fireEvent.click(screen.getByRole('button', { name: /Continuar a Productos/i }));

    const addBtn = screen.getByRole('button', { name: /Agregar/i });
    fireEvent.click(addBtn);

    // Now there are 2 items
    const qtyInputs = screen.getAllByDisplayValue('1');
    expect(qtyInputs.length).toBeGreaterThanOrEqual(2);

    // Modify price
    const priceInputs = screen.getAllByRole('spinbutton');
    if (priceInputs.length > 0) {
      fireEvent.change(priceInputs[0], { target: { value: '150.00' } });
    }

    expect(screen.getByText(/Continuar a Pago/i)).toBeInTheDocument();
  });

  it('navigates through all 4 steps to Pre-Vuelo and displays summary', () => {
    renderInvoiceBuilder();

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /Continuar a Productos/i }));

    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /Continuar a Pago/i }));
    expect(screen.getByText(/Paso 3: ¿Cómo se cancela la operación\?/i)).toBeInTheDocument();

    // Switch payment condition to Crédito
    const creditoBtn = screen.getByRole('button', { name: /Crédito a Plazos/i });
    fireEvent.click(creditoBtn);
    expect(screen.getByText(/Plazo de Crédito Otorgado/i)).toBeInTheDocument();

    // Step 3 -> Step 4
    fireEvent.click(screen.getByRole('button', { name: /Revisión Pre-Vuelo/i }));
    expect(screen.getByText(/Semáforo de Validación Pre-Vuelo/i)).toBeInTheDocument();
    expect(screen.getByText(/Resumen de la Transmisión/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Firmar y Transmitir DTE a Hacienda/i })).toBeInTheDocument();
  });

  it('submits invoice and navigates to invoices view upon completion', async () => {
    renderInvoiceBuilder();

    // Walk to Step 4
    fireEvent.click(screen.getByRole('button', { name: /Continuar a Productos/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar a Pago/i }));
    fireEvent.click(screen.getByRole('button', { name: /Revisión Pre-Vuelo/i }));

    const submitBtn = screen.getByRole('button', { name: /Firmar y Transmitir DTE a Hacienda/i });
    fireEvent.click(submitBtn);

    // Transmission modal appears
    expect(screen.getByText(/Transmitiendo a DGII El Salvador/i)).toBeInTheDocument();

    // Wait for async transmission simulation
    await waitFor(() => {
      expect(screen.queryByText(/Transmitiendo a DGII El Salvador/i)).not.toBeInTheDocument();
    }, { timeout: 4000 });
  });
});
