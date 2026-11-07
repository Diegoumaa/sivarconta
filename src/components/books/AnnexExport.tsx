import { useState } from 'react';
import type { F07Renta, InvoiceDocument, PurchaseDocument } from '../../types';
import { useApp } from '../../context/AppContext';
import { buildF07Annex, type AnnexKind } from '../../utils/f07Export';
import { f07SaleKind, isF07Purchase, needsF07Renta, validF07Renta } from '../../utils/f07Renta';
import { downloadBlob } from '../../utils/reportExport';
import { F07RentaFields } from './F07RentaFields';

export function AnnexExport({ kind, invoices, purchases, period }: {
  kind: AnnexKind; invoices: InvoiceDocument[]; purchases: PurchaseDocument[]; period: string;
}) {
  const { saveF07Renta } = useApp();
  const classificationKind = kind === 'compras' ? 'purchase' : 'sale';
  const [editingId, setEditingId] = useState('');
  const [codes, setCodes] = useState<F07Renta>({ operation: '' });
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const documents = kind === 'compras'
    ? purchases.filter(p => isF07Purchase(p.docType)).map(p => ({ ...p, label: p.docNumber, party: p.supplierName }))
    : invoices.filter(i => i.status === 'PROCESADO_MH' && f07SaleKind(i.dteType) === kind)
      .map(i => ({ ...i, label: i.controlNumber, party: i.clientName }));
  const classifiable = documents.filter(doc => needsF07Renta(classificationKind, doc.emissionDate));
  const pending = classifiable.filter(doc => !validF07Renta(classificationKind, doc.f07Renta));

  const editDocument = (id: string) => {
    setEditingId(id);
    setCodes(classifiable.find(doc => doc.id === id)?.f07Renta ?? { operation: '' });
    setReviewed(false);
    setError('');
  };

  const saveClassification = async () => {
    setSaving(true);
    setError('');
    try {
      await saveF07Renta(classificationKind, editingId, codes);
      editDocument('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la clasificación.');
    } finally {
      setSaving(false);
    }
  };

  const download = () => {
    setError('');
    try {
      const csv = buildF07Annex(kind, invoices, purchases);
      const number = kind === 'ventas_contribuyente' ? 1 : kind === 'ventas_consumidor' ? 2 : 3;
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `F07_A${number}_${period.replace('-', '')}.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el anexo.');
    }
  };

  return <details className="no-print rounded-2xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold">Anexo CSV F-07 del libro seleccionado</summary>
    <div className="mt-4 space-y-3">
      <p className="text-sm text-slate-600">
        {kind === 'compras' ? 'Anexo 3 · Detalle de Compras. Incluye CCF y notas de crédito.'
          : 'Formato F-07 v14. Incluye las ventas aceptadas del libro seleccionado.'}
        {' '}El archivo usa los códigos de cada comprobante, con punto y coma y sin encabezados.
      </p>
      {kind === 'ventas_consumidor' && <p className="text-xs text-slate-600">Las ventas consecutivas del mismo día con la misma clasificación comparten una fila.</p>}
      {pending.length > 0 && <p role="status" className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
        {pending.length === 1 ? 'Hay 1 comprobante pendiente de clasificar.' : `Hay ${pending.length} comprobantes pendientes de clasificar.`}
        {' '}Completa su clasificación para descargar el anexo.
      </p>}
      {classifiable.length > 0 && <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="block text-sm font-medium text-slate-800">
          Revisar clasificación de un comprobante
          <select aria-label="Revisar clasificación de un comprobante" value={editingId} disabled={saving} onChange={e => editDocument(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs">
            <option value="">Selecciona el comprobante</option>
            {classifiable.map(doc => <option key={doc.id} value={doc.id}>
              {`${doc.emissionDate} · ${doc.label} · ${doc.party}${validF07Renta(classificationKind, doc.f07Renta) ? '' : ' · Pendiente'}`}
            </option>)}
          </select>
        </label>
        {editingId && <>
          <F07RentaFields kind={classificationKind} value={codes} onChange={setCodes} disabled={saving} />
          <button type="button" disabled={saving || !validF07Renta(classificationKind, codes)} onClick={saveClassification}
            className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-bold text-brand-800 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar clasificación del comprobante'}
          </button>
        </>}
      </div>}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={reviewed} disabled={pending.length > 0 || !!editingId || !documents.length}
          onChange={e => setReviewed(e.target.checked)} />
        Revisé las clasificaciones y el período del anexo.
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" disabled={!reviewed || pending.length > 0 || !!editingId || !documents.length} onClick={download}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        Descargar anexo F-07 CSV
      </button>
      <a href="https://www.transparenciafiscal.gob.sv/downloads/pdf/700-DGII-MN-2021-26031.pdf" target="_blank" rel="noreferrer" className="ml-3 text-sm text-brand-700 underline">Consultar manual de Hacienda</a>
    </div>
  </details>;
}
