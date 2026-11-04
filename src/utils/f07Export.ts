import type { InvoiceDocument, PurchaseDocument } from '../types';
export type AnnexKind = 'ventas_contribuyente' | 'ventas_consumidor' | 'compras';
export interface RentaCodes { operation: string; income?: string; classification?: string; sector?: string; cost?: string }
const compact = (s: string) => s.replace(/[-/]/g, '');
const date = (s: string) => s.split('-').reverse().join('/');
const uuid = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
const money = (n: number) => { if (!Number.isFinite(n) || n < 0 || n > 99999999.99) throw new Error('Revisa los montos: el anexo exige importes positivos de hasta dos decimales.'); return n.toFixed(2); };
const clean = (s: string) => {
  if (/[;\r\n"]/.test(s) || /^[\s]*[=+@-]/.test(s)) throw new Error('Hay un texto con caracteres incompatibles con el CSV de Hacienda. Corrígelo antes de exportar.');
  return s;
};

/** MH F07 v14 (manual revised July 2025). Amounts on NC are positive: type 05 defines the sign. */
export function buildF07Annex(kind: AnnexKind, invoices: InvoiceDocument[], purchases: PurchaseDocument[], codes: RentaCodes): string {
  if (!codes.operation || (kind !== 'compras' && !codes.income) || (kind === 'compras' && (!codes.classification || !codes.sector || !codes.cost))) throw new Error('Completa los códigos de clasificación de renta antes de generar el anexo.');
  let rows: string[][] = [];
  const sales = invoices.filter(i => i.status === 'PROCESADO_MH').sort((a, b) => `${a.emissionDate}${a.emissionTime}${a.controlNumber}`.localeCompare(`${b.emissionDate}${b.emissionTime}${b.controlNumber}`));
  if (kind === 'ventas_contribuyente') {
    rows = sales.filter(i => ['03', '05', '06'].includes(i.dteType)).map(i => {
      if (!uuid.test(i.generationCode) || !i.mhReceptionStamp) throw new Error(`Falta código de generación o sello de recepción real en ${i.controlNumber}.`);
      const dui = i.clientDocType === 'DUI' ? compact(i.clientDocNumber) : '';
      const nit = dui ? '' : compact(i.clientDocNumber || i.clientNrc || '');
      if ((dui && !/^\d{9}$/.test(dui)) || (!dui && !/^\d{1,14}$/.test(nit))) throw new Error(`Revisa la identificación de ${i.clientName}.`);
      return [date(i.emissionDate), '4', i.dteType, compact(i.controlNumber), i.mhReceptionStamp, compact(i.generationCode), '', nit, i.clientName,
        money(i.subtotalExento), money(i.subtotalNoSujeto), money(i.subtotalGravado), money(i.iva13), '0.00', '0.00',
        money(i.subtotalGravado + i.subtotalExento + i.subtotalNoSujeto + i.iva13), dui, codes.operation, codes.income!, '1'];
    });
  } else if (kind === 'ventas_consumidor') {
    const grouped = new Map<string, InvoiceDocument[]>();
    for (const i of sales.filter(i => i.dteType === '01')) {
      if (!uuid.test(i.generationCode) || !i.mhReceptionStamp) throw new Error(`Faltan datos fiscales reales de ${i.controlNumber}.`);
      grouped.set(i.emissionDate, [...(grouped.get(i.emissionDate) || []), i]);
    }
    rows = [...grouped].map(([day, docs]) => {
      const sum = (key: 'subtotalGravado' | 'subtotalExento' | 'subtotalNoSujeto') => docs.reduce((n, i) => n + i[key], 0);
      return [date(day), '4', '01', 'N/A', 'N/A', 'N/A', 'N/A', compact(docs[0].generationCode), compact(docs[docs.length - 1].generationCode), '',
        money(sum('subtotalExento')), '0.00', money(sum('subtotalNoSujeto')), money(sum('subtotalGravado')), '0.00', '0.00', '0.00', '0.00', '0.00',
        money(sum('subtotalExento') + sum('subtotalNoSujeto') + sum('subtotalGravado')), codes.operation, codes.income!, '2'];
    });
  } else {
    rows = purchases.filter(p => ['CCF', 'NOTA_CREDITO'].includes(p.docType)).map(p => {
      if (!p.documentClass) throw new Error(`Indica la clase del comprobante ${p.docNumber}; no se puede inferir de un registro antiguo.`);
      if (p.documentClass === '4' && !uuid.test(p.generationCode || '')) throw new Error(`Falta el código de generación original de ${p.docNumber}.`);
      const number = p.documentClass === '4' ? compact(p.generationCode!) : compact(p.docNumber);
      const id = compact(p.supplierNit), dui = id.length === 9 ? id : '';
      if (!/^\d{9}$|^\d{14}$/.test(id) && !p.supplierNrc) throw new Error(`Revisa el DUI, NIT o NRC de ${p.supplierName}.`);
      // Total purchases is the base before IVA, retentions and perceptions (column O).
      return [date(p.emissionDate), p.documentClass, p.docType === 'CCF' ? '03' : '05', number, dui ? '' : id || compact(p.supplierNrc || ''), p.supplierName,
        money(p.purchasesExentas), '0.00', '0.00', money(p.purchasesGravadas), '0.00', '0.00', '0.00', money(p.creditoFiscal),
        money(p.purchasesGravadas + p.purchasesExentas), dui, codes.operation, codes.classification!, codes.sector!, codes.cost!, '3'];
    });
  }
  if (!rows.length) throw new Error('No hay documentos compatibles para este anexo en el período.');
  return rows.map(row => row.map(clean).join(';')).join('\r\n') + '\r\n';
}
