import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { IvaAnnexData, IvaAnnexDraft, IvaAnnexRecord, SpecialAnnex } from '../../types/ivaAnnex';
import { buildSpecialF07, emptyAnnexData, SPECIAL_ANNEXES, specialAnnexRow } from '../../utils/specialF07';
import { downloadBlob } from '../../utils/reportExport';
import { calculateInvoiceTotals, generateUUID } from '../../utils/dteUtils';

const inputClass = 'mt-1 block w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2 text-sm';
export function SpecialAnnexes({ period }: { period: string }) {
  const { currentCompany, filteredAnnexRecords = [], saveAnnexRecord, filteredInvoices, filteredPurchases, dataMode } = useApp();
  const [annex, setAnnex] = useState<SpecialAnnex>('162');
  const [draft, setDraft] = useState<IvaAnnexDraft | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [draftId, setDraftId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [reviewed, setReviewed] = useState(false);
  const records = filteredAnnexRecords.filter(r => r.annex === annex && r.emissionDate.startsWith(period + '-') && !r.voided);
  const spec = SPECIAL_ANNEXES[annex];
  const setData = <K extends keyof IvaAnnexData>(key: K, value: IvaAnnexData[K]) => {
    setDraft(old => {
      if (!old) return old;
      const data = { ...old.data, [key]: value };
      if (key === 'documentClass' && old.annex === 'documentos') data.detailType = value === '4' ? 'D' : 'A';
      if (key === 'from' && old.annex === 'documentos' && old.data.documentClass !== '4') data.documentNumber = String(value);
      return { ...old, data };
    });
    setReviewed(false);
  };
  const field = (key: keyof IvaAnnexData, label: string, type = 'text', required = true) => <label className="text-xs">{label}<input aria-label={label} className={inputClass} type={type} required={required} value={draft?.data[key] || ''} onChange={e => setData(key, e.target.value as never)} {...(type === 'number' ? { min: '0', max: '9999999.99', step: '.01' } : { maxLength: key === 'partyName' ? 500 : 100 })} /></label>;
  const select = (key: keyof IvaAnnexData, label: string, options: [string,string][]) => <label className="text-xs">{label}<select aria-label={label} className={inputClass} value={draft?.data[key] || ''} onChange={e => setData(key, e.target.value as never)} required>{options.map(([value,name]) => <option key={value} value={value}>{name}</option>)}</select></label>;
  const start = () => {
    const data = emptyAnnexData();
    data.docType = annex === '66' ? '14' : spec.types?.includes('07') ? '07' : spec.types?.[0] || '09';
    setDraft({ annex, emissionDate: `${period}-01`, data, relatedInvoiceIds: [], relatedPurchaseIds: [] });
    setDraftId(generateUUID()); setEditingId(undefined); setError(''); setReviewed(false);
  };
  const prefill = (value: string) => {
    if (!draft || !value) return;
    const [source,id] = value.split(':');
    const i = filteredInvoices.find(i => i.id === id), p = filteredPurchases.find(p => p.id === id);
    if (source === 'invoice' && i) {
      const amount = i.dteType === '14'
        ? i.subtotalGravado + i.subtotalExento + i.subtotalNoSujeto
        : annex === '169' && i.items.length
          ? calculateInvoiceTotals(i.dteType, i.items, false, false, false, i.pricesIncludeIva).baseBienesGravados
          : i.subtotalGravado;
      const tax = annex === '169' ? i.percepcion1 || 0 : annex === '162' ? i.retencion1 : 0;
      setDraft({ ...draft, emissionDate: i.emissionDate, relatedInvoiceIds: [id], relatedPurchaseIds: [], data: { ...draft.data, documentClass: '4', partyDocType: i.clientDocType === 'DUI' ? 'DUI' : 'NIT', partyDoc: i.clientDocNumber, partyName: i.clientName, docType: annex === '162' ? '07' : i.dteType, series: annex === '162' ? '' : i.mhReceptionStamp || '', documentNumber: annex === '162' ? '' : i.controlNumber, generationCode: annex === '162' ? '' : i.generationCode, amount: amount.toFixed(2), taxAmount: tax.toFixed(2) } });
    } else if (source === 'purchase' && p) {
      const tax = annex === '163' ? p.percepcion1 || 0 : annex === '170' ? p.retencion1 : annex === '66' || annex === '172' ? p.retencionIva13 || 0 : 0;
      const sameDoc = annex === '66' || annex === '163';
      const amount = annex === '66' ? p.purchasesGravadas + p.purchasesExentas : annex === '163' ? p.perceptionBase ?? p.purchasesGravadas : p.purchasesGravadas;
      setDraft({
        ...draft, emissionDate: p.emissionDate, relatedInvoiceIds: [], relatedPurchaseIds: [id],
        data: {
          ...draft.data, documentClass: sameDoc ? p.documentClass || '1' : '1',
          partyDocType: (p.supplierNit || '').replace(/\D/g, '').length === 9 ? 'DUI' : 'NIT',
          partyDoc: p.supplierNit || '', partyName: p.supplierName,
          docType: annex === '66' ? '14' : annex === '163' ? p.docType === 'NOTA_CREDITO' ? '05' : '03' : '07',
          documentNumber: sameDoc ? p.docNumber : '', generationCode: sameDoc ? p.generationCode || '' : '',
          series: sameDoc ? p.documentSeries || '' : '', amount: amount.toFixed(2), taxAmount: tax.toFixed(2)
        }
      });
    }
    setReviewed(false);
  };
  const sources = annex === '162' || annex === '169' || annex === '66' ? filteredInvoices.filter(i => i.status === 'PROCESADO_MH' && (annex === '66' ? i.dteType === '14' : annex === '169' ? (i.percepcion1 || 0) > 0 : i.retencion1 > 0)) : [];
  const purchases = ['163','170','172','66'].includes(annex) ? filteredPurchases.filter(p => annex === '66' ? p.docType === 'SUJETO_EXCLUIDO' : annex === '163' ? (p.percepcion1 || 0) > 0 : annex === '172' ? (p.retencionIva13 || 0) > 0 : p.retencion1 > 0) : [];
  return <details className="no-print rounded-2xl border border-brand-200 bg-white p-4">
    <summary className="cursor-pointer font-bold text-brand-900">Casillas especiales F-07 · Retenciones y percepciones</summary>
    <div className="mt-4 space-y-4">
      <p className="text-sm text-slate-600">Registra los comprobantes reales del período. Estos anexos informan operaciones existentes; aquí no se emiten ni invalidan DTE. La retención de renta del 10 % no se incluye como retención de IVA.</p>
      {dataMode === 'local-demo' && <p className="text-xs font-semibold text-amber-800">Demostración: los registros y CSV de esta sesión no tienen validez fiscal.</p>}
      <label className="block text-sm font-semibold">Anexo de casilla especial<select aria-label="Anexo de casilla especial" className={inputClass} value={annex} disabled={saving} onChange={e => { setAnnex(e.target.value as SpecialAnnex); setDraft(null); setError(''); setReviewed(false); }}>{Object.entries(SPECIAL_ANNEXES).map(([id,s]) => <option key={id} value={id}>{s.label}</option>)}</select></label>
      <div className="flex flex-wrap items-center gap-3"><span className="text-sm">{records.length} comprobante(s) · {period}</span><button onClick={start} disabled={saving} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white">Registrar comprobante de anexo</button></div>
      {records.length > 0 && <ul className="space-y-2">{records.map(r => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs"><span>{r.emissionDate} · {r.data.partyName || r.data.partyDoc || r.data.docType} · {r.data.documentNumber} · IVA ${Number(r.data.taxAmount || 0).toFixed(2)}</span><button onClick={() => { setDraft(r); setEditingId(r.id); setError(''); setReviewed(false); }} className="font-bold text-brand-700">Corregir registro</button></li>)}</ul>}
      {draft && <form className="space-y-4 rounded-xl border p-4" aria-label="Comprobante de anexo F-07" onSubmit={async e => {
        e.preventDefault(); if (savingRef.current) return; setError('');
        try { specialAnnexRow({ ...draft, id: editingId || 'preview', companyId: currentCompany.id }); } catch (err) { setError(err instanceof Error ? err.message : 'Revisa los datos.'); return; }
        savingRef.current = true; setSaving(true);
        try { await saveAnnexRecord(draft, editingId || draftId); setDraft(null); setReviewed(false); } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar. Conservamos tus datos para reintentar.'); } finally { savingRef.current = false; setSaving(false); }
      }}>
        <fieldset disabled={saving} className="space-y-4">
          {(sources.length > 0 || purchases.length > 0) && <label className="block text-xs">Preparar desde documento existente<select aria-label="Preparar desde documento existente" className={inputClass} value="" onChange={e => prefill(e.target.value)}><option value="">Selecciona para completar y vincular</option>{sources.map(i => <option key={i.id} value={`invoice:${i.id}`}>{i.controlNumber} · {i.clientName}</option>)}{purchases.map(p => <option key={p.id} value={`purchase:${p.id}`}>{p.docNumber} · {p.supplierName}</option>)}</select></label>}
          {(draft.relatedInvoiceIds.length > 0 || draft.relatedPurchaseIds.length > 0) && <p className="text-xs text-brand-800">Vinculado con {draft.relatedInvoiceIds.length + draft.relatedPurchaseIds.length} documento(s). Su impuesto se contará una sola vez. <button type="button" className="underline" onClick={() => setDraft({ ...draft, relatedInvoiceIds: [], relatedPurchaseIds: [] })}>Quitar vínculo</button></p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs">Fecha de emisión del comprobante<input aria-label="Fecha de emisión del comprobante" className={inputClass} type="date" required value={draft.emissionDate} onChange={e => setDraft({ ...draft, emissionDate: e.target.value })} /></label>
            {select('documentClass','Clase del documento del anexo',[['1','Impreso'],['2','Formulario único'],['4','DTE electrónico']])}
            {annex !== 'documentos' && <>{select('partyDocType','Identificación de la contraparte',[['NIT','NIT'],['DUI','DUI'], ...(annex === '108' ? [['NRC','NRC']] as [string,string][] : []), ...(annex === '66' ? [['OTRO','Otro documento']] as [string,string][] : [])])}{field('partyDoc','Número de identificación')}{field('partyName','Nombre de la contraparte','text', annex === '66' || annex === '108')}</>}
            {spec.types && select('docType','Tipo de documento del anexo',spec.types.map(t => [t, `${t} · ${({'01':'Factura','03':'CCF','05':'Nota de crédito','06':'Nota de débito','07':'Comprobante de retención','11':'Factura de exportación','12':'Declaración de mercancía','14':'Sujeto excluido'} as Record<string,string>)[t] || 'Documento'}`]))}
            {field('series',draft.data.documentClass === '4' ? 'Sello de recepción real (40 caracteres)' : 'Serie autorizada')}
            {(annex !== 'documentos' || draft.data.documentClass === '4') && field('documentNumber',draft.data.documentClass === '4' ? 'Número de control real' : 'Número del comprobante')}
            {draft.data.documentClass === '4' ? field('generationCode','Código de generación real') : ['108','169','170','171','172','documentos'].includes(annex) && field('resolution','Resolución autorizada')}
            {annex !== 'documentos' && <>{field('amount','Base sujeta sin IVA','number')}{field('taxAmount',annex === '66' ? 'Retención IVA 13 % (0.00 si no aplica)' : annex === '108' ? 'IVA de la operación' : `Importe IVA ${spec.rate} % del comprobante`,'number')}</>}
            {annex === '66' && draft.emissionDate >= '2024-02-01' && <>{select('operation','Operación de renta',[['','Selecciona'],['1','1 · Gravada'],['2','2 · No gravada'],['3','3 · Excluida'],['4','4 · Mixta'],['8','8 · Informada en más de un anexo'],['9','9 · Excepciones']])}{select('classification','Clasificación de la compra',[['','Selecciona'],['1','1 · Costo'],['2','2 · Gasto'],['9','9 · Excepciones']])}{select('sector','Sector de la compra',[['','Selecciona'],['1','1 · Industria'],['2','2 · Comercio'],['3','3 · Agropecuaria'],['4','4 · Servicios'],['9','9 · Excepciones']])}{select('cost','Costo o gasto de la compra',[['','Selecciona'],['1','1 · Venta'],['2','2 · Administración'],['3','3 · Financieros'],['4','4 · Artículos producidos/comprados'],['5','5 · Artículos internos'],['6','6 · Fabricación indirectos'],['7','7 · Mano de obra'],['8','8 · Más de un anexo'],['9','9 · Excepciones']])}</>}
            {annex === '108' && <>{select('settlementClass','Clase del comprobante de liquidación',[['1','Impreso'],['2','Formulario único'],['4','DTE']])}{field('settlementDate','Fecha del comprobante de liquidación','date')}{field('settlementSeries','Serie o sello de liquidación')}{field('settlementResolution','Resolución de liquidación','text',draft.data.settlementClass !== '4')}{field('settlementNumber','Número o control de liquidación')}{draft.data.settlementClass === '4' && field('settlementGenerationCode','Código de generación de liquidación')}</>}
            {annex === 'documentos' && <>{select('detailType','Estado legal del documento',draft.data.documentClass === '4' ? [['D','D · DTE invalidado ante Hacienda']] : [['A','A · Anulado'],['X','X · Extraviado']])}{draft.data.documentClass !== '4' && <>{field('preprintedFrom','Preimpreso desde')}{field('preprintedTo','Preimpreso hasta')}{field('from','Numeración desde')}{field('to','Numeración hasta')}</>}</>}
          </div>
          <p className="text-xs text-slate-500">Aplica únicamente los impuestos que correspondan a la operación y a la calidad de agente de las partes. Transcribe el comprobante; el registro no acredita por sí mismo su aceptación por Hacienda.</p>
          <div className="flex flex-wrap gap-2"><button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white" type="submit">{saving ? 'Guardando…' : 'Guardar comprobante de anexo'}</button><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setDraft(null)}>Cancelar</button>{editingId && <button type="button" className="rounded-lg border px-3 py-2 text-sm text-red-700" onClick={async () => { if (savingRef.current) return; savingRef.current = true; setSaving(true); try { await saveAnnexRecord({ ...draft, voided: true }, editingId); setDraft(null); } catch { setError('No se pudo excluir el registro.'); } finally { savingRef.current = false; setSaving(false); } }}>Excluir registro del anexo</button>}</div>
        </fieldset>
      </form>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Revisé los comprobantes, sus vínculos y el período antes de exportar.</label>
      <button disabled={!reviewed || !!draft || saving} onClick={() => { setError(''); try { const csv = buildSpecialF07(annex, filteredAnnexRecords, period); downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `F07_A${spec.number}_${period.replace('-','')}.csv`); } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo generar.'); } }} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Descargar CSV de casilla especial</button>
      <p className="text-xs text-slate-500">Anexos 4 al 12 y detalle de documentos de la plantilla recibida. CSV con punto y coma, sin encabezados. No incluye anexos sectoriales de combustibles ni decretos especiales ajenos a esa plantilla.</p>
    </div>
  </details>;
}
