import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PurchasesView } from '../components/purchases/PurchasesView';
import { AppProvider } from '../context/AppContext';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('PurchasesView Component & Calculations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderPurchases = () => {
    return render(
      <AppProvider>
        <PurchasesView />
      </AppProvider>
    );
  };

  it('renders purchase documents table and search bar', () => {
    renderPurchases();
    expect(screen.getByText(/Módulo de Compras & Gastos/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar por proveedor o # documento/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar Compra/i })).toBeInTheDocument();
  });

  it('opens modal and allows typing purchase details', () => {
    renderPurchases();

    const openBtn = screen.getByRole('button', { name: /Registrar Compra/i });
    fireEvent.click(openBtn);

    expect(screen.getByText(/Registrar Compra \/ Factura Recibida/i)).toBeInTheDocument();

    const supplierInput = screen.getByPlaceholderText(/CAESS/i) as HTMLInputElement;
    fireEvent.change(supplierInput, { target: { value: 'Distribuidora Cuscatleca S.A.' } });
    expect(supplierInput.value).toBe('Distribuidora Cuscatleca S.A.');

    const docInput = screen.getByPlaceholderText(/CCF-001920/i) as HTMLInputElement;
    fireEvent.change(docInput, { target: { value: 'CCF-998877' } });
    expect(docInput.value).toBe('CCF-998877');
  });

  it('calculates 13% Crédito Fiscal and Total to Pay dynamically for CCF', () => {
    renderPurchases();
    fireEvent.click(screen.getByRole('button', { name: /Registrar Compra/i }));

    const amountInput = screen.getByLabelText(/Monto Gravado/i) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '100.00' } });

    // Crédito Fiscal 13% = $13.00
    expect(screen.getByDisplayValue('$13.00')).toBeInTheDocument();
    // Total a pagar al proveedor = $113.00
    expect(screen.getByText('$113.00')).toBeInTheDocument();
  });

  it('calculates 10% Retención de Renta and subtracts from total for Sujeto Excluido', () => {
    renderPurchases();
    fireEvent.click(screen.getByRole('button', { name: /Registrar Compra/i }));

    const docTypeSelect = screen.getByLabelText(/Tipo de Documento/i) as HTMLSelectElement;
    fireEvent.change(docTypeSelect, { target: { value: 'SUJETO_EXCLUIDO' } });

    const amountInput = screen.getByLabelText(/Monto Gravado/i) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '200.00' } });

    // Retención Renta 10% = -$20.00
    expect(screen.getByDisplayValue('-$20.00')).toBeInTheDocument();
    // Total a pagar = 200 - 20 = $180.00
    expect(screen.getAllByText('$180.00').length).toBeGreaterThanOrEqual(1);
  });

  it('calculates 0% tax credit for Factura Consumidor Final', () => {
    renderPurchases();
    fireEvent.click(screen.getByRole('button', { name: /Registrar Compra/i }));

    const docTypeSelect = screen.getByLabelText(/Tipo de Documento/i) as HTMLSelectElement;
    fireEvent.change(docTypeSelect, { target: { value: 'FACTURA' } });

    const amountInput = screen.getByLabelText(/Monto Gravado/i) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '50.00' } });

    // Factura has $0.00 crédito fiscal for company
    expect(screen.getByDisplayValue('$0.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  it('submits purchase form and adds purchase to list', () => {
    renderPurchases();
    fireEvent.click(screen.getByRole('button', { name: /Registrar Compra/i }));

    const docInput = screen.getByPlaceholderText(/CCF-001920/i);
    const supplierInput = screen.getByPlaceholderText(/CAESS/i);
    const nitInput = screen.getByPlaceholderText(/0614-XXXXXX-XXX-X/i);
    const conceptInput = screen.getByPlaceholderText(/Compra de suministros/i);
    const amountInput = screen.getByLabelText(/Monto Gravado/i);

    fireEvent.change(docInput, { target: { value: 'CCF-555' } });
    fireEvent.change(supplierInput, { target: { value: 'Librería Central' } });
    fireEvent.change(nitInput, { target: { value: '0614-010190-101-1' } });
    fireEvent.change(conceptInput, { target: { value: 'Resmas de papel' } });
    fireEvent.change(amountInput, { target: { value: '100.00' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar Compra/i }));

    expect(screen.getByText('Librería Central')).toBeInTheDocument();
    expect(screen.getByText('CCF-555')).toBeInTheDocument();
  });
});
