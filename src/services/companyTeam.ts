import { supabase } from '../lib/supabase';
import { TEAM_ENDPOINT, type CompanyTeam, type OpenInvitation, type TeamCommand } from '../types/companyTeam';

async function teamRequest<Result>(companyId: string, command?: TeamCommand): Promise<Result> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('Inicia sesión para administrar el equipo.');
  const response = await fetch(command ? TEAM_ENDPOINT : `${TEAM_ENDPOINT}?companyId=${encodeURIComponent(companyId)}`, {
    method: command ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(command ? { 'Content-Type': 'application/json' } : {}) },
    body: command ? JSON.stringify({ companyId, ...command }) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'No pudimos consultar el equipo. Inténtalo nuevamente.');
  return data;
}

export const loadCompanyTeam = (companyId: string) => teamRequest<CompanyTeam>(companyId);
export const updateCompanyTeam = (companyId: string, command: TeamCommand) =>
  teamRequest<{ delivery?: 'sent' | 'failed' | 'unconfirmed' }>(companyId, command);

export async function openCompanyInvitation(id: string, accept = false): Promise<OpenInvitation> {
  if (!supabase) throw new Error('El acceso a la cuenta no está disponible.');
  const { data, error } = await supabase.rpc('open_company_invitation', { p_invitation: id, p_accept: accept });
  if (!error && data) return data;
  if (error?.code === '42501') throw new Error('Abre la invitación con la cuenta que recibió el correo.');
  if (error?.code === '22023') throw new Error('La invitación venció o fue cancelada. Pide al administrador que te envíe una nueva.');
  throw new Error('No pudimos abrir la invitación. Inténtalo nuevamente.');
}
