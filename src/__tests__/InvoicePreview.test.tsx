import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoicePreview } from '../components/billing/InvoicePreview';
import { AppProvider } from '../context/AppContext';
import { InvoiceDocument } from '../types';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

vi.mock('../utils/pdfExport', () => ({
  exportElementToPdf: vi.fn().mockResolvedValue(true),
}));

const mockInvoice01: InvoiceDocument = {
  id: 'inv-test-1',
  companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  dteType: '01',
  generationCode: 'E5B2F101-38A2-4D90-9E11-209B0E123456',
  controlNumber: 'DTE-01-M001P001-000000000000101',
  emissionDate: '2026-09-28',
  emissionTime: '10:30:00',
  establishmentCode: 'M001',
  posCode: 'P001',
  clientId: 'cli-1',
  clientName: 'Juan Carlos Pérez',
  clientDocType: 'DUI',
  clientDocNumber: '02345678-3',
  clientAddress: 'Colonia Escalón, San Salvador',
  clientDepartment: 'San Salvador',
  clientMunicipality: 'San Salvador Centro',
  clientEmail: 'juan.perez@gmail.com',
  items: [
    {
      id: 'item-1',
      code: 'TEC-001',
      description: 'Mouse Inalámbrico Logitech',
      quantity: 2,
      unitPrice: 25.00,
      discount: 0,
      taxType: 'GRAVADO',
      unitOfMeasure: '59',
      taxAmount: 0,
      total: 50.00
    }
  ],
  paymentMethod: '01',
  condition: 'CONTADO',
  subtotalGravado: 50.00,
  subtotalExento: 0,
  subtotalNoSujeto: 0,
  descuentoTotal: 0,
  iva13: 5.75,
  retencion1: 0,
  retencionRenta10: 0,
  totalPagar: 50.00,
  totalLetras: 'CINCUENTA DÓLARES CON 00/100 USD',
  status: 'PROCESADO_MH',
  mhReceptionStamp: '2026B1E9A4B34C82901DF5689EAC389021B098C2',
  mhQrUrl: 'https://admin.factura.gob.sv/consultaPublica?ambiente=00&codGen=E5B2F101-38A2-4D90-9E11-209B0E123456'
};

const mockInvoice03WithPercepcion: InvoiceDocument = {
  ...mockInvoice01,
  id: 'inv-test-3',
  dteType: '03',
  clientName: 'Ferretería El Tornillo S.A.',
  clientDocType: 'NIT',
  clientDocNumber: '0614-110295-102-1',
  clientNrc: '302918-2',
  subtotalGravado: 100.00,
  iva13: 13.00,
  percepcion1: 1.00,
  totalPagar: 114.00,
  totalLetras: 'CIENTO CATORCE DÓLARES CON 00/100 USD'
};

describe('InvoicePreview Component', () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderPreview = (invoice: InvoiceDocument) => {
    return render(
      <AppProvider>
        <InvoicePreview invoice={invoice} onClose={onCloseMock} />
      </AppProvider>
    );
  };

  it('renders official DTE representation with company info and MH control number', () => {
    renderPreview(mockInvoice01);

    expect(screen.getByText(/Representación Gráfica Oficial DTE/i)).toBeInTheDocument();
    expect(screen.getByText('DTE-01-M001P001-000000000000101')).toBeInTheDocument();
    expect(screen.getByText('Juan Carlos Pérez')).toBeInTheDocument();
    expect(screen.getByText('Mouse Inalámbrico Logitech')).toBeInTheDocument();
    expect(screen.getAllByText('$50.00').length).toBeGreaterThan(0);
  });

  it('correctly labels IVA included for DTE-01 Factura Consumidor Final', () => {
    renderPreview(mockInvoice01);
    expect(screen.getByText(/IVA 13% Incluido en Precio/i)).toBeInTheDocument();
    expect(screen.getByText('$5.75')).toBeInTheDocument();
  });

  it('renders explicit IVA 13% and Percepción 1% for DTE-03', () => {
    renderPreview(mockInvoice03WithPercepcion);

    expect(screen.getByText(/\(\+\) IVA 13% Débito Fiscal:/i)).toBeInTheDocument();
    expect(screen.getByText(/\+\$13.00/i)).toBeInTheDocument();
    expect(screen.getByText(/\(\+\) Percepción IVA 1%/i)).toBeInTheDocument();
    expect(screen.getByText(/\+\$1.00/i)).toBeInTheDocument();
    expect(screen.getByText('$114.00')).toBeInTheDocument();
  });

  it('toggles MH JSON payload view on click', () => {
    renderPreview(mockInvoice01);

    const toggleBtn = screen.getByRole('button', { name: /Ver JSON MH/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Payload JSON transmitido a la API del Ministerio de Hacienda/i)).toBeInTheDocument();
    expect(screen.getByText(/FIRMADO_JWS/i)).toBeInTheDocument();

    const backBtn = screen.getByRole('button', { name: /Ver Factura/i });
    fireEvent.click(backBtn);
    expect(screen.getByText(/Representación Gráfica Oficial DTE/i)).toBeInTheDocument();
  });

  it('calls onClose when clicking close button', () => {
    renderPreview(mockInvoice01);
    const closeBtn = screen.getByTitle(/Cerrar vista previa/i);
    fireEvent.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
