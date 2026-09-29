import { describe, it, expect } from 'vitest';
import {
  calculateInvoiceTotals,
  numberToWordsSpanish,
  generateControlNumber,
  generateGenerationCode,
} from '../utils/dteUtils';
import { InvoiceItem } from '../types';

describe('dteUtils - Tax and Totals Calculation', () => {
  it('calculates DTE-01 (Factura Consumidor Final) with 13% IVA implicit and no retención', () => {
    const items: InvoiceItem[] = [
      {
        id: '1',
        code: 'PROD-01',
        description: 'Teclado Mecánico',
        quantity: 2,
        unitPrice: 50.00,
        discount: 0,
        taxType: 'GRAVADO',
        unitOfMeasure: '59',
        taxAmount: 0,
        total: 100.00,
      },
    ];

    const result = calculateInvoiceTotals('01', items, false, false);

    expect(result.subtotalGravado).toBe(100.00);
    // In DTE-01, IVA is implicit in the final price: 100 - (100 / 1.13) = 11.50
    expect(result.iva13).toBe(11.50);
    expect(result.retencion1).toBe(0);
    expect(result.retencionRenta10).toBe(0);
    expect(result.totalPagar).toBe(100.00);
  });

  it('calculates DTE-03 (Crédito Fiscal) with explicit 13% IVA to regular client', () => {
    const items: InvoiceItem[] = [
      {
        id: '1',
        code: 'SERV-01',
        description: 'Servicio de Consultoría IT',
        quantity: 1,
        unitPrice: 200.00,
        discount: 0,
        taxType: 'GRAVADO',
        unitOfMeasure: '99',
        taxAmount: 0,
        total: 200.00,
      },
    ];

    const result = calculateInvoiceTotals('03', items, false, false);

    expect(result.subtotalGravado).toBe(200.00);
    expect(result.iva13).toBe(26.00); // 200 * 0.13
    expect(result.retencion1).toBe(0); // Client is not Gran Contribuyente
    expect(result.totalPagar).toBe(226.00); // 200 + 26
  });

  it('applies 1% IVA Retención on DTE-03 when client is Gran Contribuyente and subtotal >= $100', () => {
    const items: InvoiceItem[] = [
      {
        id: '1',
        code: 'SERV-02',
        description: 'Desarrollo de Software',
        quantity: 1,
        unitPrice: 500.00,
        discount: 0,
        taxType: 'GRAVADO',
        unitOfMeasure: '99',
        taxAmount: 0,
        total: 500.00,
      },
    ];

    const result = calculateInvoiceTotals('03', items, true, false);

    expect(result.subtotalGravado).toBe(500.00);
    expect(result.iva13).toBe(65.00); // 500 * 0.13
    expect(result.retencion1).toBe(5.00); // 1% of 500
    // Total a Pagar = subtotal + iva13 - retencion1
    expect(result.totalPagar).toBe(560.00); // 500 + 65 - 5
  });

  it('does NOT apply 1% IVA Retención when subtotal is under $100 even if client is Gran Contribuyente', () => {
    const items: InvoiceItem[] = [
      {
        id: '1',
        code: 'PROD-02',
        description: 'Cable de Red UTP',
        quantity: 1,
        unitPrice: 85.00,
        discount: 0,
        taxType: 'GRAVADO',
        unitOfMeasure: '59',
        taxAmount: 0,
        total: 85.00,
      },
    ];

    const result = calculateInvoiceTotals('03', items, true, false);

    expect(result.subtotalGravado).toBe(85.00);
    expect(result.iva13).toBe(11.05);
    expect(result.retencion1).toBe(0); // Under $100.00 threshold (Art. 162 CT El Salvador)
    expect(result.totalPagar).toBe(96.05);
  });

  it('calculates DTE-14 (Sujeto Excluido) with 10% Retención de Renta and 0% IVA', () => {
    const items: InvoiceItem[] = [
      {
        id: '1',
        code: 'SERV-SUJ',
        description: 'Servicios de Fontanería y Reparaciones',
        quantity: 1,
        unitPrice: 150.00,
        discount: 0,
        taxType: 'GRAVADO',
        unitOfMeasure: '99',
        taxAmount: 0,
        total: 150.00,
      },
    ];

    const result = calculateInvoiceTotals('14', items, false, false);

    expect(result.subtotalGravado).toBe(150.00);
    expect(result.iva13).toBe(0); // Sujeto Excluido generates 0% IVA
    expect(result.retencionRenta10).toBe(15.00); // 10% of 150.00
    expect(result.retencion1).toBe(0);
    // Total a pagar al sujeto excluido = 150.00 - 15.00 = 135.00
    expect(result.totalPagar).toBe(135.00);
  });

  it('handles mixed tax types (Gravado, Exento, No Sujeto) correctly', () => {
    const items: InvoiceItem[] = [
      {
        id: '1',
        code: 'ITEM-GRAV',
        description: 'Ítem Gravado',
        quantity: 1,
        unitPrice: 100.00,
        discount: 0,
        taxType: 'GRAVADO',
        unitOfMeasure: '59',
        taxAmount: 0,
        total: 100.00,
      },
      {
        id: '2',
        code: 'ITEM-EXEN',
        description: 'Ítem Exento (Medicamentos)',
        quantity: 1,
        unitPrice: 50.00,
        discount: 0,
        taxType: 'EXENTO',
        unitOfMeasure: '59',
        taxAmount: 0,
        total: 50.00,
      },
      {
        id: '3',
        code: 'ITEM-NOSUJ',
        description: 'Ítem No Sujeto',
        quantity: 1,
        unitPrice: 25.00,
        discount: 0,
        taxType: 'NO_SUJETO',
        unitOfMeasure: '59',
        taxAmount: 0,
        total: 25.00,
      },
    ];

    const result = calculateInvoiceTotals('03', items, false, false);

    expect(result.subtotalGravado).toBe(100.00);
    expect(result.subtotalExento).toBe(50.00);
    expect(result.subtotalNoSujeto).toBe(25.00);
    expect(result.iva13).toBe(13.00); // 13% only on gravado
    expect(result.totalPagar).toBe(188.00); // 100 + 50 + 25 + 13
  });
});

describe('dteUtils - numberToWordsSpanish', () => {
  it('converts small amounts and cents correctly', () => {
    expect(numberToWordsSpanish(0)).toBe('CERO DÓLARES CON 00/100 USD');
    expect(numberToWordsSpanish(1)).toBe('UN DÓLAR CON 00/100 USD');
    expect(numberToWordsSpanish(1.50)).toBe('UN DÓLAR CON 50/100 USD');
    expect(numberToWordsSpanish(5.25)).toBe('CINCO DÓLARES CON 25/100 USD');
  });

  it('converts tens, hundreds and thousands accurately', () => {
    expect(numberToWordsSpanish(100)).toBe('CIEN DÓLARES CON 00/100 USD');
    expect(numberToWordsSpanish(105)).toBe('CIENTO CINCO DÓLARES CON 00/100 USD');
    expect(numberToWordsSpanish(250.75)).toBe('DOSCIENTOS CINCUENTA DÓLARES CON 75/100 USD');
    expect(numberToWordsSpanish(1000)).toBe('MIL DÓLARES CON 00/100 USD');
    expect(numberToWordsSpanish(1250)).toBe('MIL DOSCIENTOS CINCUENTA DÓLARES CON 00/100 USD');
  });

  it('handles millions properly with singular and plural', () => {
    expect(numberToWordsSpanish(1000000)).toBe('UN MILLÓN DE DÓLARES CON 00/100 USD');
    expect(numberToWordsSpanish(2000000)).toBe('DOS MILLONES DE DÓLARES CON 00/100 USD');
    expect(numberToWordsSpanish(1500000.50)).toBe('UN MILLÓN QUINIENTOS MIL DÓLARES CON 50/100 USD');
  });
});

describe('dteUtils - Code and Number Generators', () => {
  it('generates control numbers adhering to MH structure (DTE-XX-M001P001-15digits)', () => {
    const ctrl1 = generateControlNumber('01', 1);
    expect(ctrl1).toBe('DTE-01-M001P001-000000000000001');

    const ctrl3 = generateControlNumber('03', 42);
    expect(ctrl3).toBe('DTE-03-M001P001-000000000000042');

    const ctrl14 = generateControlNumber('14', 9999);
    expect(ctrl14).toBe('DTE-14-M001P001-000000000009999');
  });

  it('generates a valid uppercase UUID v4 for MH Generation Code', () => {
    const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/;
    const code = generateGenerationCode();
    expect(code).toMatch(uuidRegex);
  });
});
