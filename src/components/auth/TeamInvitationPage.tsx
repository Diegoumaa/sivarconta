import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { openCompanyInvitation } from '../../services/companyTeam';
import { isTeamId, TEAM_ROLES, type OpenInvitation } from '../../types/companyTeam';
import { AuthGate } from './AuthGate';

function InvitationReview({ id, userId }: { id: string; userId: string }) {
  const [invitation, setInvitation] = useState<OpenInvitation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    openCompanyInvitation(id).then(result => { if (current) setInvitation(result); })
      .catch((failure: Error) => { if (current) setError(failure.message); });
    return () => { current = false; };
  }, [id]);

  async function join() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await openCompanyInvitation(id, true);
      try { sessionStorage.setItem(`sivarconta_active_company:${userId}`, result.companyId); } catch { /* Storage is optional. */ }
      window.location.replace('#/inicio');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo aceptar la invitación.');
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-12 sm:py-20">
    <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <Building2 aria-hidden="true" className="mb-5 h-9 w-9 rounded-xl bg-brand-50 p-2 text-brand-700" />
      <h1 className="text-2xl font-extrabold text-slate-900">Invitación a una empresa</h1>
      {error && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      {!invitation && !error && <p role="status" className="mt-4 text-sm text-slate-600">Comprobando la invitación…</p>}
      {invitation && <>
        <p className="mt-4 break-words text-sm text-slate-700">Empresa <strong>{invitation.companyName}</strong></p>
        <p className="mt-1 text-sm text-slate-700">Rol asignado <strong>{TEAM_ROLES[invitation.role]}</strong></p>
        <button type="button" disabled={busy} onClick={() => void join()} className="mt-6 min-h-12 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white disabled:opacity-50">
          {busy ? 'Espera…' : invitation.accepted ? 'Entrar a la empresa' : 'Aceptar invitación'}
        </button>
      </>}
      <a href="#/inicio" className="ml-0 mt-3 flex min-h-11 items-center text-sm font-semibold text-brand-700 sm:ml-4 sm:inline-flex">Volver a SIVAR FACT</a>
    </section>
  </main>;
}

export default function TeamInvitationPage({ search }: { search: string }) {
  const params = new URLSearchParams(search);
  const id = params.get('id');
  const rawToken = params.get('activacion');
  const activationToken = rawToken && /^[\w-]{32,128}$/.test(rawToken) ? rawToken : undefined;
  if (!isTeamId(id)) return <main className="mx-auto max-w-xl p-8">
    <h1 className="text-xl font-bold">La invitación no es válida</h1>
    <a href="#/inicio" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand-700">Volver a SIVAR FACT</a>
  </main>;
  return <AuthGate key={id} invitation={{
    activationToken,
    onActivated: () => window.history.replaceState(null, '', `#/invitacion?id=${id}`),
  }}>{access => access.userId ? <InvitationReview key={access.userId} id={id} userId={access.userId} /> :
    <p role="alert" className="mx-auto max-w-xl p-8">Para aceptar una invitación necesitas entrar a la versión en la nube de SIVAR FACT.</p>
  }</AuthGate>;
}
