import type { Company, InvoiceDocument, PurchaseDocument } from '../types';
import type { ReportCell } from './reportExport';
import type { AnnexKind } from './f07Export';

export interface BookReport {
  title: string;
  columns: string[];
  widths: number[];
  firstMoney: number;
  rows: ReportCell[][];
  totals: ReportCell[];
  groups: { label: string; span: number }[];
  notice?: string;
}
export function buildIvaBookReport(kind: AnnexKind, invoices: InvoiceDocument[], purchases: PurchaseDocument[]): BookReport {
  const sales = invoices.filter(i => i.status === 'PROCESADO_MH').sort((a, b) => `${a.emissionDate}${a.emissionTime}${a.controlNumber}`.localeCompare(`${b.emissionDate}${b.emissionTime}${b.controlNumber}`));
  let title: string, columns: string[], rows: ReportCell[][], groups: BookReport['groups'];
  if (kind === 'ventas_contribuyente') {
    title = 'LIBRO DE VENTAS A CONTRIBUYENTES';
    columns = ['Corr.', 'Fecha emisión', 'Documento', 'Nombre del cliente', 'NIT / DUI', 'Exentas propias', 'Gravadas propias', 'Débito propio', 'No sujetas propias', 'Exentas terceros', 'Gravadas terceros', 'Débito terceros', 'IVA retenido', 'IVA percibido', 'Total documento'];
    groups = [{ label: 'Identificación del documento y cliente', span: 5 }, { label: 'Operaciones propias', span: 4 }, { label: 'A cuenta de terceros', span: 3 }, { label: 'Retenciones y totales', span: 3 }];
    rows = sales.filter(i => ['03', '05', '06'].includes(i.dteType)).map((i, index) => {
      const s = i.dteType === '05' ? -1 : 1;
      return [index + 1, i.emissionDate, i.generationCode || i.controlNumber, i.clientName, i.clientDocNumber, i.subtotalExento * s, i.subtotalGravado * s, i.iva13 * s, i.subtotalNoSujeto * s, 0, 0, 0, i.retencion1 * s, (i.percepcion1 || 0) * s, (i.subtotalGravado + i.subtotalExento + i.subtotalNoSujeto + i.iva13) * s];
    });
  } else if (kind === 'ventas_consumidor') {
    title = 'LIBRO DE VENTAS A CONSUMIDOR FINAL';
    columns = ['N.º', 'Día', 'Del n.º', 'Al n.º', 'Del código', 'Al código', 'Tipo doc.', 'Ventas exentas', 'Ventas internas gravadas sin IVA', 'Exportaciones', 'IVA retenido', 'Débito fiscal', 'Ventas no sujetas', 'Ventas totales'];
    groups = [{ label: 'Registro', span: 2 }, { label: 'Documentos emitidos', span: 2 }, { label: 'Código de generación', span: 2 }, { label: 'Operaciones del período', span: 8 }];
    rows = sales.filter(i => i.dteType === '01').map((i, index) => [index + 1, i.emissionDate, i.controlNumber, i.controlNumber, i.generationCode, i.generationCode, 'Factura', i.subtotalExento, Number((i.subtotalGravado - i.iva13).toFixed(2)), 0, i.retencion1, i.iva13, i.subtotalNoSujeto, i.subtotalGravado + i.subtotalExento + i.subtotalNoSujeto]);
  } else {
    title = 'LIBRO DE COMPRAS';
    columns = ['Corr.', 'Fecha emisión', 'Número de documento', 'NIT / DUI', 'Nombre del proveedor', 'Internas exentas', 'Importaciones exentas', 'Internas gravadas', 'Importaciones gravadas', 'Crédito fiscal', 'IVA percibido', 'Total compras', 'Sujeto excluido', 'Retención a terceros', 'ISR retenido'];
    groups = [{ label: 'Identificación del documento y proveedor', span: 5 }, { label: 'Compras exentas', span: 2 }, { label: 'Compras gravadas', span: 3 }, { label: 'Retenciones y totales', span: 5 }];
    rows = [...purchases].sort((a, b) => `${a.emissionDate}${a.docNumber}`.localeCompare(`${b.emissionDate}${b.docNumber}`)).map((p, index) => {
      const s = p.docType === 'NOTA_CREDITO' ? -1 : 1, fse = p.docType === 'SUJETO_EXCLUIDO';
      return [index + 1, p.emissionDate, p.documentClass === '4' && p.generationCode ? p.generationCode : p.docNumber, p.supplierNit, p.supplierName, fse ? 0 : p.purchasesExentas * s, 0, fse ? 0 : p.purchasesGravadas * s, 0, p.creditoFiscal * s, (p.percepcion1 || 0) * s, fse ? 0 : (p.purchasesGravadas + p.purchasesExentas + p.creditoFiscal) * s, fse ? p.purchasesGravadas + p.purchasesExentas : 0, p.retencion1 * s, (p.retencionRenta10 || 0) * s];
    });
  }
  const firstMoney = kind === 'ventas_consumidor' ? 7 : 5;
  const identificationWidths = kind === 'ventas_consumidor'
    ? [54, 112, 208, 208, 218, 218, 84]
    : kind === 'compras' ? [54, 112, 226, 142, 214] : [54, 112, 226, 214, 142];
  const widths = columns.map((_, index) => identificationWidths[index] ?? 106);
  const totals: ReportCell[] = columns.map((_, col) => col === 0 ? 'TOTAL' : col >= firstMoney ? Number(rows.reduce((sum, row) => sum + (typeof row[col] === 'number' ? Number(row[col]) : 0), 0).toFixed(2)) : '');
  return { title, columns, widths, firstMoney, rows, totals, groups };
}
export function bookSpreadsheetRows(report: BookReport, company: Company, periodLabel: string): ReportCell[][] {
  return [
    [company.name],
    [report.title],
    [`NIT: ${company.nit}     NRC: ${company.nrc}`],
    [`Período: ${periodLabel}`],
    [`Valores expresados en USD${report.notice ? ' · ' + report.notice : ''}`],
    report.columns, ...report.rows, report.totals, [], ['F. _________________________'], ['CONTADOR'],
  ];
}
