import React, { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Company, InvoiceDocument } from '../../types';
import { INVOICE_EMAIL_ENDPOINT, MAX_INVOICE_EMAIL_BATCH, invoiceEmailIssue, type InvoiceEmailResult } from '../../types/invoiceEmail';

const stateLabel: Record<InvoiceEmailResult['state'], string> = {
  accepted: 'Aceptado por el proveedor',
  already_accepted: 'Ya registrado, sin duplicar',
  rejected: 'Rechazado por el proveedor',
  review: 'Por verificar con el administrador',
  simulated: 'Envío simulado',
};

interface Props {
  company: Company;
  invoices: InvoiceDocument[];
  demo: boolean;
}

export function InvoiceEmailPanel({ company, invoices, demo }: Props) {
  const [open, setOpen] = useState(false);
  const [availability, setAvailability] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [review, setReview] = useState<InvoiceDocument[]>([]);
  const [results, setResults] = useState<InvoiceEmailResult[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const eligible = invoices.filter(invoice => !invoiceEmailIssue(invoice, demo));
  const selected = eligible.filter(invoice => selectedIds.includes(invoice.id));
  const production = company.mhEnvironment === 'PRODUCCION';
  const canSend = demo || (availability === 'ready' && production);

  useEffect(() => {
    if (!open || demo) return;
    const controller = new AbortController();
    setAvailability('loading');
    fetch(INVOICE_EMAIL_ENDPOINT, { signal: controller.signal, cache: 'no-store' })
      .then(async response => response.ok && (await response.json()).available === true)
      .then(available => {
        if (!controller.signal.aborted) setAvailability(available ? 'ready' : 'unavailable');
      })
      .catch(() => { if (!controller.signal.aborted) setAvailability('unavailable'); });
    return () => controller.abort();
  }, [open, demo]);

  const toggleSelection = (id: string) => {
    setSelectedIds(previous => {
      // Selection follows the filters, so hidden documents cannot enter a batch.
      const visible = previous.filter(value => eligible.some(invoice => invoice.id === value));
      if (visible.includes(id)) return visible.filter(value => value !== id);
      return visible.length < MAX_INVOICE_EMAIL_BATCH ? [...visible, id] : visible;
    });
  };

  async function confirm() {
    if (sending.current || !review.length || !canSend) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      if (demo) {
        setResults(review.map(invoice => ({ invoiceId: invoice.id, state: 'simulated' })));
        return;
      }
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error('Inicia sesión para enviar documentos.');
      const response = await fetch(INVOICE_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyId: company.id,
          documents: review.map(invoice => ({ invoiceId: invoice.id, email: invoice.clientEmail.trim() })),
        }),
      });
      const data = await response.json() as { results?: InvoiceEmailResult[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'No se pudo confirmar el envío.');
      if (!Array.isArray(data.results) || data.results.length !== review.length ||
        new Set(data.results.map(result => result.invoiceId)).size !== review.length ||
        data.results.some(result => !review.some(invoice => invoice.id === result.invoiceId) ||
          !Object.prototype.hasOwnProperty.call(stateLabel, result.state) || result.state === 'simulated')) {
        throw new Error('No se pudo confirmar el resultado completo del lote.');
      }
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error && err.name !== 'TypeError' ? err.message : 'No se pudo confirmar el envío. Revisa la conexión y vuelve a intentarlo.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const reset = () => { setReview([]); setResults(undefined); setSelectedIds([]); setError(''); };
  const action = 'min-h-11 rounded-lg px-3 py-2 text-sm font-semibold';

  return <section aria-label="Envío por correo" className="rounded-2xl border border-slate-200 bg-white p-4">
    <button type="button" aria-expanded={open} disabled={busy} className={`${action} inline-flex items-center gap-2 bg-brand-50 text-brand-800`}
      onClick={() => { if (open) reset(); setOpen(!open); }}>
      <Mail size={17} aria-hidden="true" /> Enviar por correo
    </button>
    {open && <div className="mt-4 space-y-4">
      {demo && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Demostración. El envío se simula y ningún destinatario recibe correo.</p>}
      {!demo && availability === 'loading' && <p role="status" className="text-sm text-slate-600">Comprobando el servicio de correo…</p>}
      {!demo && availability === 'unavailable' && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">El envío real está pendiente de configurar. Puedes revisar la selección.</p>}
      {!demo && !production && <p className="text-sm text-slate-600">Los envíos reales están disponibles para documentos aceptados de empresas en ambiente de producción.</p>}
      {!review.length ? <>
        <p className="text-sm text-slate-700">Selecciona hasta {MAX_INVOICE_EMAIL_BATCH} documentos de la lista filtrada. Cada PDF se envía en un correo separado al destinatario registrado.</p>
        {eligible.length > 0 ? <>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${action} border border-slate-300`}
              onClick={() => setSelectedIds(eligible.slice(0, MAX_INVOICE_EMAIL_BATCH).map(invoice => invoice.id))}>
              {eligible.length > MAX_INVOICE_EMAIL_BATCH ? `Seleccionar los primeros ${MAX_INVOICE_EMAIL_BATCH}` : 'Seleccionar elegibles'}
            </button>
            <button type="button" className={`${action} text-slate-700`} onClick={() => setSelectedIds([])}>Limpiar selección</button>
            <span role="status" className="text-sm text-slate-600">{selected.length} seleccionados</span>
          </div>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
            {eligible.map(invoice => {
              const checked = selectedIds.includes(invoice.id);
              return <li key={invoice.id}>
                <label className="flex min-h-11 items-start gap-3 p-3 text-sm">
                  <input type="checkbox" className="mt-1" checked={checked}
                    disabled={!checked && selected.length >= MAX_INVOICE_EMAIL_BATCH}
                    aria-label={`Seleccionar documento ${invoice.controlNumber}`} onChange={() => toggleSelection(invoice.id)} />
                  <span className="min-w-0"><strong className="block">{invoice.clientName}</strong>
                    <span className="block break-all text-xs text-slate-600">{invoice.controlNumber} · {invoice.clientEmail.trim()}</span>
                  </span>
                </label>
              </li>;
            })}
          </ul>
          <button type="button" disabled={!selected.length}
            className={`${action} bg-brand-600 text-white disabled:opacity-50`} onClick={() => { setReview(selected); setError(''); }}>Revisar lote</button>
        </> : <p className="text-sm text-slate-600">No hay documentos aceptados con sello, partidas y correo válido en esta lista.</p>}
        {invoices.length > eligible.length && <p className="text-xs text-slate-600">{invoices.length - eligible.length} documentos quedaron fuera de la selección por falta de aceptación, partidas o correo.</p>}
      </> : <>
        <h2 className="font-bold text-slate-900">{results ? 'Resultado del lote' : 'Revisa los destinatarios'}</h2>
        {!results && <p className="text-sm text-slate-600">Confirma que los {review.length} documentos de {company.name} corresponden a estos correos.</p>}
        <ul className="max-h-64 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
          {review.map(invoice => {
            const result = results?.find(row => row.invoiceId === invoice.id);
            return <li key={invoice.id} className="p-3 text-sm">
              <strong className="block">{invoice.clientName}</strong>
              <p className="break-all text-xs text-slate-600">{invoice.controlNumber} · {invoice.clientEmail.trim()}</p>
              {result && <p className="mt-1 font-semibold">{stateLabel[result.state]}</p>}
            </li>;
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          {results ? <button type="button" className={`${action} border border-slate-300`} onClick={reset}>Preparar otro lote</button> : <>
            <button type="button" disabled={busy || !canSend} className={`${action} bg-brand-600 text-white disabled:opacity-50`} onClick={() => void confirm()}>
              {busy ? 'Enviando…' : demo ? 'Simular envío' : 'Confirmar envío por correo'}
            </button>
            <button type="button" disabled={busy} className={`${action} border border-slate-300`} onClick={() => { setReview([]); setError(''); }}>Volver a la selección</button>
          </>}
        </div>
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>}
  </section>;
}
