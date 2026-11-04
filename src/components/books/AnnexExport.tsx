import React, { useState } from 'react';
import type { InvoiceDocument, PurchaseDocument } from '../../types';
import { buildF07Annex, type AnnexKind, type RentaCodes } from '../../utils/f07Export';
import { downloadBlob } from '../../utils/reportExport';

export function AnnexExport({ kind, invoices, purchases, period }: { kind: AnnexKind; invoices: InvoiceDocument[]; purchases: PurchaseDocument[]; period: string }) {
  const [codes, setCodes] = useState<RentaCodes>({ operation: '' });
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const select = (key: keyof RentaCodes, label: string, options: [string, string][]) => <label className="text-xs">{label}<select aria-label={label} value={codes[key] || ''} onChange={e => { setCodes(s => ({ ...s, [key]: e.target.value })); setReviewed(false); }} className="mt-1 block w-full rounded-lg border p-2"><option value="">Selecciona</option>{options.map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}</select></label>;
  return <details className="no-print rounded-2xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold">Anexo CSV F-07 del libro seleccionado</summary>
    <div className="mt-4 space-y-3">
      <p className="text-sm text-slate-600">Formato F-07 v14: separado por punto y coma, sin encabezados. Las ventas usan documentos aceptados; el consumidor final se agrupa por día. Compras incluye CCF y notas de crédito, y excluye facturas y FSE.</p>
      <p className="text-xs text-slate-600">Los códigos siguientes se aplicarán a todos los registros de este archivo. Si requieren clasificaciones diferentes, prepara el anexo con tu contador; esta exportación admite una clasificación común por archivo. No incluye exportaciones, importaciones ni los anexos de casillas especiales.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {select('operation', 'Tipo de operación de renta', [['1', 'Gravada'], ['2', 'No gravada o exenta'], ['3', 'Excluido o no constituye renta'], ['4', 'Mixta'], ...(kind === 'compras' ? [['8', 'Informada en más de un anexo'], ['9', 'Excepciones']] as [string, string][] : [['12', 'Ingresos sujetos a retención informados'], ['13', 'Sujetos pasivos excluidos']] as [string, string][])])}
        {kind !== 'compras' ? select('income', 'Tipo de ingreso de renta', [['1', 'Profesiones, artes y oficios'], ['2', 'Servicios'], ['3', 'Comercio'], ['4', 'Industria'], ['5', 'Agropecuarias'], ['6', 'Utilidades y dividendos'], ['7', 'Exportaciones'], ['8', 'Servicios del exterior'], ['9', 'Exportaciones de servicios'], ['10', 'Otras rentas gravables'], ['12', 'Ingresos sujetos a retención'], ['13', 'Sujetos pasivos excluidos']]) : <>
          {select('classification', 'Clasificación de renta', [['1', 'Costo'], ['2', 'Gasto'], ['9', 'Excepciones']])}
          {select('sector', 'Sector de renta', [['1', 'Industria'], ['2', 'Comercio'], ['3', 'Agropecuaria'], ['4', 'Servicios, profesiones, artes y oficios'], ['9', 'Excepciones']])}
          {select('cost', 'Tipo de costo o gasto', [['1', 'Gastos de venta sin donación'], ['2', 'Administración sin donación'], ['3', 'Financieros sin donación'], ['4', 'Costo artículos producidos/comprados'], ['5', 'Costo artículos producidos/comprados interno'], ['6', 'Costos indirectos de fabricación'], ['7', 'Mano de obra'], ['8', 'Informada en más de un anexo'], ['9', 'Excepciones']])}
        </>}
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Revisé que todos los registros comparten estos códigos y corresponden al período.</label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={!reviewed} onClick={() => { setError(''); try { const csv = buildF07Annex(kind, invoices, purchases, codes); downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `F07_${kind === 'ventas_contribuyente' ? 'A1' : kind === 'ventas_consumidor' ? 'A2' : 'A3'}_${period.replace('-', '')}.csv`); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo generar el anexo.'); } }} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Descargar anexo F-07 CSV</button>
      <a href="https://www.transparenciafiscal.gob.sv/downloads/pdf/700-DGII-MN-2021-26031.pdf" target="_blank" rel="noreferrer" className="ml-3 text-sm text-brand-700 underline">Consultar manual de Hacienda</a>
    </div>
  </details>;
}
