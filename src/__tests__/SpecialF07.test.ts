import { describe, expect, it } from 'vitest';
import type { InvoiceDocument, PurchaseDocument } from '../types';
import type { IvaAnnexRecord, SpecialAnnex } from '../types/ivaAnnex';
import { buildSpecialF07, emptyAnnexData } from '../utils/specialF07';
import { calculateIvaLedger } from '../utils/ivaLedger';
import { purchaseTaxes } from '../utils/purchaseTaxes';

const generation = '12345678-1234-4234-8234-123456789ABC';
const stamp = 'A'.repeat(40);
function voucher(annex: SpecialAnnex, overrides: Partial<IvaAnnexRecord['data']> = {}): IvaAnnexRecord {
  const docType = annex === '66' ? '14' : ['108','163','169'].includes(annex) ? '03' : '07';
  return { id: 'fixture', companyId: 'a', annex, emissionDate: '2026-11-04', relatedInvoiceIds: [], relatedPurchaseIds: [],
    data: { ...emptyAnnexData(), partyDoc: '0001-000001-000-0', partyName: 'Proveedor de prueba', docType,
      series: 'S001', resolution: 'RES-001', documentNumber: '00007', amount: '1000.00',
      taxAmount: ({ '108': '130', '66': '130', '161': '20', '171': '20', '172': '130' } as Record<string,string>)[annex] || '10',
      operation: '1', classification: '1', sector: '2', cost: '4',
      settlementSeries: 'L001', settlementResolution: 'RES-002', settlementNumber: '00008', settlementDate: '2026-11-05',
      from: '00007', to: '00008', preprintedFrom: '00007', preprintedTo: '00008', ...overrides
    } };
}

describe('F07 casillas especiales, archivos sin encabezados', () => {
  it.each([
    ['108', '00010000010000;Proveedor de prueba;04/11/2026;03;S001;RES-001;00007;1000.00;130.00;L001;RES-002;00008;05/11/2026;;4'],
    ['66', '1;00010000010000;Proveedor de prueba;04/11/2026;S001;00007;1000.00;130.00;1;1;2;4;5'],
    ['161', '00010000010000;04/11/2026;S001;00007;1000.00;20.00;;6'],
    ['162', '00010000010000;04/11/2026;07;S001;00007;1000.00;10.00;;7'],
    ['163', '00010000010000;04/11/2026;03;S001;00007;1000.00;10.00;;8'],
    ['169', '00010000010000;04/11/2026;03;RES-001;S001;00007;1000.00;10.00;;9'],
    ['170', '00010000010000;04/11/2026;07;RES-001;S001;00007;1000.00;10.00;;10'],
    ['171', '00010000010000;04/11/2026;RES-001;S001;00007;1000.00;20.00;;11'],
    ['172', '00010000010000;04/11/2026;07;S001;RES-001;00007;1000.00;130.00;;12'],
    ['documentos', 'RES001;1;00007;00008;07;A;S001;00007;00008;'],
  ] as const)('matches the exact column order of %s', (annex, expected) => {
    expect(buildSpecialF07(annex, [voucher(annex)], '2026-11')).toBe(expected + '\r\n');
  });
  it('uses real DTE generation codes, stamp and control in their own columns', () => {
    const r = voucher('170', { documentClass: '4', series: stamp, documentNumber: 'DTE-07-M001P001-000000000000007', generationCode: generation, partyDocType: 'DUI', partyDoc: '00000000-0' });
    expect(buildSpecialF07('170', [r], '2026-11')).toBe(`;04/11/2026;07;DTE07M001P001000000000000007;${stamp};12345678123442348234123456789ABC;1000.00;10.00;000000000;10\r\n`);
    expect(() => buildSpecialF07('170', [{ ...r, data: { ...r.data, series: '' } }], '2026-11')).toThrow(/serie o sello/);
  });
  it('uses historical FSE codes and rejects replacing IVA 13 with ISR 10', () => {
    const r = voucher('66', { operation: '', classification: '', sector: '', cost: '' });
    expect(buildSpecialF07('66', [{ ...r, emissionDate: '2024-01-01' }], '2024-01')).toContain(';130.00;0;0;0;0;5');
    expect(() => buildSpecialF07('66', [voucher('66', { taxAmount: '100' })], '2026-11')).toThrow(/13 %/);
  });
  it('excludes a different period, an excluded voucher and a different annex', () => {
    expect(() => buildSpecialF07('162', [{ ...voucher('162'), emissionDate: '2026-10-01' }, { ...voucher('162'), voided: true }, voucher('163')], '2026-11')).toThrow(/No hay comprobantes/);
  });
  it('keeps credit note amounts positive and rejects duplicate vouchers or invalid dates', () => {
    const r = voucher('163', { docType: '05' });
    expect(buildSpecialF07('163', [r], '2026-11')).toContain(';05;S001;00007;1000.00;10.00;;8');
    expect(() => buildSpecialF07('163', [r, { ...r, id: 'duplicate' }], '2026-11')).toThrow(/duplicado/);
    expect(() => buildSpecialF07('163', [{ ...r, emissionDate: '2026-11-31' }], '2026-11')).toThrow(/fecha/);
  });
  it('rejects spreadsheet formulas and the use of NRC in the tax agent column', () => {
    expect(() => buildSpecialF07('66', [voucher('66', { partyName: '=1+1' })], '2026-11')).toThrow(/incompatibles/);
    expect(() => buildSpecialF07('162', [voucher('162', { partyDocType: 'NRC', partyDoc: '1234567' })], '2026-11')).toThrow(/identificación/);
  });
});

describe('purchase and monthly IVA settlement', () => {
  it('adds received perception to payment and keeps it separate from credit', () => {
    expect(purchaseTaxes(1500, 0, 'CCF', { perceive: true })).toMatchObject({ creditoFiscal: 195, percepcion1: 15, retencion1: 0, totalPagar: 1710 });
    expect(purchaseTaxes(99.99, 0, 'CCF', { perceive: true }).percepcion1).toBe(0);
    expect(() => purchaseTaxes(1500, 0, 'CCF', { perceive: true, retain: true })).toThrow(/agente/);
  });
  it('keeps IVA and ISR withholdings separate on an excluded supplier', () => {
    expect(purchaseTaxes(100, 0, 'SUJETO_EXCLUIDO', { retain13: true, renta: true, service: true })).toMatchObject({ creditoFiscal: 0, retencionIva13: 13, retencionRenta10: 10, totalPagar: 77 });
  });
  it('uses linked vouchers once and carries payments separately from the credit', () => {
    const sales = [{ id: 'sale', status: 'PROCESADO_MH', dteType: '03', emissionDate: '2026-11-01', iva13: 90, retencion1: 10, percepcion1: 0 }] as InvoiceDocument[];
    const purchases = [{ id: 'purchase', docType: 'CCF', emissionDate: '2026-11-01', creditoFiscal: 100, retencion1: 0, percepcion1: 10 }] as PurchaseDocument[];
    const annexes = [{ ...voucher('162'), relatedInvoiceIds: ['sale'] }, { ...voucher('163'), relatedPurchaseIds: ['purchase'] }, voucher('161'), voucher('170'), voucher('172')];
    expect(calculateIvaLedger(sales, purchases, '2026-11', {}, annexes)).toMatchObject({ payable: 0, creditCarry: 10, paymentCarry: 40, retained: 10, perceived: 10, advance: 20, withholdingToPay: 10, withholding13ToPay: 130 });
    expect(calculateIvaLedger([...sales, { ...sales[0], id: 'next', iva13: 60, retencion1: 0, emissionDate: '2026-12-01' }], purchases, '2026-12', {}, annexes)).toMatchObject({ creditOpening: 10, paymentOpening: 40, payable: 10, withholdingToPay: 0 });
  });
});
