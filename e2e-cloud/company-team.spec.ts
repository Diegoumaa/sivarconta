import { expect, test, type Page } from '@playwright/test';
import type { CompanyTeam } from '../src/types/companyTeam';

const companyId = 'f0612000-0000-4000-8000-000000000001';
const ownerId = 'f0611000-0000-4000-8000-000000000001';
const memberId = 'f0611000-0000-4000-8000-000000000002';
const inviteId = 'f0611000-0000-4000-8000-000000000003';
const name = 'Comercial Horizonte QA';
const email = 'contador@ejemplo.test';
const baseCompany = { id: companyId, name, nit: '0000-000000-000-0', nrc: '0000', mh_environment: 'PRUEBAS', establishment_code: 'M001', pos_code: 'P001' };
const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

async function cloud(page: Page, userId = ownerId, signedIn = false, hasCompany = true) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: userId, email: userId === ownerId ? 'propietario@ejemplo.test' : email, aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {} };
  const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, exp: expires, aud: 'authenticated' })}.c2lnbmF0dXJl`;
  const session = { access_token: accessToken, refresh_token: 'refresh-fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires, user };
  const changes: Record<string, string>[] = [];
  const joinCalls: boolean[] = [];
  const activationCalls: string[] = [];
  if (signedIn) await page.addInitScript(value => {
    if (!localStorage.getItem('qa-initial-session')) {
      localStorage.setItem('qa-initial-session', '1');
      localStorage.setItem('sb-team-qa-auth-token', JSON.stringify(value));
    }
  }, session);
  await page.route('https://team-qa.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*',
      'access-control-expose-headers': 'Content-Range', 'content-range': '*/0' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/auth/v1/logout')) return route.fulfill({ status: 204, headers });
    let data: unknown = [];
    if (url.pathname.endsWith('/auth/v1/user')) {
      if (method === 'PUT') changes.push(route.request().postDataJSON());
      data = user;
    } else if (url.pathname.endsWith('/auth/v1/verify')) {
      activationCalls.push(route.request().postDataJSON().type);
      data = session;
    } else if (url.pathname.endsWith('/auth/v1/token')) {
      data = session;
    } else if (url.pathname.endsWith('/rest/v1/companies')) {
      if (hasCompany) headers['content-range'] = '0-0/1';
      data = hasCompany ? [baseCompany] : [];
    } else if (url.pathname.endsWith('/rpc/open_company_invitation')) {
      const accept = route.request().postDataJSON().p_accept;
      joinCalls.push(accept);
      data = { companyId, companyName: name, role: 'accountant', accepted: accept };
    }
    return route.fulfill({ json: data, headers });
  });
  return { accessToken, changes, joinCalls, activationCalls };
}

test('owner sends an invitation, edits a role and confirms removal in settings', async ({ page }, info) => {
  await cloud(page, ownerId, true);
  const team: CompanyTeam = { role: 'owner', members: [
    { id: ownerId, email: 'propietario@ejemplo.test', role: 'owner', editable: false },
    { id: memberId, email: 'ventas@ejemplo.test', role: 'billing', editable: true },
  ], invitations: [] };
  await page.route('**/api/company-team**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: team });
    const body = route.request().postDataJSON();
    expect(body.companyId).toBe(companyId);
    if (body.action === 'invite') {
      expect(body.email).toBe(email);
      team.invitations = [{ id: inviteId, email, role: body.role, editable: true, delivery: 'sent', expiresAt: new Date(Date.now() + 86_400_000).toISOString() }];
      return route.fulfill({ status: 201, json: { delivery: 'sent' } });
    }
    if (body.action === 'role') team.members[1].role = body.role;
    if (body.action === 'remove') team.members.pop();
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('/#/configuracion');
  await page.getByText('Usuarios y permisos', { exact: true }).click();
  await page.getByLabel('Correo del colaborador').fill(email);
  await page.getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(page.getByText('Invitación enviada.')).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  const panel = page.locator('details').filter({ hasText: 'Usuarios y permisos' });
  await panel.screenshot({ path: info.outputPath('panel-equipo.png') });
  await page.getByLabel('Rol de ventas@ejemplo.test').selectOption('accountant');
  await page.getByRole('button', { name: 'Guardar rol' }).click();
  await expect(page.getByText('Rol actualizado.')).toBeVisible();
  await page.getByRole('button', { name: 'Quitar acceso' }).click();
  await page.getByRole('button', { name: 'Confirmar retiro' }).click();
  await expect(page.getByText('Acceso retirado.')).toBeVisible();
  await expect(page.getByText('ventas@ejemplo.test', { exact: true })).toHaveCount(0);
});

test('invited account sets its password and explicitly joins the company', async ({ page }, info) => {
  const fixture = await cloud(page, memberId);
  await page.goto(`/#/invitacion?id=${inviteId}&activacion=${'a'.repeat(64)}`);
  await expect(page.getByRole('heading', { name: 'Activa tu cuenta invitada' })).toBeVisible();
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('ExampleQA1234');
  await page.getByLabel('Repite la contraseña').fill('ExampleQA1234');
  await page.getByRole('button', { name: 'Activar cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Invitación a una empresa' })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  expect(fixture.activationCalls).toEqual(['invite']);
  expect(fixture.joinCalls).toContain(false);
  expect(fixture.joinCalls).not.toContain(true);
  await page.locator('main section').screenshot({ path: info.outputPath('aceptar-invitacion.png') });
  await page.getByRole('button', { name: 'Aceptar invitación' }).click();
  await expect(page).toHaveURL(/#\/inicio$/);
  expect(fixture.joinCalls.filter(Boolean)).toEqual([true]);
});

test('existing account keeps its password when accepting a company invitation', async ({ page }) => {
  const fixture = await cloud(page, memberId, true);
  await page.goto(`/#/invitacion?id=${inviteId}`);
  await page.getByRole('button', { name: 'Aceptar invitación' }).click();
  await expect(page).toHaveURL(/#\/inicio$/);
  expect(fixture.activationCalls).toEqual([]);
  expect(fixture.changes).toEqual([]);
});

test('recovery goes to a password form and returns to signed-out login', async ({ page }, info) => {
  const fixture = await cloud(page, memberId);
  await page.goto(`/#access_token=${fixture.accessToken}&refresh_token=refresh-fixture&type=recovery`);
  await expect(page).toHaveURL(/#\/recuperar$/);
  await expect(page.getByRole('heading', { name: 'Crea una nueva contraseña' })).toBeVisible();
  await expect(page.getByText('Sesión iniciada')).toHaveCount(0);
  await page.locator('main section').screenshot({ path: info.outputPath('recuperar-contrasena.png') });
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('ExampleQA1234');
  await page.getByLabel('Repite la contraseña').fill('ExampleQA1234');
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(page.getByRole('heading', { name: 'Contraseña actualizada' })).toBeVisible();
  await page.getByRole('link', { name: 'Ir a iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Entra a tu cuenta' })).toBeVisible();
  expect(fixture.changes).toMatchObject([{ password: 'ExampleQA1234' }]);
});

test('settings asks for the current password before changing it', async ({ page }, info) => {
  const fixture = await cloud(page, ownerId, true);
  await page.goto('/#/configuracion');
  await page.getByText('Cambiar contraseña', { exact: true }).click();
  await page.locator('details').filter({ hasText: 'Cambiar contraseña' }).screenshot({ path: info.outputPath('cambiar-contrasena.png') });
  await page.getByLabel('Contraseña actual', { exact: true }).fill('CurrentQA1234');
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('ExampleQA1234');
  await page.getByLabel('Repite la contraseña').fill('ExampleQA1234');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByText('Contraseña actualizada.')).toBeVisible();
  expect(fixture.changes).toMatchObject([{ password: 'ExampleQA1234', current_password: 'CurrentQA1234' }]);
});

test('an account awaiting company access can still change its password', async ({ page }) => {
  await cloud(page, memberId, true, false);
  await page.goto('/#/configuracion');
  await page.getByText('Cambiar contraseña', { exact: true }).click();
  await expect(page.getByLabel('Contraseña actual', { exact: true })).toBeVisible();
  await expect(page.getByText('Usuarios y permisos', { exact: true })).toHaveCount(0);
});
