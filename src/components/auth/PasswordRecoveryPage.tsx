import React, { useRef, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { createIsolatedAuthClient, supabase } from '../../lib/supabase';
import { hasRecoveryCredentials, takeRecoveryCredentials } from '../../utils/authRecovery';

export default function PasswordRecoveryPage() {
  const recoveryClient = useRef<ReturnType<typeof createIsolatedAuthClient> | null>(null);
  const [linkValid, setLinkValid] = useState(hasRecoveryCredentials);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const reset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !supabase) return;
    setError('');
    if (password.length < 8 || password !== confirm) {
      setError('Usa al menos 8 caracteres y repite la misma contraseña.');
      return;
    }
    setBusy(true);
    try {
      if (!recoveryClient.current) {
        const previous = (await supabase.auth.getSession()).data.session;
        if (previous) {
          const closed = await supabase.auth.signOut({ scope: 'local' });
          if (closed.error) throw closed.error;
        }
        const credentials = takeRecoveryCredentials();
        if (!credentials) { setLinkValid(false); return; }
        const client = createIsolatedAuthClient();
        const result = await client.auth.setSession(credentials);
        if (result.error || !result.data.session) { setLinkValid(false); return; }
        recoveryClient.current = client;
      }
      const updated = await recoveryClient.current.auth.updateUser({ password });
      if (updated.error) throw updated.error;
      // Even if the network drops here, the recovery session was never stored.
      await recoveryClient.current.auth.signOut().catch(() => undefined);
      recoveryClient.current = null;
      setPassword(''); setConfirm(''); setDone(true);
    } catch (failure) {
      const code = (failure as { code?: string } | null)?.code;
      setError(code === 'same_password' ? 'Elige una contraseña diferente a la anterior.' :
        'No se pudo guardar la contraseña. Inténtalo nuevamente.');
    } finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-12 sm:py-20">
    <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <LockKeyhole aria-hidden="true" className="mb-4 h-9 w-9 rounded-xl bg-brand-50 p-2 text-brand-700" />
      <h1 className="text-2xl font-extrabold text-slate-900">{done ? 'Contraseña actualizada' : 'Crea una nueva contraseña'}</h1>
      {done ? <p className="mt-3 text-sm text-slate-600">Entra con tu correo y tu nueva contraseña.</p> :
        !linkValid || !supabase ? <p role="alert" className="mt-3 text-sm text-amber-900">Abre el enlace de recuperación desde tu correo o solicita uno nuevo.</p> :
          <form className="mt-5 space-y-4" onSubmit={reset}>
            <p className="text-sm text-slate-600">Guarda una contraseña nueva para recuperar el acceso a tu cuenta.</p>
            {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
            <label className="block text-sm font-semibold">Nueva contraseña
              <input className="mt-1 block w-full rounded-lg border border-slate-300 p-3" required type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold">Repite la contraseña
              <input className="mt-1 block w-full rounded-lg border border-slate-300 p-3" required type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} />
            </label>
            <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
          </form>}
      {(done || !linkValid || !supabase) && <a href="#/inicio" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand-700">Ir a iniciar sesión</a>}
    </section>
  </main>;
}
