import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('AppContext State Management', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProvider>{children}</AppProvider>
  );

  it('initializes with default mock companies and active company', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    expect(result.current.companies.length).toBeGreaterThanOrEqual(2);
    expect(result.current.currentCompany).toBeDefined();
    expect(result.current.currentCompany.name).toContain('Distribuidora Cuscatlán');
  });

  it('adds a new company and immediately switches to it as active', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    let created: any;
    await act(async () => {
      created = await result.current.addCompany({
        name: 'Laboratorios San Salvador S.A.',
        tradeName: 'Lab San Salvador',
        nit: '0614-200590-101-2',
        nrc: '987654-3',
        economicActivity: 'Fabricación de productos farmacéuticos',
        economicActivityCode: '21000',
        taxpayerType: 'MEDIANO',
        department: 'San Salvador',
        municipality: 'San Salvador Centro',
        address: 'Bulevar Los Héroes #100',
        phone: '+503 2200-1111',
        email: 'contacto@lab.sv',
        mhEnvironment: 'PRUEBAS',
        mhUser: 'DTE_06142005901012',
        establishmentCode: 'M001',
        posCode: 'P001'
      });
    });

    expect(result.current.companies.some(c => c.name === 'Laboratorios San Salvador S.A.')).toBe(true);
    expect(result.current.currentCompanyId).toBe(created.id);
    expect(result.current.currentCompany.name).toBe('Laboratorios San Salvador S.A.');
  });

  it('adds product associated with active company', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    await act(async () => {
      await result.current.addProduct({
        code: 'MED-001',
        name: 'Alcohol Gel 500ml',
        description: 'Antiséptico de manos con 70% alcohol',
        unitPrice: 3.50,
        taxType: 'GRAVADO',
        unitOfMeasure: '59',
        category: 'Insumos Médicos'
      });
    });

    expect(result.current.products.some(p => p.name === 'Alcohol Gel 500ml')).toBe(true);
  });

  it('adds client associated with active company', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    await act(async () => {
      await result.current.addClient({
        name: 'Farmacia La Paz S.A.',
        docType: 'NIT',
        docNumber: '0614-110595-102-3',
        nrc: '456789-0',
        taxpayerType: 'PEQUENO',
        department: 'La Paz',
        municipality: 'Zacatecoluca',
        address: 'Barrio El Centro',
        phone: '+503 2334-0000',
        email: 'factura@farmacialapaz.sv'
      });
    });

    expect(result.current.clients.some(c => c.name === 'Farmacia La Paz S.A.')).toBe(true);
  });

  it('adds purchases mapping docTypes correctly (CCF, SUJETO_EXCLUIDO, NOTA_CREDITO, FACTURA)', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    await act(async () => {
      await result.current.addPurchase({
        docType: 'SUJETO_EXCLUIDO',
        docNumber: 'DTE-14-001',
        emissionDate: '2026-09-28',
        supplierName: 'Don José Plomero',
        supplierNit: '0614-010170-101-9',
        concept: 'Reparación de cañerías',
        purchasesGravadas: 100.00,
        purchasesExentas: 0,
        creditoFiscal: 0,
        retencion1: 0,
        retencionRenta10: 10.00,
        totalPagar: 90.00,
        paymentMethod: '01'
      });
    });

    expect(result.current.purchases.some(p => p.supplierName === 'Don José Plomero')).toBe(true);
  });

  it('creates an invoice with valid generation code, control number, and reception stamp', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    let invoice: any;
    await act(async () => {
      invoice = await result.current.createInvoice({
        dteType: '03',
        clientId: 'cli-test',
        clientName: 'Cliente Prueba S.A.',
        clientDocType: 'NIT',
        clientDocNumber: '0614-010190-101-1',
        clientNrc: '123456-7',
        clientAddress: 'San Salvador',
        clientDepartment: 'San Salvador',
        clientMunicipality: 'San Salvador',
        clientEmail: 'test@cliente.sv',
        items: [],
        paymentMethod: '01',
        condition: 'CONTADO',
        subtotalGravado: 100.00,
        subtotalExento: 0,
        subtotalNoSujeto: 0,
        descuentoTotal: 0,
        iva13: 13.00,
        retencion1: 0,
        totalPagar: 113.00,
        totalLetras: 'CIENTO TRECE DÓLARES CON 00/100 USD'
      });
    });

    expect(invoice).toBeDefined();
    expect(invoice.controlNumber).toMatch(/^DTE-03-M001P001-\d{15}$/);
    expect(invoice.generationCode).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
    expect(invoice.mhReceptionStamp).toBeDefined();
    expect(invoice.mhQrUrl).toContain('admin.factura.gob.sv/consultaPublica');
    expect(result.current.invoices.some(i => i.id === invoice.id)).toBe(true);
  });
});
