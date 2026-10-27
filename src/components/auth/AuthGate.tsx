import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, Check, LockKeyhole, Receipt, ShieldCheck, Zap } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type Access = { mode: 'demo' | 'cloud'; userId?: string };
type AuthView = 'login' | 'register' | 'forgot' | 'new-password';

/** The data provider is mounted only after authentication or an explicit demo choice. */
export function AuthGate({ children }: { children: (access: Access) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [demo, setDemo] = useState(false);
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isSupabaseConfigured && !demo && (!session || view === 'new-password')) document.title = 'Acceso · SIVAR FACT';
  }, [demo, session, view]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let alive = true;
    let receivedEvent = false;
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!alive) return;
      receivedEvent = true;
      setSession(nextSession);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setView('new-password');
      if (event === 'SIGNED_OUT') { setView('login'); setPassword(''); }
    });
    supabase.auth.getSession().then(result => {
      if (!alive || receivedEvent) return;
      if (result.error) setError('No se pudo verificar tu sesión. Puedes volver a entrar o explorar la demostración.');
      else setSession(result.data.session);
      setLoading(false);
    }).catch(() => {
      if (!alive || receivedEvent) return;
      setLoading(false);
      setError('El servicio de cuentas no está disponible. Puedes explorar la demostración.');
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  const changeView = (next: AuthView) => { setView(next); setError(''); setMessage(''); setPassword(''); setConfirmation(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !supabase) return;
    setError('');
    setMessage('');
    if ((view === 'new-password' || view === 'register') && (password.length < 8 || password !== confirmation)) {
      setError('Usa al menos 8 caracteres y repite la misma contraseña.');
      return;
    }
    setBusy(true);
    try {
      if (view === 'register') {
        const result = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (result.error) throw result.error;
        setPassword(''); setConfirmation('');
        if (result.data.session) setSession(result.data.session);
        else { setView('login'); setMessage('Revisa tu correo para confirmar la cuenta. Después podrás iniciar sesión y registrar tu empresa.'); }
      } else if (view === 'forgot') {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (result.error) throw result.error;
        setMessage('Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso.');
      } else if (view === 'new-password') {
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw result.error;
        setPassword(''); setConfirmation(''); setView('login');
        setMessage('Contraseña actualizada.');
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        setSession(result.data.session);
        setPassword('');
      }
    } catch (failure) {
      const detail = failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : '';
      setError(/invalid.*credential/i.test(detail)
        ? 'El correo o la contraseña no coinciden.'
        : 'No se pudo completar la solicitud. Revisa tu conexión o inténtalo más tarde.');
    } finally { setBusy(false); }
  };

  if (!isSupabaseConfigured) return <>{children({ mode: 'demo' })}</>;
  if (demo || (session && view !== 'new-password')) {
    const exit = async () => {
      if (busy) return;
      if (demo) { setDemo(false); return; }
      setBusy(true); setError('');
      try {
        const result = await supabase!.auth.signOut();
        if (result.error) throw result.error;
        setSession(null);
      } catch { setError('No se pudo cerrar la sesión. Inténtalo de nuevo.'); }
      finally { setBusy(false); }
    };
    return <>
      <div className="no-print flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 text-xs text-slate-600">
        <span className="hidden sm:inline">{demo ? 'Demostración · datos de ejemplo en este navegador' : 'Sesión iniciada'}</span>
        <button onClick={exit} disabled={busy} className="min-h-11 rounded-lg px-3 font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">{busy ? 'Espera…' : demo ? 'Volver al acceso' : 'Cerrar sesión'}</button>
      </div>
      {error && <p role="alert" className="no-print bg-red-50 p-3 text-center text-sm text-red-800">{error}</p>}
      {children(demo ? { mode: 'demo' } : { mode: 'cloud', userId: session!.user.id })}
    </>;
  }

  return <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8 sm:py-16">
    <div className="mx-auto max-w-5xl"><a href="#/suite" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">← Volver a SIVAR SUITE</a>
      <div className="mb-10 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><Zap className="h-5 w-5 fill-white" /></span><span className="text-xl font-extrabold tracking-tight">SIVAR<span className="text-brand-600">FACT</span></span></div>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <section className="order-2 space-y-6 lg:order-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800"><Receipt className="h-4 w-4" />Tu negocio, en orden</span>
          <h1 className="max-w-lg text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">Facturas claras.<br />Menos trabajo al cerrar el mes.</h1>
          <p className="max-w-md text-base leading-relaxed text-slate-600">Reúne tus clientes, ventas y compras en un solo lugar. Revisa cada documento paso a paso antes de guardarlo.</p>
          <ul className="space-y-3 text-sm text-slate-700">{['Crea un comprobante con un asistente de cuatro pasos.', 'Encuentra tus documentos por cliente, fecha o estado.', 'Consulta tus ventas, compras e IVA del período.'].map(text => <li key={text} className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><span>{text}</span></li>)}</ul>
          <p className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900"><strong>Versión de evaluación.</strong> La emisión real a Hacienda está pendiente. Los documentos nuevos son borradores sin validez fiscal.</p>
        </section>
        <section aria-label="Acceso a tu cuenta" className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:order-2">
          <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><LockKeyhole className="h-5 w-5" /></span>
          <h2 className="text-xl font-bold text-slate-900">{view === 'forgot' ? 'Recupera tu acceso' : view === 'register' ? 'Crea tu cuenta' : view === 'new-password' ? 'Crea una nueva contraseña' : 'Entra a tu cuenta'}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{view === 'forgot' ? 'Te enviaremos un enlace para cambiar tu contraseña.' : view === 'register' ? 'Confirma tu correo y registra tu empresa para empezar.' : view === 'new-password' ? 'Elige una contraseña de al menos 8 caracteres.' : 'Usa el correo de la cuenta registrada para tu empresa.'}</p>
          {loading && <p role="status" className="mt-4 text-sm text-slate-600">Comprobando tu sesión…</p>}
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            {view !== 'new-password' && <label className="block text-sm font-semibold text-slate-700">Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" placeholder="nombre@tuempresa.com" /></label>}
            {view !== 'forgot' && <label className="block text-sm font-semibold text-slate-700">{view === 'new-password' ? 'Nueva contraseña' : 'Contraseña'}<input type="password" autoComplete={view === 'new-password' || view === 'register' ? 'new-password' : 'current-password'} required value={password} onChange={event => setPassword(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label>}
            {(view === 'new-password' || view === 'register') && <label className="block text-sm font-semibold text-slate-700">Repite la contraseña<input type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label>}
            <button disabled={busy || loading} type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50">{busy ? 'Espera…' : view === 'register' ? 'Crear cuenta' : view === 'forgot' ? 'Enviar enlace de recuperación' : view === 'new-password' ? 'Guardar nueva contraseña' : 'Iniciar sesión'}<ArrowRight className="h-4 w-4" /></button>
          </form>
          {view === 'login' ? <div className="mt-2 flex flex-wrap justify-between gap-2"><button onClick={() => changeView('forgot')} className="min-h-11 text-sm font-semibold text-brand-700">¿Olvidaste tu contraseña?</button><button onClick={() => changeView('register')} className="min-h-11 text-sm font-semibold text-brand-700">Crear una cuenta</button></div> : view !== 'new-password' && <button onClick={() => changeView('login')} className="mt-2 min-h-11 text-sm font-semibold text-brand-700">Volver a iniciar sesión</button>}
          {view !== 'new-password' && <div className="mt-5 border-t border-slate-200 pt-5"><p className="mb-3 text-sm text-slate-600">¿Quieres conocer el sistema primero?</p><button onClick={() => { setDemo(true); setError(''); }} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">Explorar demostración</button><p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" />Datos de ejemplo, sin consultar tu empresa.</p></div>}
        </section>
      </div>
    </div>
  </main>;
}
