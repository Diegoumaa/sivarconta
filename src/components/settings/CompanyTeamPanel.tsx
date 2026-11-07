import React, { useEffect, useState } from 'react';
import { MailPlus, ShieldCheck, UsersRound } from 'lucide-react';
import { loadCompanyTeam, updateCompanyTeam } from '../../services/companyTeam';
import { TEAM_ROLES, type AssignableRole, type CompanyTeam, type TeamCommand, type TeamMember } from '../../types/companyTeam';

const buttonClass = 'min-h-11 rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50';
const selectClass = 'min-h-11 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800';
const primaryClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50';
const expirationFormat = new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeZone: 'America/El_Salvador' });

function roleOptions(roles: AssignableRole[]) {
  return roles.map(role => <option key={role} value={role}>{TEAM_ROLES[role]}</option>);
}

function MemberRow({ member, roles, busy, submit }: {
  member: TeamMember; roles: AssignableRole[]; busy: boolean; submit: (command: TeamCommand) => void;
}) {
  const [role, setRole] = useState<AssignableRole>(member.role === 'owner' ? 'accountant' : member.role);
  const [confirmRemove, setConfirmRemove] = useState(false);
  return <li className="rounded-xl border border-slate-200 px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="break-all text-sm font-semibold text-slate-900">{member.email || 'Cuenta sin correo'}</p>
        <p className="mt-0.5 text-xs text-slate-600">{TEAM_ROLES[member.role]}</p>
      </div>
      {member.editable && <div className="flex flex-wrap items-center gap-1.5">
        <select className={selectClass} aria-label={`Rol de ${member.email}`} value={role} disabled={busy} onChange={event => setRole(event.target.value as AssignableRole)}>{roleOptions(roles)}</select>
        <button type="button" className={buttonClass} disabled={busy || role === member.role} onClick={() => submit({ action: 'role', targetId: member.id, role })}>Guardar rol</button>
        <button type="button" className={buttonClass} disabled={busy || confirmRemove} onClick={() => setConfirmRemove(true)}>Quitar acceso</button>
      </div>}
    </div>
    {confirmRemove && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
      <p>Esta persona dejará de tener acceso a la empresa seleccionada.</p>
      <button type="button" className="min-h-11 px-3 font-bold text-red-800" disabled={busy} onClick={() => {
        setConfirmRemove(false);
        submit({ action: 'remove', targetId: member.id });
      }}>Confirmar retiro</button>
      <button type="button" className={buttonClass} disabled={busy} onClick={() => setConfirmRemove(false)}>Volver</button>
    </div>}
  </li>;
}

function TeamControls({ companyId }: { companyId: string }) {
  const [team, setTeam] = useState<CompanyTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('accountant');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loadCompanyTeam(companyId).then(data => { if (active) setTeam(data); })
      .catch((failure: Error) => { if (active) { setTeam(null); setError(failure.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, reload]);

  const submit = async (command: TeamCommand) => {
    if (busy || loading) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const result = await updateCompanyTeam(companyId, command);
      if (command.action === 'invite') {
        setEmail('');
        setNotice(result.delivery === 'sent' ? 'Invitación enviada.' : 'Se registró la invitación. Revisa el estado del envío antes de reenviarla.');
      } else {
        setNotice(command.action === 'role' ? 'Rol actualizado.' : command.action === 'remove' ? 'Acceso retirado.' : 'Invitación cancelada.');
      }
      try { setTeam(await loadCompanyTeam(companyId)); }
      catch { setTeam(null); setError('El cambio se guardó. Actualiza la lista para ver el estado.'); }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo actualizar el equipo.');
    } finally { setBusy(false); }
  };

  const roles: AssignableRole[] = team?.role === 'owner' ? ['accountant', 'billing', 'admin'] : ['accountant', 'billing'];
  return <div className="mt-4 space-y-4" aria-busy={loading || busy}>
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    {loading && <p role="status" className="text-sm text-slate-600">Cargando equipo…</p>}
    {!team && !loading && <button type="button" className={buttonClass} onClick={() => setReload(value => value + 1)}>Volver a cargar</button>}
    {team && <>
      <form className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4" onSubmit={event => { event.preventDefault(); void submit({ action: 'invite', email, role }); }}>
        <label className="min-w-0 grow text-sm font-semibold text-slate-700">Correo del colaborador
          <input className={`${selectClass} mt-1 block w-full`} type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="contador@empresa.com" disabled={busy} />
        </label>
        <label className="text-sm font-semibold text-slate-700">Rol de la invitación
          <select className={`${selectClass} mt-1 block`} value={role} onChange={event => setRole(event.target.value as AssignableRole)} disabled={busy}>{roleOptions(roles)}</select>
        </label>
        <button type="submit" className={primaryClass} disabled={busy}><MailPlus className="h-4 w-4" />Enviar invitación</button>
      </form>
      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-900">Miembros con acceso</h3>
        <ul className="space-y-2">{team.members.map(member => <MemberRow key={`${member.id}:${member.role}`} member={member} roles={roles} busy={busy} submit={command => void submit(command)} />)}</ul>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-900">Invitaciones pendientes</h3>
        {team.invitations.length ? <ul className="space-y-2">{team.invitations.map(invite => {
          const expired = new Date(invite.expiresAt).getTime() <= Date.now();
          const state = expired ? 'Vencida' : invite.delivery === 'sent' ? 'Enviada' : invite.delivery === 'failed' ? 'Falló el envío' : 'Envío por confirmar';
          return <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <p className="break-all text-sm font-semibold text-slate-900">{invite.email}</p>
              <p className="mt-0.5 text-xs text-slate-600">{TEAM_ROLES[invite.role]} · {state} · Vence el {expirationFormat.format(new Date(invite.expiresAt))}</p>
            </div>
            {invite.editable && <div className="flex flex-wrap gap-1">
              <button type="button" className={buttonClass} disabled={busy} onClick={() => void submit({ action: 'invite', email: invite.email, role: invite.role })}>Reenviar</button>
              <button type="button" className={buttonClass} disabled={busy} onClick={() => void submit({ action: 'cancel', targetId: invite.id })}>Cancelar invitación</button>
            </div>}
          </li>;
        })}</ul> : <p className="text-sm text-slate-600">No hay invitaciones pendientes.</p>}
      </div>
    </>}
  </div>;
}

export function CompanyTeamPanel({ companyId, cloud }: { companyId: string; cloud: boolean }) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded-lg text-base font-bold text-slate-900">
      <UsersRound aria-hidden="true" className="mr-2 inline h-5 w-5 text-brand-600" />Usuarios y permisos
    </summary>
    <p className="mt-2 text-sm text-slate-600">Invita a tu equipo y administra el acceso a esta empresa.</p>
    {open && (cloud ? <TeamControls key={companyId} companyId={companyId} /> :
      <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        <ShieldCheck className="h-4 w-4 shrink-0" />Inicia sesión con una cuenta de empresa para gestionar accesos.
      </p>)}
  </details>;
}
