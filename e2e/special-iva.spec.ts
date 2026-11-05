import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const specialSummary = 'Casillas especiales F-07 · Retenciones y percepciones';

test('purchase perception persists, prefills the annex and is counted once', async ({ page }, info) => {
  await page.goto('/#/compras');
  await page.getByRole('button', { name: 'Registrar Compra', exact: true }).click();
  await page.getByLabel('Nombre del Proveedor', { exact: true }).fill('Proveedor percepción E2E');
  await page.getByLabel('Documento del proveedor', { exact: true }).selectOption('DUI');
  await page.getByLabel('DUI Proveedor', { exact: true }).fill('00000000-0');
  await page.getByLabel('Número de Documento', { exact: true }).fill('00027');
  await page.getByLabel('Concepto del Gasto', { exact: true }).fill('Mercadería para reventa');
  await page.getByLabel('Serie de la compra', { exact: true }).fill('E2E-A8');
  await page.getByLabel('Fecha de compra', { exact: true }).fill('2026-11-04');
  await page.getByLabel('Monto Gravado ($)', { exact: true }).fill('1500');
  await page.getByLabel(/El proveedor aplicó percepción IVA/).check();
  await page.getByLabel(/Base de bienes sujeta a percepción/).fill('1000');
  await expect(page.getByText('$1705.00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar Compra', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Proveedor percepción E2E', { exact: true })).toBeVisible();

  await page.goto('/#/libros-iva');
  await page.getByLabel('Período', { exact: true }).fill('2026-11');
  await page.getByText(specialSummary, { exact: true }).click();
  await page.getByLabel('Anexo de casilla especial', { exact: true }).selectOption('163');
  await page.getByRole('button', { name: 'Registrar comprobante de anexo', exact: true }).click();
  await page.getByLabel('Preparar desde documento existente', { exact: true }).selectOption({ label: '00027 · Proveedor percepción E2E' });
  await expect(page.getByLabel('Serie autorizada', { exact: true })).toHaveValue('E2E-A8');
  await expect(page.getByLabel('Base sujeta sin IVA', { exact: true })).toHaveValue('1000.00');
  await page.getByRole('button', { name: 'Guardar comprobante de anexo', exact: true }).click();
  await expect(page.getByText(/1 comprobante\(s\) · 2026-11/)).toBeVisible();
  await expect(page.getByText(/Percepción 1 % \(163\):/).locator('strong').nth(2)).toHaveText('$10.00');

  await page.reload();
  await page.getByLabel('Período', { exact: true }).fill('2026-11');
  await page.getByText(specialSummary, { exact: true }).click();
  await page.getByLabel('Anexo de casilla especial', { exact: true }).selectOption('163');
  await expect(page.getByText('2026-11-04 · Proveedor percepción E2E · 00027 · IVA $10.00', { exact: true })).toBeVisible();
  await page.getByLabel('Revisé los comprobantes, sus vínculos y el período antes de exportar.', { exact: true }).check();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar CSV de casilla especial', exact: true }).click();
  const download = await pending;
  const filename = 'F07_A8_202611.csv';
  expect(download.suggestedFilename()).toBe(filename);
  const path = info.outputPath(filename);
  await download.saveAs(path);
  expect(await readFile(path,'utf8')).toBe(';04/11/2026;03;E2E-A8;00027;1000.00;10.00;000000000;8\r\n');
});

test('a received electronic retention requires valid amounts and exports the real document fields', async ({ page }, info) => {
  await page.goto('/#/libros-iva');
  await page.getByLabel('Período', { exact: true }).fill('2026-11');
  await page.getByText(specialSummary, { exact: true }).click();
  await page.getByRole('button', { name: 'Registrar comprobante de anexo', exact: true }).click();
  const form = page.getByRole('form', { name: 'Comprobante de anexo F-07' });
  await form.getByLabel('Clase del documento del anexo', { exact: true }).selectOption('4');
  await form.getByLabel('Número de identificación', { exact: true }).fill('0001-000001-000-0');
  await form.getByLabel('Sello de recepción real (40 caracteres)', { exact: true }).fill('A'.repeat(40));
  await form.getByLabel('Número de control real', { exact: true }).fill('DTE-07-M001P001-000000000000007');
  await form.getByLabel('Código de generación real', { exact: true }).fill('12345678-1234-4234-8234-123456789ABC');
  await form.getByLabel('Base sujeta sin IVA', { exact: true }).fill('1000');
  const tax = form.getByLabel('Importe IVA 1 % del comprobante', { exact: true });
  await tax.fill('13');
  await form.getByRole('button', { name: 'Guardar comprobante de anexo', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1 % de la base sujeta');
  await tax.fill('10');
  await form.getByRole('button', { name: 'Guardar comprobante de anexo', exact: true }).click();
  await expect(form).toHaveCount(0);
  await page.getByLabel('Revisé los comprobantes, sus vínculos y el período antes de exportar.', { exact: true }).check();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar CSV de casilla especial', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('F07_A7_202611.csv');
  const path = info.outputPath('F07_A7_202611.csv');
  await download.saveAs(path);
  expect(await readFile(path,'utf8')).toBe(`00010000010000;01/11/2026;07;${'A'.repeat(40)};12345678123442348234123456789ABC;1000.00;10.00;;7\r\n`);
});
