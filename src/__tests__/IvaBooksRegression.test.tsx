import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { IvaBooksView } from '../components/books/IvaBooksView';
import type { InvoiceDocument, PurchaseDocument } from '../types';

const state = vi.hoisted(() => ({ filteredInvoices: [] as InvoiceDocument[], filteredPurchases: [] as PurchaseDocument[] }));
vi.mock('../context/AppContext', () => ({
  useApp: () => ({ ...state, currentCompany: { name: 'Empresa de prueba', nrc: '12345-6', nit: '0000' } })
}));

const invoice = (overrides: Partial<InvoiceDocument>): InvoiceDocument => ({
  id: 'sale', companyId: 'company', dteType: '03', generationCode: 'uuid', controlNumber: 'CONTROL', emissionDate: '2026-10-01',
  emissionTime: '12:00:00', establishmentCode: 'M001', posCode: 'P001', clientId: 'client', clientName: 'Cliente octubre',
  clientDocType: 'NIT', clientDocNumber: '0000', clientAddress: '', clientDepartment: '', clientMunicipality: '', clientEmail: '',
  items: [], paymentMethod: '01', condition: 'CONTADO', subtotalGravado: 100, subtotalExento: 0, subtotalNoSujeto: 0,
  descuentoTotal: 0, iva13: 13, retencion1: 0, retencionRenta10: 0, totalPagar: 113, totalLetras: '', status: 'PROCESADO_MH', ...overrides
});
const purchase = (overrides: Partial<PurchaseDocument>): PurchaseDocument => ({
  id: 'purchase', companyId: 'company', docType: 'CCF', docNumber: 'CCF-OCT', emissionDate: '2026-10-15', supplierName: 'Proveedor octubre',
  supplierNit: '', concept: '', purchasesGravadas: 50, purchasesExentas: 0, creditoFiscal: 6.5, retencion1: 0, totalPagar: 56.5, paymentMethod: '01', ...overrides
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T18:00:00Z'));
  state.filteredInvoices = [];
  state.filteredPurchases = [];
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('IVA books acceptance regressions', () => {
  it('uses the current month in El Salvador at the UTC month boundary', () => {
    vi.setSystemTime(new Date('2026-10-01T01:00:00Z'));
    render(<IvaBooksView />);
    expect(screen.getByLabelText('Período')).toHaveValue('2026-09');
  });

  it('filters sales, purchases and balances by the selected month and accepted status', () => {
    state.filteredInvoices = [
      invoice({}),
      invoice({ id: 'old', clientName: 'Cliente septiembre', emissionDate: '2026-09-30' }),
      invoice({ id: 'rejected', clientName: 'Cliente rechazado', status: 'RECHAZADO_MH' }),
      invoice({ id: 'draft', clientName: 'Cliente borrador', status: 'BORRADOR' }),
      invoice({ id: 'invalid', clientName: 'Cliente invalidado', status: 'INVALIDADO' }),
      invoice({ id: 'nc', dteType: '05', clientName: 'Devolución octubre', subtotalGravado: 20, iva13: 2.6, totalPagar: 22.6 })
    ];
    state.filteredPurchases = [purchase({}), purchase({ id: 'old-purchase', supplierName: 'Proveedor septiembre', emissionDate: '2026-09-01' })];
    render(<IvaBooksView />);
    expect(screen.getByText('Cliente octubre')).toBeInTheDocument();
    expect(screen.getByText('Devolución octubre')).toBeInTheDocument();
    expect(screen.queryByText('Cliente septiembre')).not.toBeInTheDocument();
    expect(screen.queryByText('Cliente rechazado')).not.toBeInTheDocument();
    expect(screen.queryByText('Cliente borrador')).not.toBeInTheDocument();
    expect(screen.queryByText('Cliente invalidado')).not.toBeInTheDocument();
    expect(screen.getByText('A Pagar: $3.90')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /3. Libro de Compras/ }));
    expect(screen.getByText('Proveedor octubre')).toBeInTheDocument();
    expect(screen.queryByText('Proveedor septiembre')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '2026-09' } });
    expect(screen.getByText('Proveedor septiembre')).toBeInTheDocument();
    expect(screen.queryByText('Proveedor octubre')).not.toBeInTheDocument();
  });

  it('shows credit notes with negative amounts matching the purchase totals', () => {
    state.filteredPurchases = [purchase({ docType: 'NOTA_CREDITO', supplierName: 'Devolución proveedor' })];
    render(<IvaBooksView />);
    fireEvent.click(screen.getByRole('button', { name: /3. Libro de Compras/ }));
    const row = screen.getByText('Devolución proveedor').closest('tr')!;
    expect(within(row).getByText('$-50.00')).toBeInTheDocument();
    expect(within(row).getByText('$-6.50')).toBeInTheDocument();
    expect(within(row).getByText('$-56.50')).toBeInTheDocument();
  });

  it('downloads the selected records with CSV escaping and formula protection', async () => {
    state.filteredInvoices = [
      invoice({ id: 'quoted', clientName: 'Comercial "Sol", S.A.\nSucursal', controlNumber: 'QUOTED' }),
      invoice({ id: 'formula', clientName: '=HYPERLINK("https://example.test")', controlNumber: 'FORMULA' }),
      invoice({ id: 'spaces', clientName: '  +SUM(1,2)', controlNumber: 'SPACES' }),
      invoice({ id: 'previous', clientName: 'No exportar septiembre', emissionDate: '2026-09-01' }),
      invoice({ id: 'rejected', clientName: 'No exportar rechazado', status: 'RECHAZADO_MH' })
    ];
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:books-test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe('blob:books-test');
      expect(this.download).toBe('Libro_IVA_ventas_contribuyente_10_2026.csv');
      expect(document.body.contains(this)).toBe(true);
    });
    render(<IvaBooksView />);
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    const csv = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(createObjectURL.mock.calls[0][0]);
    });
    expect(csv).toContain('"Comercial ""Sol"", S.A.\nSucursal"');
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
    expect(csv).toContain('"\'  +SUM(1,2)"');
    expect(csv).not.toContain('No exportar');
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
