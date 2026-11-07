import React, { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function AccountPasswordPanel() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const field = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !supabase) return;
    setSaved(false);
    setError('');
    if (next.length < 8 || next !== confirm || next === current) {
      setError('Usa una contraseña nueva de al menos 8 caracteres y repítela para confirmar.');
      return;
    }
    setBusy(true);
    try {
      const { error: failure } = await supabase.auth.updateUser({ password: next, current_password: current });
      if (failure) throw failure;
      setCurrent(''); setNext(''); setConfirm(''); setSaved(true);
    } catch (failure) {
      const code = (failure as { code?: string } | null)?.code;
      const detail = (failure as { message?: string } | null)?.message || '';
      setError(code === 'reauthentication_needed' ? 'Vuelve a iniciar sesión e intenta cambiarla nuevamente.' :
        code === 'weak_password' ? 'La contraseña nueva no cumple los requisitos de seguridad.' :
        code === 'invalid_credentials' || /current password/i.test(detail) ? 'La contraseña actual no coincide.' :
        'No pudimos cambiar la contraseña. Inténtalo nuevamente.');
    } finally { setBusy(false); }
  }

  return <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <summary className="cursor-pointer text-base font-bold text-slate-900"><LockKeyhole aria-hidden="true" className="mr-2 inline h-5 w-5 text-brand-600" />Cambiar contraseña</summary>
    <form className="mt-4 max-w-md space-y-3" onSubmit={submit}>
      <p className="text-sm text-slate-600">Confirma tu contraseña actual para cambiar la de tu cuenta.</p>
      {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      {saved && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Contraseña actualizada.</p>}
      <label className="block text-sm font-semibold text-slate-700">Contraseña actual<input className={field} required type="password" autoComplete="current-password" value={current} onChange={event => setCurrent(event.target.value)} /></label>
      <label className="block text-sm font-semibold text-slate-700">Nueva contraseña<input className={field} required type="password" autoComplete="new-password" value={next} onChange={event => setNext(event.target.value)} /></label>
      <label className="block text-sm font-semibold text-slate-700">Repite la contraseña<input className={field} required type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
      <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
    </form>
  </details>;
}
