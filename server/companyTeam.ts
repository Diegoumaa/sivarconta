import { isAssignableRole, isTeamId, TEAM_ROLES, type CompanyTeam, type TeamCommand } from '../src/types/companyTeam.js';
import { isRecipientEmail } from '../src/types/invoiceEmail.js';

export type InviteDelivery = 'sent' | 'failed' | 'unconfirmed';
export interface InviteReservation { id: string; companyName: string; needsActivation: boolean }
export interface TeamDependencies {
  available: boolean;
  authenticate: (token: string) => Promise<string | null>;
  list: (company: string, actor: string) => Promise<CompanyTeam>;
  reserve: (company: string, actor: string, command: Extract<TeamCommand, { action: 'invite' }>) => Promise<InviteReservation>;
  change: (company: string, actor: string, command: Exclude<TeamCommand, { action: 'invite' }>) => Promise<void>;
  send: (reservation: InviteReservation, command: Extract<TeamCommand, { action: 'invite' }>) => Promise<InviteDelivery>;
  finish: (id: string, delivery: InviteDelivery) => Promise<void>;
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function parseCommand(input: Record<string, unknown>): TeamCommand | null {
  const { action, role, targetId } = input;
  if (action === 'invite' && typeof input.email === 'string' && isAssignableRole(role)) {
    const email = input.email.trim().toLowerCase();
    return isRecipientEmail(email) ? { action, email, role } : null;
  }
  if (!isTeamId(targetId)) return null;
  if (action === 'role' && isAssignableRole(role)) return { action, targetId, role };
  return action === 'cancel' || action === 'remove' ? { action, targetId } : null;
}

export async function handleCompanyTeam(request: Request, deps: TeamDependencies) {
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Método no admitido.' }, 405);
  const token = request.headers.get('authorization')?.match(/^Bearer ([\w.-]+)$/i)?.[1];
  if (!token) return json({ error: 'Inicia sesión para administrar el equipo.' }, 401);
  if (!deps.available) return json({ error: 'La administración de usuarios aún no está configurada.' }, 503);
  try {
    const actor = await deps.authenticate(token);
    if (!actor) return json({ error: 'Tu sesión venció. Vuelve a iniciar sesión.' }, 401);
    if (request.method === 'GET') {
      const company = new URL(request.url).searchParams.get('companyId');
      return isTeamId(company) ? json(await deps.list(company, actor)) : json({ error: 'Selecciona una empresa válida.' }, 400);
    }
    const raw = await request.text();
    if (raw.length > 1500) return json({ error: 'La solicitud supera el tamaño admitido.' }, 413);
    const input = JSON.parse(raw) as Record<string, unknown> | null;
    const command = input && parseCommand(input);
    if (!command || !isTeamId(input?.companyId)) return json({ error: 'Revisa el correo, la empresa y el rol.' }, 400);
    if (command.action !== 'invite') {
      await deps.change(input.companyId, actor, command);
      return json({ ok: true });
    }
    const invitation = await deps.reserve(input.companyId, actor, command);
    let delivery: InviteDelivery;
    try { delivery = await deps.send(invitation, command); } catch { delivery = 'unconfirmed'; }
    try { await deps.finish(invitation.id, delivery); } catch { return json({ delivery: 'unconfirmed' }, 202); }
    return json({ delivery }, delivery === 'sent' ? 201 : 202);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'La solicitud no es válida.' }, 400);
    const detail = error as { code?: string; message?: string } | null;
    if (detail?.code === '42501') return json({ error: 'No tienes permisos para gestionar ese acceso.' }, 403);
    if (detail?.message === 'team_already_member') return json({ error: 'Este correo ya pertenece al equipo. Cambia su rol en la lista de miembros.' }, 409);
    if (detail?.message === 'team_rate_limited') return json({ error: 'Alcanzaste el límite de invitaciones. Espera antes de volver a enviar.' }, 429);
    return json({ error: 'No pudimos completar la solicitud. Revisa el equipo antes de reintentar.' }, 503);
  }
}

export async function sendTeamInvitation(
  config: { apiKey: string; senderEmail: string; senderName: string; origin: string },
  reservation: InviteReservation,
  command: Extract<TeamCommand, { action: 'invite' }>,
  activationToken: string | undefined,
  request: typeof fetch = fetch,
  sandbox = false,
): Promise<InviteDelivery> {
  const params = new URLSearchParams({ id: reservation.id });
  if (activationToken) params.set('activacion', activationToken);
  const link = new URL('/', config.origin);
  link.hash = '/invitacion?' + params.toString();
  const response = await request('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { 'api-key': config.apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: config.senderEmail, name: config.senderName },
      to: [{ email: command.email }],
      subject: 'Invitación a tu empresa en SIVAR FACT',
      textContent: `${reservation.companyName} te invita a su equipo con el rol de ${TEAM_ROLES[command.role]}.\n\nAbre el enlace para revisar y aceptar la invitación:\n${link.href}\n\nLa invitación vence en 3 días. Si el enlace de activación venció, pide al administrador que te envíe uno nuevo.`,
      headers: { idempotencyKey: reservation.id, ...(sandbox ? { 'X-Sib-Sandbox': 'drop' } : {}) },
    }),
  });
  if (response.ok) return 'sent';
  return response.status >= 500 || response.status === 408 ? 'unconfirmed' : 'failed';
}
