import { test, expect } from '@playwright/test';
import { INITIAL_INVOICES } from '../src/data/mockData';

test('reviews a filtered lot for two customers and simulates it without sending emails', async ({ page }) => {
  const source = INITIAL_INVOICES[0];
  const invoices = [
    { ...source, clientName: 'Cliente Uno E2E', clientEmail: 'uno@example.invalid', mhReceptionStamp: 'A'.repeat(40) },
    { ...source, id: 'email-fixture-2', controlNumber: 'DTE-03-M001P001-000000000000902',
      clientName: 'Cliente Dos E2E', clientEmail: 'dos@example.invalid', mhReceptionStamp: 'B'.repeat(40) },
    { ...source, id: 'email-fixture-draft', controlNumber: 'DTE-03-M001P001-000000000000903',
      clientName: 'Borrador E2E', clientEmail: 'draft@example.invalid', status: 'BORRADOR', mhReceptionStamp: '' },
  ];
  await page.addInitScript(data => {
    localStorage.setItem('sivarconta_invoices', JSON.stringify(data));
    localStorage.setItem('sivarconta_demo_v2_invoices', JSON.stringify(data));
  }, invoices);
  let sendRequests = 0;
  await page.route('**/api/invoice-email', async route => {
    if (route.request().method() === 'POST') sendRequests++;
    await route.fulfill({ json: { available: false } });
  });
  await page.goto('/#/facturas');
  await page.getByRole('button', { name: 'Enviar por correo', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Envío por correo', exact: true });
  await expect(panel.getByText(/El envío se simula/)).toBeVisible();
  await expect(panel.getByRole('checkbox')).toHaveCount(2);
  await expect(panel.getByText(/draft@example.invalid/)).toHaveCount(0);

  const search = page.getByRole('textbox', { name: 'Buscar facturas por cliente, número o fecha' });
  await search.fill('Cliente Uno E2E');
  await panel.getByRole('button', { name: 'Seleccionar elegibles', exact: true }).click();
  await panel.getByRole('button', { name: 'Revisar lote', exact: true }).click();
  await expect(panel.getByText(/uno@example.invalid/)).toBeVisible();
  await expect(panel.getByText(/dos@example.invalid/)).toHaveCount(0);
  await panel.getByRole('button', { name: 'Volver a la selección', exact: true }).click();
  await search.clear();
  await panel.getByRole('button', { name: 'Seleccionar elegibles', exact: true }).click();
  await panel.getByRole('button', { name: 'Revisar lote', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Revisa los destinatarios' })).toBeVisible();
  await expect(panel.getByText(/uno@example.invalid/)).toBeVisible();
  await expect(panel.getByText(/dos@example.invalid/)).toBeVisible();
  await panel.getByRole('button', { name: 'Simular envío', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Resultado del lote' })).toBeVisible();
  await expect(panel.getByText('Envío simulado', { exact: true })).toHaveCount(2);
  expect(sendRequests).toBe(0);
});
