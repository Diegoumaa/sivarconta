// Browser integration with synthetic auth/API responses. Not evidence of MH acceptance.
import { test, expect, type Page } from '@playwright/test';
import { mapInvoices } from '../src/services/companyRepository';

const cid = 'e2111111-1111-4111-8111-111111111111', iid = 'e2222222-2222-4222-8222-222222222222';
const uuid = 'E3333333-3333-4333-8333-333333333333';
const user = { id: 'e4444444-4444-4444-8444-444444444444', email: 'qa@example.invalid', role: 'authenticated', aud: 'authenticated' };
const session = { access_token: `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: 4102444800 })).toString('base64url')}.firmaFicticia`,
  refresh_token: 'refresh-ficticio', token_type: 'bearer', expires_at: 4102444800, expires_in: 9999999, user };

async function cloud(page: Page) {
  let row: Record<string, any> = { id: iid, company_id: cid, dte_type: '01', status: 'BORRADOR', generation_code: uuid.toLowerCase(),
    control_number: 'DTE-01-M001P001-000000000000003', emission_date: '2026-11-11', emission_time: '09:00:00',
    establishment_code: 'M001', pos_code: 'P001', client_name: 'CONSUMIDOR FINAL FICTICIO', client_doc_type: 'OTRO', client_doc_number: '',
    subtotal_gravado: 1.13, subtotal_exento: 0, subtotal_no_sujeto: 0, iva13: .13, total_pagar: 1.13,
    total_letras: 'UN DOLAR CON 13/100 USD', condition: 'CONTADO', payment_method: '01',
    invoice_items: [{ id: 'line', num_item: 1, description: 'Servicio ficticio E2E', code: 'QA', quantity: 1, unit_price: 1.13,
      discount: 0, tax_type: 'GRAVADO', unit_of_measure: '99', total: 1.13, tax_amount: .13 }] };
  await page.addInitScript(value => localStorage.setItem('sb-sivar-fact-e2e-auth-token', JSON.stringify(value)), session);
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://sivar-fact-e2e.supabase.co/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
    const rows = url.pathname.includes('/rest/v1/companies') ? [{ id: cid, name: 'EMISOR FICTICIO E2E', nit: '00000000000000', nrc: '1234567',
      mh_environment: 'PRUEBAS', establishment_code: 'M001', pos_code: 'P001', economic_activity_code: '62010', economic_activity_desc: 'Programación',
      email: 'qa@example.invalid', phone: '00000000', address: 'Dirección ficticia' }]
      : url.pathname.includes('/rest/v1/invoices') ? [row] : [];
    return route.fulfill({ json: rows, headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } });
  });
  await page.goto('/#/facturas');
  await expect(page.getByRole('heading', { name: 'Facturas y documentos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Vista previa del documento', exact: true });
  return { dialog, update: (changes: Record<string, unknown>) => { row = { ...row, ...changes }; return mapInvoices([row])[0]; } };
}

test('transmission UI prevents double clicks and keeps confirmed test seal, UUID, QR and PDF controls after reload', async ({ page }, info) => {
  const { dialog, update } = await cloud(page); let calls = 0;
  await page.route('**/api/mh-test-emission', async route => {
    calls++; const body = route.request().postDataJSON();
    expect(body).toEqual({ companyId: cid, invoiceId: iid, action: calls === 1 ? 'transmitir' : 'consultar' });
    await new Promise(resolve => setTimeout(resolve, 400));
    const invoice = update({ status: 'PROCESADO', mh_environment: '00', mh_emission_state: 'PROCESADO',
      mh_reception_stamp: 'E'.repeat(40), mh_processed_at: '11/11/2026 09:00:01', mh_message_code: '001',
      mh_response_json: { ambienteReportado: '00', estado: 'PROCESADO', descripcionMsg: 'RECIBIDO', codigoMsg: '001' } });
    await route.fulfill({ json: { invoice, confirmed: true } });
  });
  await dialog.getByRole('button', { name: 'Transmitir a Hacienda (pruebas)', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Verificando con Hacienda…' })).toBeDisabled();
  await expect(dialog.getByText('PROCESADO en ambiente 00. Sello confirmado por consulta a Hacienda.', { exact: true })).toBeVisible();
  expect(calls).toBe(1);
  await expect(dialog.getByText('E'.repeat(40), { exact: true })).toBeVisible();
  await expect(dialog.getByText(uuid, { exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Consultar este documento en Hacienda' })).toHaveAttribute('href', /ambiente=00.*codGen=E3333333/);
  const action = dialog.getByRole('button', { name: 'Consultar estado en Hacienda', exact: true });
  const box = await action.boundingBox(); expect(box!.x + box!.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
  await dialog.screenshot({ path: info.outputPath('interfaz-simulada-aceptacion.png') });
  await page.reload(); await page.getByRole('button', { name: 'Ver', exact: true }).click();
  await expect(dialog.getByText('E'.repeat(40), { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Consultar estado en Hacienda', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Consultar estado en Hacienda', exact: true })).toBeEnabled();
  expect(calls).toBe(2);
});

test('an uncertain backend result changes the action to query instead of sending again', async ({ page }) => {
  const { dialog, update } = await cloud(page);
  await page.route('**/api/mh-test-emission', route => route.fulfill({ status: 503, json: {
    invoice: update({ status: 'TRANSMITIDO', mh_environment: '00', mh_emission_state: 'ENVIO_INCIERTO' }),
    error: 'No se pudo confirmar la operación. Consulta el estado del mismo documento.',
  } }));
  await dialog.getByRole('button', { name: 'Transmitir a Hacienda (pruebas)' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Consulta el estado');
  await expect(dialog.getByRole('button', { name: 'Transmitir a Hacienda (pruebas)' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Consultar estado en Hacienda' })).toBeVisible();
});

test('a rejected invoice displays its code and observations and never a success message', async ({ page }) => {
  const { dialog, update } = await cloud(page);
  await page.route('**/api/mh-test-emission', route => route.fulfill({ json: {
    invoice: update({ status: 'RECHAZADO', mh_environment: '00', mh_emission_state: 'RECHAZADO',
      mh_response_json: { codigoMsg: '098', descripcionMsg: 'DATOS INVALIDOS', observaciones: ['Revise el receptor'] } }), confirmed: false,
  } }));
  await dialog.getByRole('button', { name: 'Transmitir a Hacienda (pruebas)' }).click();
  await expect(dialog.getByText('Código 098 · DATOS INVALIDOS', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Revise el receptor', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Sello confirmado por consulta/)).toHaveCount(0);
});
