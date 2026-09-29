import { describe, it, expect } from 'vitest';
import { InvoiceDocument, PurchaseDocument } from '../types';

describe('IVA Books Logic - F07 and Nota de Crédito (DTE-05) Subtraction', () => {
  it('correctly subtracts DTE-05 (Nota de Crédito) from total sales and Débito Fiscal', () => {
    const invoices: InvoiceDocument[] = [
      {
        id: 'inv-1',
        companyId: 'comp-1',
        dteType: '03', // CCF
        generationCode: 'AAAA-1111',
        controlNumber: 'DTE-03-M001P001-000000000000001',
        emissionDate: '2026-09-10',
        emissionTime: '10:00:00',
        establishmentCode: 'M001',
        posCode: 'P001',
        clientId: 'cli-1',
        clientName: 'Distribuidora San Salvador S.A.',
        clientDocType: 'NIT',
        clientDocNumber: '0614-010190-101-1',
        clientNrc: '123456-7',
        clientAddress: 'San Salvador',
        clientDepartment: 'San Salvador',
        clientMunicipality: 'San Salvador',
        clientEmail: 'contacto@distribuidora.sv',
        items: [],
        paymentMethod: 'Transferencia',
        condition: 'CONTADO',
        subtotalGravado: 1000.00,
        subtotalExento: 0,
        subtotalNoSujeto: 0,
        descuentoTotal: 0,
        iva13: 130.00,
        retencion1: 10.00,
        retencionRenta10: 0,
        totalPagar: 1120.00, // 1000 + 130 - 10
        totalLetras: '...',
        status: 'PROCESADO_MH',
      },
      {
        id: 'inv-2',
        companyId: 'comp-1',
        dteType: '05', // Nota de Crédito (devolución de $200 de mercadería)
        generationCode: 'BBBB-2222',
        controlNumber: 'DTE-05-M001P001-000000000000001',
        emissionDate: '2026-09-15',
        emissionTime: '14:00:00',
        establishmentCode: 'M001',
        posCode: 'P001',
        clientId: 'cli-1',
        clientName: 'Distribuidora San Salvador S.A.',
        clientDocType: 'NIT',
        clientDocNumber: '0614-010190-101-1',
        clientNrc: '123456-7',
        clientAddress: 'San Salvador',
        clientDepartment: 'San Salvador',
        clientMunicipality: 'San Salvador',
        clientEmail: 'contacto@distribuidora.sv',
        items: [],
        paymentMethod: 'Transferencia',
        condition: 'CONTADO',
        subtotalGravado: 200.00,
        subtotalExento: 0,
        subtotalNoSujeto: 0,
        descuentoTotal: 0,
        iva13: 26.00,
        retencion1: 2.00,
        retencionRenta10: 0,
        totalPagar: 224.00,
        totalLetras: '...',
        status: 'PROCESADO_MH',
      },
    ];

    // Filter Ventas a Contribuyentes (DTE-03, 05, 06)
    const ventasContribuyente = invoices.filter(i => i.dteType === '03' || i.dteType === '05' || i.dteType === '06');

    // Totals with DTE-05 subtracted per El Salvador Código Tributario
    const totalGravadas = ventasContribuyente.reduce(
      (a, b) => a + (b.dteType === '05' ? -b.subtotalGravado : b.subtotalGravado),
      0
    );
    const totalDebito = ventasContribuyente.reduce(
      (a, b) => a + (b.dteType === '05' ? -b.iva13 : b.iva13),
      0
    );
    const totalRetenido = ventasContribuyente.reduce(
      (a, b) => a + (b.dteType === '05' ? -b.retencion1 : b.retencion1),
      0
    );
    const totalVentas = ventasContribuyente.reduce(
      (a, b) => a + (b.dteType === '05' ? -b.totalPagar : b.totalPagar),
      0
    );

    // 1000 - 200 = 800
    expect(totalGravadas).toBe(800.00);
    // 130 - 26 = 104
    expect(totalDebito).toBe(104.00);
    // 10 - 2 = 8
    expect(totalRetenido).toBe(8.00);
    // 1120 - 224 = 896
    expect(totalVentas).toBe(896.00);
  });

  it('correctly calculates monthly F07 balance (Débito Fiscal vs Crédito Fiscal)', () => {
    // Débito Fiscal (Sales to taxpayers + consumers)
    const debitoTotalPeriodo = 500.00;

    // Case 1: Purchases with higher tax credit than sales debit (Remanente a favor)
    const creditoTotalPeriodo1 = 650.00;
    const saldo1 = debitoTotalPeriodo - creditoTotalPeriodo1;
    expect(saldo1).toBe(-150.00); // Remanente a favor del contribuyente

    // Case 2: Sales debit greater than purchase credit (Tax to pay to DGII)
    const creditoTotalPeriodo2 = 300.00;
    const saldo2 = debitoTotalPeriodo - creditoTotalPeriodo2;
    expect(saldo2).toBe(200.00); // Impuesto a pagar en F07
  });

  it('purchases breakdown correctly differentiates CCF vs Sujeto Excluido vs Factura', () => {
    const purchases: PurchaseDocument[] = [
      {
        id: 'p-1',
        companyId: 'comp-1',
        docType: 'CCF',
        docNumber: 'CCF-001',
        emissionDate: '2026-09-05',
        supplierName: 'Papelería Nacional S.A.',
        supplierNit: '0614-010180-101-1',
        supplierNrc: '54321-0',
        concept: 'Papelería de oficina',
        purchasesGravadas: 100.00,
        purchasesExentas: 0,
        creditoFiscal: 13.00, // 13% IVA
        retencion1: 0,
        totalPagar: 113.00,
        paymentMethod: 'Transferencia',
      },
      {
        id: 'p-2',
        companyId: 'comp-1',
        docType: 'SUJETO_EXCLUIDO',
        docNumber: 'SE-001',
        emissionDate: '2026-09-12',
        supplierName: 'Juan Pérez (Técnico Independiente)',
        supplierNit: '02345678-3',
        concept: 'Mantenimiento de aire acondicionado',
        purchasesGravadas: 100.00,
        purchasesExentas: 0,
        creditoFiscal: 0, // No IVA credit
        retencion1: 0,
        retencionRenta10: 10.00, // 10% Income tax withheld
        totalPagar: 90.00, // 100 - 10
        paymentMethod: 'Efectivo',
      },
      {
        id: 'p-3',
        companyId: 'comp-1',
        docType: 'FACTURA',
        docNumber: 'FAC-001',
        emissionDate: '2026-09-18',
        supplierName: 'Restaurante El Cafetal',
        supplierNit: '0614-200290-102-2',
        concept: 'Almuerzo de trabajo',
        purchasesGravadas: 50.00,
        purchasesExentas: 0,
        creditoFiscal: 0, // Consumer invoice: no tax credit
        retencion1: 0,
        totalPagar: 50.00,
        paymentMethod: 'Tarjeta',
      },
    ];

    const totalCreditoFiscal = purchases.reduce((a, b) => a + b.creditoFiscal, 0);
    const totalPagar = purchases.reduce((a, b) => a + b.totalPagar, 0);

    // Only CCF grants tax credit (13.00)
    expect(totalCreditoFiscal).toBe(13.00);
    // 113 + 90 + 50 = 253.00
    expect(totalPagar).toBe(253.00);
  });
});
