import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClientsView } from '../components/clients/ClientsView';
import { CatalogView } from '../components/catalog/CatalogView';
import { PurchasesView } from '../components/purchases/PurchasesView';
import type { PurchaseDocument } from '../types';

const state = vi.hoisted(() => ({
  addClient: vi.fn(), addProduct: vi.fn(), addPurchase: vi.fn(), filteredClients: [], filteredProducts: [], filteredPurchases: [] as PurchaseDocument[]
}));
vi.mock('../context/AppContext', () => ({ useApp: () => state }));
vi.mock('../utils/svTaxValidators', () => ({
  validateDui: () => ({ isValid: true }), validateNit: () => ({ isValid: true }), validateNrc: () => ({ isValid: true })
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.filteredPurchases = [];
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const cases = [
  {
    name: 'cliente', Component: ClientsView, open: /Nuevo Cliente/i, save: /Guardar Cliente/i, add: state.addClient,
    fill: () => {
      fireEvent.change(screen.getByLabelText(/Nombre o Razón Social/i), { target: { value: 'Cliente pendiente' } });
      fireEvent.change(screen.getByLabelText(/Número de Doc/i), { target: { value: '0614-120518-102-1' } });
      fireEvent.change(screen.getByLabelText(/Dirección Completa/i), { target: { value: 'San Salvador' } });
      fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), { target: { value: 'prueba@example.test' } });
    }, retainedValue: 'Cliente pendiente'
  },
  {
    name: 'producto', Component: CatalogView, open: /Nuevo Producto \/ Servicio/i, save: /Guardar Producto/i, add: state.addProduct,
    fill: () => {
      fireEvent.change(screen.getByLabelText(/Código \/ SKU/i), { target: { value: 'PRUEBA-001' } });
      fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), { target: { value: 'Producto pendiente' } });
      fireEvent.change(screen.getByLabelText(/Precio Unitario/i), { target: { value: '25' } });
    }, retainedValue: 'Producto pendiente'
  },
  {
    name: 'compra', Component: PurchasesView, open: /^Registrar Compra$/i, save: /Guardar Compra/i, add: state.addPurchase,
    fill: () => {
      fireEvent.change(screen.getByLabelText(/Número de Documento/i), { target: { value: 'CCF-PENDIENTE' } });
      fireEvent.change(screen.getByLabelText(/Nombre del Proveedor/i), { target: { value: 'Proveedor pendiente' } });
      fireEvent.change(screen.getByLabelText(/NIT Proveedor/i), { target: { value: '0614-120518-102-1' } });
      fireEvent.change(screen.getByLabelText(/Concepto del Gasto/i), { target: { value: 'Compra de prueba' } });
      fireEvent.change(screen.getByLabelText(/Monto Gravado/i), { target: { value: '100' } });
    }, retainedValue: 'Proveedor pendiente'
  }
];

describe('Forms preserve input until persistence succeeds', () => {
  it.each(cases)('keeps $name data on failure, blocks duplicate requests and allows retry', async ({ Component, open, save, add, fill, retainedValue }) => {
    let rejectSave!: (error: Error) => void;
    add.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectSave = reject; })).mockResolvedValueOnce(undefined);
    render(<Component />);
    fireEvent.click(screen.getByRole('button', { name: open }));
    fill();
    const form = screen.getByRole('button', { name: save }).closest('form')!;
    fireEvent.submit(form);
    expect(screen.getByRole('button', { name: /Guardando/ })).toBeDisabled();
    fireEvent.submit(form);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(add).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { rejectSave(new Error('Connection unavailable')); });
    expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo guardar/);
    expect(screen.getByDisplayValue(retainedValue)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: save })).toBeEnabled();
    fireEvent.submit(form);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(add).toHaveBeenCalledTimes(2);
  });

  it('registers the selected purchase date and payment method', async () => {
    state.addPurchase.mockResolvedValueOnce(undefined);
    render(<PurchasesView />);
    fireEvent.click(screen.getByRole('button', { name: /^Registrar Compra$/i }));
    cases[2].fill();
    fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Forma de pago'), { target: { value: 'Efectivo' } });
    fireEvent.submit(screen.getByRole('button', { name: /Guardar Compra/ }).closest('form')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(state.addPurchase).toHaveBeenCalledWith(expect.objectContaining({ emissionDate: '2026-09-15', paymentMethod: 'Efectivo' }));
  });

  it('defaults purchase dates to the El Salvador calendar date', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T01:00:00Z'));
    render(<PurchasesView />);
    fireEvent.click(screen.getByRole('button', { name: /^Registrar Compra$/i }));
    expect(screen.getByLabelText('Fecha de compra')).toHaveValue('2026-09-30');
  });

  it('combines supplier search with inclusive date boundaries and explains inverted ranges', () => {
    state.filteredPurchases = [
      { id: 'a', supplierName: 'Proveedor A', docNumber: 'A-1', concept: '', supplierNit: '', emissionDate: '2026-09-01', purchasesGravadas: 1, creditoFiscal: 0, totalPagar: 1 },
      { id: 'b', supplierName: 'Proveedor A', docNumber: 'A-2', concept: '', supplierNit: '', emissionDate: '2026-09-30', purchasesGravadas: 1, creditoFiscal: 0, totalPagar: 1 },
      { id: 'c', supplierName: 'Proveedor A', docNumber: 'A-3', concept: '', supplierNit: '', emissionDate: '2026-10-01', purchasesGravadas: 1, creditoFiscal: 0, totalPagar: 1 },
      { id: 'd', supplierName: 'Proveedor B', docNumber: 'B-1', concept: '', supplierNit: '', emissionDate: '2026-09-15', purchasesGravadas: 1, creditoFiscal: 0, totalPagar: 1 }
    ] as PurchaseDocument[];
    render(<PurchasesView />);
    fireEvent.change(screen.getByLabelText('Compras desde'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Compras hasta'), { target: { value: '2026-09-30' } });
    fireEvent.change(screen.getByLabelText('Buscar compras'), { target: { value: 'Proveedor A' } });
    expect(screen.getByText('A-1')).toBeInTheDocument();
    expect(screen.getByText('A-2')).toBeInTheDocument();
    expect(screen.queryByText('A-3')).not.toBeInTheDocument();
    expect(screen.queryByText('B-1')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Compras desde'), { target: { value: '2026-10-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/fecha inicial/);
    expect(screen.queryByText('A-1')).not.toBeInTheDocument();
  });
});
