import type { F07Renta, InvoiceDocument, PurchaseDocument } from '../types';
import { f07SaleKind, isF07Purchase, needsF07Renta, validF07Renta } from './f07Renta';
export type AnnexKind = 'ventas_contribuyente' | 'ventas_consumidor' | 'compras';
const compact = (s: string) => s.replace(/[-/]/g, '');
const date = (s: string) => s.split('-').reverse().join('/');
const uuid = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
const money = (n: number) => { if (!Number.isFinite(n) || n < 0 || n > 99999999.99) throw new Error('Revisa los montos: el anexo exige importes positivos de hasta dos decimales.'); return n.toFixed(2); };
const clean = (s: string) => {
  if (/[;\r\n"]/.test(s) || /^[\s]*[=+@-]/.test(s)) throw new Error('Hay un texto con caracteres incompatibles con el CSV de Hacienda. Corrígelo antes de exportar.');
  return s;
};

function rentaColumns(kind: 'purchase' | 'sale', day: string, reference: string, codes?: F07Renta): string[] {
  if (!needsF07Renta(kind, day)) return kind === 'purchase' ? ['0', '0', '0', '0'] : ['0', '0'];
  if (!codes || !validF07Renta(kind, codes)) {
    throw new Error(`Completa la clasificación de renta del comprobante ${reference} antes de generar el anexo.`);
  }
  return kind === 'purchase'
    ? [codes.operation, codes.classification!, codes.sector!, codes.cost!] : [codes.operation, codes.income!];
}

/** MH F07 v14 (manual revised July 2025). Amounts on NC are positive: type 05 defines the sign. */
export function buildF07Annex(kind: AnnexKind, invoices: InvoiceDocument[], purchases: PurchaseDocument[]): string {
  let rows: string[][] = [];
  const sales = invoices.filter(i => i.status === 'PROCESADO_MH' && f07SaleKind(i.dteType) === kind)
    .sort((a, b) => `${a.emissionDate}${a.emissionTime}${a.controlNumber}`.localeCompare(`${b.emissionDate}${b.emissionTime}${b.controlNumber}`));
  if (kind === 'ventas_contribuyente') {
    rows = sales.map(i => {
      if (!uuid.test(i.generationCode) || !i.mhReceptionStamp) throw new Error(`Falta código de generación o sello de recepción real en ${i.controlNumber}.`);
      const dui = i.clientDocType === 'DUI' ? compact(i.clientDocNumber) : '';
      const nit = dui ? '' : compact(i.clientDocNumber || i.clientNrc || '');
      if ((dui && !/^\d{9}$/.test(dui)) || (!dui && !/^\d{1,14}$/.test(nit))) throw new Error(`Revisa la identificación de ${i.clientName}.`);
      return [date(i.emissionDate), '4', i.dteType, compact(i.controlNumber), i.mhReceptionStamp, compact(i.generationCode), '', nit, i.clientName,
        money(i.subtotalExento), money(i.subtotalNoSujeto), money(i.subtotalGravado), money(i.iva13), '0.00', '0.00',
        money(i.subtotalGravado + i.subtotalExento + i.subtotalNoSujeto + i.iva13), dui,
        ...rentaColumns('sale', i.emissionDate, i.controlNumber, i.f07Renta), '1'];
    });
  } else if (kind === 'ventas_consumidor') {
    const ranges: { day: string; codes: string[]; docs: InvoiceDocument[] }[] = [];
    for (const i of sales) {
      if (!uuid.test(i.generationCode) || !i.mhReceptionStamp) throw new Error(`Faltan datos fiscales reales de ${i.controlNumber}.`);
      const codes = rentaColumns('sale', i.emissionDate, i.controlNumber, i.f07Renta);
      const last = ranges[ranges.length - 1];
      // Starting a new range on each change keeps the first/last DTE ranges disjoint.
      if (last && last.day === i.emissionDate && last.codes[0] === codes[0] && last.codes[1] === codes[1]) {
        last.docs.push(i);
      } else {
        ranges.push({ day: i.emissionDate, codes, docs: [i] });
      }
    }
    rows = ranges.map(({ day, codes, docs }) => {
      const sum = (key: 'subtotalGravado' | 'subtotalExento' | 'subtotalNoSujeto') => docs.reduce((n, i) => n + i[key], 0);
      return [date(day), '4', '01', 'N/A', 'N/A', 'N/A', 'N/A', compact(docs[0].generationCode), compact(docs[docs.length - 1].generationCode), '',
        money(sum('subtotalExento')), '0.00', money(sum('subtotalNoSujeto')), money(sum('subtotalGravado')), '0.00', '0.00', '0.00', '0.00', '0.00',
        money(sum('subtotalExento') + sum('subtotalNoSujeto') + sum('subtotalGravado')), ...codes, '2'];
    });
  } else {
    rows = purchases.filter(p => isF07Purchase(p.docType)).map(p => {
      if (!p.documentClass) throw new Error(`Indica la clase del comprobante ${p.docNumber}; no se puede inferir de un registro antiguo.`);
      if (p.documentClass === '4' && !uuid.test(p.generationCode || '')) throw new Error(`Falta el código de generación original de ${p.docNumber}.`);
      const number = p.documentClass === '4' ? compact(p.generationCode!) : compact(p.docNumber);
      const id = compact(p.supplierNit.trim());
      const dui = /^\d{9}$/.test(id) ? id : '';
      const nrc = compact(p.supplierNrc?.trim() || '');
      const nitOrNrc = /^\d{14}$/.test(id) ? id : /^\d{2,9}$/.test(nrc) ? nrc : '';
      if (!dui && !nitOrNrc) throw new Error(`Revisa el DUI, NIT o NRC de ${p.supplierName} en la compra ${p.docNumber}.`);
      // Total purchases is the base before IVA, retentions and perceptions (column O).
      return [date(p.emissionDate), p.documentClass, p.docType === 'CCF' ? '03' : '05', number, dui ? '' : nitOrNrc, p.supplierName,
        money(p.purchasesExentas), '0.00', '0.00', money(p.purchasesGravadas), '0.00', '0.00', '0.00', money(p.creditoFiscal),
        money(p.purchasesGravadas + p.purchasesExentas), dui,
        ...rentaColumns('purchase', p.emissionDate, p.docNumber, p.f07Renta), '3'];
    });
  }
  if (!rows.length) throw new Error('No hay documentos compatibles para este anexo en el período.');
  return rows.map(row => row.map(clean).join(';')).join('\r\n') + '\r\n';
}
