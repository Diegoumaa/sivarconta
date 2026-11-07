import { describe, expect, it, vi } from 'vitest';
import { handleCompanyTeam, sendTeamInvitation, type TeamDependencies } from '../../server/companyTeam';

const companyId = 'f0612000-0000-4000-8000-000000000001';
const actorId = 'f0611000-0000-4000-8000-000000000001';
const invitationId = 'f0611000-0000-4000-8000-000000000002';
const command = { action: 'invite', email: 'staff@example.test', role: 'accountant' } as const;
const reservation = { id: invitationId, companyName: 'Empresa de prueba', needsActivation: true };

function deps() {
  return {
    available: true,
    authenticate: vi.fn<TeamDependencies['authenticate']>().mockResolvedValue(actorId),
    list: vi.fn<TeamDependencies['list']>().mockResolvedValue({ role: 'owner', members: [], invitations: [] }),
    reserve: vi.fn<TeamDependencies['reserve']>().mockResolvedValue(reservation),
    change: vi.fn<TeamDependencies['change']>().mockResolvedValue(undefined),
    send: vi.fn<TeamDependencies['send']>().mockResolvedValue('sent'),
    finish: vi.fn<TeamDependencies['finish']>().mockResolvedValue(undefined),
  };
}

function post(body: unknown, token = 'fake.session.jwt') {
  return new Request('https://sivarconta.vercel.app/api/company-team', {
    method: 'POST', body: JSON.stringify(body), headers: { Authorization: `Bearer ${token}` },
  });
}

describe('Team management request boundaries', () => {
  it('requires a valid session before reading or changing memberships', async () => {
    const mock = deps();
    mock.authenticate.mockResolvedValue(null);
    expect((await handleCompanyTeam(post({ companyId, ...command }), mock)).status).toBe(401);
    expect(mock.reserve).not.toHaveBeenCalled();
  });

  it('binds the manager to the authenticated actor and emails the normalized recipient after reservation', async () => {
    const mock = deps();
    const response = await handleCompanyTeam(post({ companyId, actorId: 'spoof', ...command, email: ' Staff@Example.Test ' }), mock);
    expect(response.status).toBe(201);
    expect(mock.reserve).toHaveBeenCalledWith(companyId, actorId, command);
    expect(mock.send).toHaveBeenCalledWith(reservation, command);
    expect(mock.finish).toHaveBeenCalledWith(invitationId, 'sent');
    expect(await response.json()).toEqual({ delivery: 'sent' });
  });

  it('rejects an owner grant and does not contact the mail provider when the database denies access', async () => {
    const mock = deps();
    expect((await handleCompanyTeam(post({ companyId, ...command, role: 'owner' }), mock)).status).toBe(400);
    expect(mock.reserve).not.toHaveBeenCalled();
    mock.reserve.mockRejectedValue({ code: '42501' });
    expect((await handleCompanyTeam(post({ companyId, ...command }), mock)).status).toBe(403);
    expect(mock.send).not.toHaveBeenCalled();
  });

  it('preserves the invitation for review after an uncertain provider response', async () => {
    const mock = deps();
    mock.send.mockRejectedValue(new Error('timeout'));
    const response = await handleCompanyTeam(post({ companyId, ...command }), mock);
    expect(response.status).toBe(202);
    expect(mock.finish).toHaveBeenCalledWith(invitationId, 'unconfirmed');
    expect(await response.json()).toEqual({ delivery: 'unconfirmed' });
  });

  it('uses company-scoped removal without creating an invitation', async () => {
    const mock = deps();
    const action = { action: 'remove', targetId: invitationId };
    expect((await handleCompanyTeam(post({ companyId, ...action }), mock)).status).toBe(200);
    expect(mock.change).toHaveBeenCalledWith(companyId, actorId, action);
    expect(mock.send).not.toHaveBeenCalled();
  });

  it('puts activation material in the fragment of the email link and supports a provider sandbox', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 201 }));
    await expect(sendTeamInvitation(
      { apiKey: 'fixture', senderEmail: 'sender@example.test', senderName: 'SIVAR FACT', origin: 'https://sivarconta.vercel.app' },
      reservation, command, 'fake-activation-token', request, true,
    )).resolves.toBe('sent');
    const payload = JSON.parse(String(request.mock.calls[0][1]?.body));
    const link = new URL(payload.textContent.match(/https:\/\/[^\s]+/)[0]);
    expect(link.origin).toBe('https://sivarconta.vercel.app');
    expect(link.search).toBe('');
    expect(link.hash).toBe(`#/invitacion?id=${invitationId}&activacion=fake-activation-token`);
    expect(payload.to).toEqual([{ email: command.email }]);
    expect(payload.headers).toEqual({ idempotencyKey: invitationId, 'X-Sib-Sandbox': 'drop' });
  });
});
