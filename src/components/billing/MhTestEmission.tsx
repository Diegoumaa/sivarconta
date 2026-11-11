import { useState } from 'react';
import { DTE_NAMES, type InvoiceDocument } from '../../types';
import { requestMhEmission, type MhAction, type MhEmissionResponse, type MhExtra } from '../../services/mhEmission';
import { MH_DISTRITOS, codigoDepartamento } from '../../data/mhCatalogos';
import { ActividadEconomicaInput, codigoActividad } from './ActividadEconomicaInput';

const SUPPORTED = new Set(['01', '03', '05', '06', '14']);
const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

export function MhTestEmission({ invoice, cloud, onSaved }: {
  invoice: InvoiceDocument; cloud: boolean; onSaved: (invoice: InvoiceDocument) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [campo, setCampo] = useState<MhEmissionResponse['campo']>();
  const [distrito, setDistrito] = useState('');
  const [actividad, setActividad] = useState('');
  const [invalidating, setInvalidating] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [tipoAnulacion, setTipoAnulacion] = useState<1 | 2 | 3>(2);
  const [reemplazo, setReemplazo] = useState('');
  if (!cloud || !SUPPORTED.has(invoice.dteType)) return null;
  const accepted = invoice.status === 'PROCESADO_MH' && invoice.mhEnvironment === '00' && Boolean(invoice.mhReceptionStamp);
  const invalidated = invoice.status === 'INVALIDADO' && invoice.mhEnvironment === '00';
  const reserved = Boolean(invoice.mhEmissionState);
  const canSend = invoice.status === 'BORRADOR' || invoice.mhEmissionState === 'PREPARADO';
  if (!canSend && !reserved && !accepted && !invalidated) return null;
  const nombre = DTE_NAMES[invoice.dteType]?.name || 'Documento';
  const distritos = MH_DISTRITOS[codigoDepartamento(invoice.clientDepartment || '') || ''] || [];
  const needsReplacement = tipoAnulacion !== 2 && invoice.dteType !== '05';
  const motivoOk = motivo.trim().length >= 5 && motivo.trim().length <= 200;
  const reemplazoOk = !needsReplacement || UUID.test(reemplazo.trim());

  const run = async (action: MhAction, extra?: MhExtra) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = extra ? await requestMhEmission(invoice.companyId, invoice.id, action, extra)
        : await requestMhEmission(invoice.companyId, invoice.id, action);
      if (response.invoice) onSaved(response.invoice);
      setCampo(response.campo);
      if (response.error) setError(response.error);
      else if (action === 'invalidar') {
        setInvalidating(false);
        setMessage(response.confirmed ? 'Invalidación aceptada por Hacienda (ambiente 00).' : response.message || 'La invalidación aún no tiene sello confirmado.');
      } else setMessage(response.confirmed ? 'PROCESADO en ambiente 00. Sello confirmado por consulta a Hacienda.' : response.message || 'Hacienda rechazó el documento. Revisa el código y sus observaciones.');
    } catch (err) { setError(err instanceof Error ? err.message : 'No pudimos confirmar el estado.'); }
    finally { setBusy(false); }
  };

  return <section aria-label="Conexión con Hacienda en pruebas" className="no-print border-b border-blue-200 bg-blue-50 px-4 py-4 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 text-sm text-blue-950">
        <p className="font-bold">Hacienda · ambiente de pruebas 00</p>
        <p className="mt-1 text-xs">{nombre} ({invoice.dteType}). Sin validez fiscal. El servidor reserva el correlativo y verifica el UUID antes de enviar.</p>
      </div>
      {!invalidated && <div className="flex flex-wrap gap-2">
        {accepted && !invalidating && <button type="button" onClick={() => { setInvalidating(true); setError(''); setMessage(''); }} disabled={busy}
          className="min-h-11 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-50 disabled:opacity-60">
          Invalidar en Hacienda (pruebas)
        </button>}
        <button type="button" onClick={() => run(canSend ? 'transmitir' : 'consultar')} disabled={busy} aria-busy={busy}
          className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
          {busy ? 'Verificando con Hacienda…' : canSend ? 'Transmitir a Hacienda (pruebas)' : 'Consultar estado en Hacienda'}
        </button>
      </div>}
    </div>

    {invalidated && <p className="mt-3 text-sm font-semibold text-red-900">
      Documento invalidado en Hacienda (ambiente 00){invoice.mhInvalidationStamp ? ` · Sello del evento: ${invoice.mhInvalidationStamp}` : ''}. Verifícalo con el QR o la consulta pública.
    </p>}

    {canSend && campo === 'distrito' && <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
      onSubmit={e => { e.preventDefault(); if (distrito) run('transmitir', { distrito }); }}>
      <label className="text-sm font-semibold text-blue-950">Distrito del cliente ({invoice.clientDepartment || 'departamento sin registrar'})
        <select value={distrito} onChange={e => setDistrito(e.target.value)} className={`${field} mt-1`} required>
          <option value="">Selecciona el distrito</option>
          {distritos.map(d => <option key={d.codigo} value={d.codigo}>{d.nombre}</option>)}
        </select>
      </label>
      <button type="submit" disabled={busy || !distrito} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Guardar y transmitir</button>
      {!distritos.length && <p className="text-xs text-red-800 sm:col-span-2">El departamento del cliente no coincide con el catálogo de Hacienda. Corrige el cliente y vuelve a guardar el borrador.</p>}
    </form>}

    {canSend && campo === 'actividad' && <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start"
      onSubmit={e => { e.preventDefault(); const code = codigoActividad(actividad); if (code) run('transmitir', { actividad: code }); }}>
      <label htmlFor="mh-actividad" className="text-sm font-semibold text-blue-950 sm:col-span-2">Actividad económica del cliente (catálogo CAT-019)</label>
      <div><ActividadEconomicaInput id="mh-actividad" value={actividad} onChange={setActividad} className={field} required /></div>
      <button type="submit" disabled={busy || !codigoActividad(actividad)} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Guardar y transmitir</button>
    </form>}

    {invalidating && accepted && <form aria-label="Invalidar documento" className="mt-3 space-y-3 rounded-xl border border-red-200 bg-white p-3"
      onSubmit={e => { e.preventDefault(); if (motivoOk && reemplazoOk) run('invalidar', { motivo: motivo.trim(), tipoAnulacion, ...(needsReplacement ? { reemplazo: reemplazo.trim().toUpperCase() } : {}) }); }}>
      <p className="text-sm font-bold text-red-900">La invalidación es definitiva: Hacienda marcará este documento como «Invalidado».</p>
      <fieldset className="space-y-1 text-sm text-slate-900">
        <legend className="font-semibold">Tipo de invalidación</legend>
        <label className="flex items-center gap-2"><input type="radio" name="mh-tipo" checked={tipoAnulacion === 2} onChange={() => setTipoAnulacion(2)} /> 2 · Rescindir la operación (sin documento de reemplazo)</label>
        <label className="flex items-center gap-2"><input type="radio" name="mh-tipo" checked={tipoAnulacion === 1} onChange={() => setTipoAnulacion(1)} /> 1 · Error en la información (reemplazado por otro documento)</label>
        <label className="flex items-center gap-2"><input type="radio" name="mh-tipo" checked={tipoAnulacion === 3} onChange={() => setTipoAnulacion(3)} /> 3 · Otro (reemplazado por otro documento)</label>
      </fieldset>
      {needsReplacement && <label className="block text-sm font-semibold text-slate-900">Código de generación del documento de reemplazo (ya aceptado)
        <input value={reemplazo} onChange={e => setReemplazo(e.target.value)} className={`${field} mt-1 font-mono`} placeholder="XXXXXXXX-XXXX-4XXX-XXXX-XXXXXXXXXXXX" required />
      </label>}
      <label className="block text-sm font-semibold text-slate-900">Motivo (5 a 200 caracteres)
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={200} rows={2} className={`${field} mt-1`} required />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !motivoOk || !reemplazoOk} className="min-h-11 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
          {busy ? 'Enviando evento…' : 'Confirmar invalidación'}
        </button>
        <button type="button" onClick={() => setInvalidating(false)} disabled={busy} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">Cancelar</button>
      </div>
    </form>}

    {busy && <p role="status" className="mt-3 text-sm text-blue-950">Mantén este documento abierto. Si la conexión se corta, consulta su estado antes de continuar.</p>}
    {message && <p role="status" className="mt-3 text-sm font-semibold text-blue-950">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-800">{error}</p>}
    {invoice.mhMessage && invoice.status !== 'BORRADOR' && <div className="mt-3 text-sm text-slate-800">
      <p>Código {invoice.mhMessageCode || '—'} · {invoice.mhMessage}</p>
      {invoice.mhObservations?.map((line, i) => <p key={i}>{line}</p>)}
    </div>}
  </section>;
}
