import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { calculateInvoiceTotals } from '../utils/dteUtils';
import { calculateIvaLedger } from '../utils/ivaLedger';
import { buildF07Annex } from '../utils/f07Export';
import { buildBookXlsx } from '../utils/reportExport';
import { buildIvaBookReport } from '../utils/ivaBookReport';
import { checkDteRules } from '../utils/svTaxValidators';
import { MUNICIPALITIES } from '../data/municipalities';
import { INITIAL_INVOICES, INITIAL_PURCHASES } from '../data/mockData';
import type { InvoiceDocument, InvoiceItem, PurchaseDocument } from '../types';

const sale = (overrides: Partial<InvoiceDocument> = {}): InvoiceDocument => ({ ...INITIAL_INVOICES[0], emissionDate: '2026-11-01', status: 'PROCESADO_MH', subtotalGravado: 100, subtotalExento: 0, subtotalNoSujeto: 0, iva13: 13, retencion1: 0, percepcion1: 0, totalPagar: 113, ...overrides });
const purchase = (overrides: Partial<PurchaseDocument> = {}): PurchaseDocument => ({ ...INITIAL_PURCHASES[0], documentClass: '1', emissionDate: '2026-11-01', purchasesGravadas: 100, purchasesExentas: 0, creditoFiscal: 13, retencion1: 0, totalPagar: 113, ...overrides });
const item = (overrides: Partial<InvoiceItem> = {}): InvoiceItem => ({ id: 'i', code: 'i', description: 'Práctica', quantity: 1, unitPrice: 100, discount: 0, taxType: 'GRAVADO', unitOfMeasure: '59', taxAmount: 0, total: 100, ...overrides });

describe('Observaciones fiscales del cliente', () => {
  it.each([0.01, 1, 1.13, 1.99, 50, 113])('preserves a gross CCF price of %s without adding IVA twice', amount => {
    expect(calculateInvoiceTotals('03', [item({ unitPrice: amount })], false, false, false, true).totalPagar).toBe(amount);
  });
  it('preserves the gross discount with IVA-inclusive CCF prices', () => {
    expect(calculateInvoiceTotals('03', [item({ unitPrice: 113, discount: 1 })], false, false, false, true).totalPagar).toBe(112);
  });
  it('reproduces the reference CCF: 1500 + 195 - 15 = 1680', () => {
    expect(calculateInvoiceTotals('03', [item({ quantity: 3000, unitPrice: 0.5 })], true, false)).toMatchObject({ subtotalGravado: 1500, iva13: 195, retencion1: 15, totalPagar: 1680 });
  });
  it('does not retain ISR on a computer bought using FSE', () => {
    expect(calculateInvoiceTotals('14', [item({ unitPrice: 750 })])).toMatchObject({ retencionRenta10: 0, iva13: 0, totalPagar: 750 });
  });
  it('does not perceive IVA on services or on goods not destined for resale', () => {
    expect(calculateInvoiceTotals('03', [item()], false, true).percepcion1).toBe(0);
    expect(calculateInvoiceTotals('03', [item({ unitOfMeasure: '99' })], false, true, true).percepcion1).toBe(0);
    expect(calculateInvoiceTotals('03', [item()], false, true, true).percepcion1).toBe(1);
  });
  it('retains ISR on the explicitly identified service in a mixed FSE', () => {
    expect(calculateInvoiceTotals('14', [item({ unitPrice: 750 }), item({ unitPrice: 100, unitOfMeasure: '99' })])).toMatchObject({ retencionRenta10: 10, totalPagar: 840 });
  });
  it('rejects an FSE recipient registered for IVA', () => {
    expect(checkDteRules('14', 100, '0000-000000-000-0', '12345-6').isReady).toBe(false);
  });
  it('carries credit through an empty month and over a year boundary', () => {
    const ledger = calculateIvaLedger([sale({ emissionDate: '2027-01-05', iva13: 40 })], [purchase({ emissionDate: '2026-11-05', creditoFiscal: 100 })], '2027-01');
    expect(ledger).toMatchObject({ opening: 100, payable: 0, carry: 60 });
  });
  it('does not carry a prior tax payable as a credit', () => {
    expect(calculateIvaLedger([sale({ emissionDate: '2026-10-01', iva13: 60 }), sale({ iva13: 20 })], [], '2026-11')).toMatchObject({ opening: 0, payable: 20 });
  });
  it('uses an opening declared balance once and excludes the imported prior history', () => {
    const result = calculateIvaLedger([sale({ iva13: 100 })], [purchase({ emissionDate: '2026-10-01', creditoFiscal: 999 })], '2026-11', { ivaOpeningPeriod: '2026-11', ivaOpeningBalance: 80 });
    expect(result).toMatchObject({ opening: 80, payable: 20 });
  });
  it('accounts for received retention while separating liabilities as an agent', () => {
    expect(calculateIvaLedger([sale({ iva13: 13, retencion1: 1, percepcion1: 2 })], [purchase({ creditoFiscal: 10, retencion1: 3 })], '2026-11')).toMatchObject({ payable: 2, retained: 1, withholdingToPay: 3, perceptionToPay: 2 });
  });
  it('reverses sales and purchase credit notes once', () => {
    expect(calculateIvaLedger([sale({ iva13: 50 }), sale({ dteType: '05', iva13: 10 })], [purchase({ creditoFiscal: 30 }), purchase({ docType: 'NOTA_CREDITO', creditoFiscal: 5 })], '2026-11')).toMatchObject({ debit: 40, credit: 25, payable: 15 });
  });
});

describe('Anexos F07 v14', () => {
  it('exports 20 columns, no headers, semicolons, and positive NC amounts', () => {
    const row = buildF07Annex('ventas_contribuyente', [sale({ dteType: '05' })], [], { operation: '1', income: '3' }).trim().split(';');
    expect(row).toHaveLength(20); expect(row[0]).toBe('01/11/2026'); expect(row[2]).toBe('05'); expect(row[6]).toBe(''); expect(row[11]).toBe('100.00'); expect(row[15]).toBe('113.00'); expect(row[19]).toBe('1');
  });
  it('keeps IVA retentions out of the fiscal sales total', () => {
    const row = buildF07Annex('ventas_contribuyente', [sale({ retencion1: 1, totalPagar: 112 })], [], { operation: '1', income: '3' }).trim().split(';');
    expect(row[15]).toBe('113.00');
  });
  it('groups consumer DTE by day and keeps 23 fields with IVA included', () => {
    const csv = buildF07Annex('ventas_consumidor', [sale({ dteType: '01', subtotalGravado: 113 }), sale({ id: 'b', dteType: '01', subtotalGravado: 226 })], [], { operation: '1', income: '3' });
    const lines = csv.trim().split('\r\n'); expect(lines).toHaveLength(1);
    const row = lines[0].split(';'); expect(row).toHaveLength(23); expect(row[3]).toBe('N/A'); expect(row[13]).toBe('339.00'); expect(row[22]).toBe('2');
  });
  it('exports purchases with 21 fields and uses pre-IVA base for total purchases', () => {
    const row = buildF07Annex('compras', [], [purchase()], { operation: '1', classification: '2', sector: '2', cost: '2' }).trim().split(';');
    expect(row).toHaveLength(21); expect(row[13]).toBe('13.00'); expect(row[14]).toBe('100.00'); expect(row[20]).toBe('3');
  });
  it('places a supplier DUI in its own column leaving NIT empty', () => {
    const row = buildF07Annex('compras', [], [purchase({ supplierNit: '00000000-0' })], { operation: '1', classification: '2', sector: '2', cost: '2' }).trim().split(';');
    expect(row[4]).toBe(''); expect(row[15]).toBe('000000000');
  });
  it('blocks legacy purchases whose document class is unknown', () => {
    expect(() => buildF07Annex('compras', [], [purchase({ documentClass: undefined })], { operation: '1', classification: '2', sector: '2', cost: '2' })).toThrow('clase');
  });
  it('does not invent a reception stamp or export a draft', () => {
    expect(() => buildF07Annex('ventas_contribuyente', [sale({ mhReceptionStamp: undefined })], [], { operation: '1', income: '3' })).toThrow('sello');
    expect(() => buildF07Annex('ventas_contribuyente', [sale({ status: 'BORRADOR' })], [], { operation: '1', income: '3' })).toThrow('No hay documentos');
  });
  it('requires user-selected renta classifications and blocks delimiter injection', () => {
    expect(() => buildF07Annex('ventas_contribuyente', [sale()], [], { operation: '' })).toThrow('clasificación');
    expect(() => buildF07Annex('ventas_contribuyente', [sale({ clientName: 'Comercial;otro' })], [], { operation: '1', income: '3' })).toThrow('caracteres');
  });
});

describe('Formatos entregados por el cliente', () => {
  it('uses 44 municipalities in 14 departments without mixed assignments', () => {
    expect(Object.keys(MUNICIPALITIES)).toHaveLength(14); expect(Object.values(MUNICIPALITIES).flat()).toHaveLength(44); expect(MUNICIPALITIES['San Salvador']).not.toContain('Santa Ana Centro');
  });
  it('displays CF base separately from IVA while the F07 annex retains the gross amount', () => {
    const report = buildIvaBookReport('ventas_consumidor', [sale({ dteType: '01', subtotalGravado: 113 })], []);
    expect(report.rows[0][8]).toBe(100); expect(report.rows[0][11]).toBe(13); expect(report.rows[0][13]).toBe(113);
  });
  it('separates FSE purchases from purchases with tax credit', () => {
    const report = buildIvaBookReport('compras', [], [purchase({ docType: 'SUJETO_EXCLUIDO', creditoFiscal: 0, retencionRenta10: 10, totalPagar: 90 })]);
    expect(report.rows[0][7]).toBe(0); expect(report.rows[0][9]).toBe(0); expect(report.rows[0][12]).toBe(100); expect(report.rows[0][14]).toBe(10);
  });
  it('exports real Excel XML with text identifiers, escaped text and numeric amounts', () => {
    const files = unzipSync(buildBookXlsx([['Empresa'], ['Libro'], ['Período'], ['USD'], ['Doc', 'Monto'], ['000001', 13], ['=1+1 & <texto>', 10]]));
    expect(files['[Content_Types].xml']).toBeDefined();
    const xml = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(xml).toContain('000001'); expect(xml).toContain('&amp; &lt;texto&gt;'); expect(xml).toContain('<v>13</v>'); expect(xml).not.toContain('<f>');
  });
});
