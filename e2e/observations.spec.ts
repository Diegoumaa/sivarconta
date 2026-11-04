import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

test('department updates municipality options without guessing a municipality', async ({ page }) => {
  await page.goto('/#/clientes');
  await page.getByRole('button', { name: 'Nuevo Cliente', exact: true }).click();
  await page.getByLabel('Departamento', { exact: true }).selectOption('La Libertad');
  await expect(page.getByLabel('Municipio', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Municipio', { exact: true }).locator('option')).toHaveCount(7);
  await page.getByLabel('Municipio', { exact: true }).selectOption('La Libertad Sur');
  await page.getByLabel('Departamento', { exact: true }).selectOption('Santa Ana');
  await expect(page.getByLabel('Municipio', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Municipio', { exact: true }).locator('option')).toHaveCount(5);
});

test('logo and opening IVA balance persist across reloads', async ({ page }) => {
  await page.goto('/#/configuracion');
  await page.getByLabel('Primer período de cálculo', { exact: true }).fill('2026-11');
  await page.getByLabel('Remanente inicial declarado ($)', { exact: true }).fill('80');
  await page.getByLabel('Logo de la empresa', { exact: true }).setInputFiles({ name: 'logo-prueba.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6U1sAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Guardar configuración de documentos', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Remanente inicial declarado ($)', { exact: true })).toHaveValue('80');
  await expect(page.getByRole('img', { name: 'Logo de la empresa', exact: true })).toBeVisible();
  await page.goto('/#/libros-iva');
  await page.getByLabel('Período', { exact: true }).fill('2026-11');
  await expect(page.getByText('Remanente a Favor: $80.00', { exact: true })).toBeVisible();
});

test('supplier can be saved independently and reused after reload with DUI', async ({ page }) => {
  await page.goto('/#/compras');
  await page.getByRole('button', { name: 'Registrar Compra', exact: true }).click();
  await page.getByLabel('Nombre del Proveedor', { exact: true }).fill('Proveedor independiente E2E');
  await page.getByLabel('Documento del proveedor', { exact: true }).selectOption('DUI');
  await page.getByLabel('DUI Proveedor', { exact: true }).fill('00000000-0');
  await page.getByRole('button', { name: 'Guardar proveedor para próximas compras', exact: true }).click();
  await expect(page.getByText('Proveedor guardado', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Registrar Compra', exact: true }).click();
  await page.getByLabel('Proveedor guardado', { exact: true }).selectOption('00000000-0');
  await expect(page.getByLabel('Nombre del Proveedor', { exact: true })).toHaveValue('Proveedor independiente E2E');
  await expect(page.getByLabel('DUI Proveedor', { exact: true })).toHaveValue('00000000-0');
  await page.getByLabel('Naturaleza de la compra', { exact: true }).selectOption('SERVICIO');
  await page.getByLabel(/Proveedor persona natural domiciliada/).check();
  await page.getByLabel('Monto Gravado ($)', { exact: true }).fill('100');
  await expect(page.getByText('$103.00', { exact: true })).toBeVisible();
});

test('FSE retains only services and selects a recipient without NRC', async ({ page }) => {
  await page.goto('/#/inicio');
  await page.getByRole('button', { name: /^14 / }).click();
  await expect(page.getByLabel('Cliente Registrado', { exact: true })).toHaveValue('cli-2');
  await page.getByRole('button', { name: 'Continuar a Productos', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar a Pago', exact: true }).click();
  await expect(page.getByText(/Retienes \$0.00/)).toBeVisible();
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await page.getByLabel('Naturaleza de partida 1', { exact: true }).selectOption('SERVICIO');
  await page.getByRole('button', { name: 'Continuar a Pago', exact: true }).click();
  await expect(page.getByText(/Retienes \$75.00/)).toBeVisible();
});

test('inclusive CCF prices split the IVA once and preserve the document tax categories', async ({ page }) => {
  await page.goto('/#/inicio');
  await page.getByRole('button', { name: /^03 / }).click();
  await page.getByRole('button', { name: 'Continuar a Productos', exact: true }).click();
  await page.getByLabel('Ingresar precios con IVA incluido', { exact: true }).check();
  await page.getByLabel('Precio unitario de partida 1', { exact: true }).filter({ visible: true }).fill('113');
  await page.getByRole('button', { name: 'Continuar a Pago', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar borrador', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar borrador de prueba', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Vista previa del documento' });
  await expect(dialog).toContainText('$113.00');
  await expect(dialog).toContainText('$100.00');
  await expect(dialog).toContainText('$13.00');
  await expect(dialog.getByRole('columnheader', { name: 'Ventas no sujetas', exact: true })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Ventas exentas', exact: true })).toBeVisible();
});

test('credit note identifies its original document and presents an adjustment', async ({ page }) => {
  await page.goto('/#/inicio');
  await page.getByRole('button', { name: /^05 / }).click();
  await page.getByRole('button', { name: 'Continuar a Productos', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar a Pago', exact: true }).click();
  await expect(page.getByLabel('Forma de pago', { exact: true })).toHaveCount(0);
  await page.getByLabel('Comprobante original', { exact: true }).fill('CCF-ORIGINAL-E2E');
  await page.getByRole('button', { name: 'Revisar borrador', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar borrador de prueba', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Vista previa del documento' });
  await expect(dialog).toContainText('No registra un nuevo cobro');
  await expect(dialog).toContainText('CCF-ORIGINAL-E2E');
  await expect(dialog).toContainText('Monto del ajuste:');
});

test('three client book formats download as real Excel and readable PDFs', async ({ page }, info) => {
  await page.goto('/#/libros-iva');
  await page.getByLabel('Período', { exact: true }).fill('2026-09');
  for (const [tab, label] of [['contribuyentes', /1. Libro de Ventas a Contribuyentes/], ['consumidor', /2. Libro de Ventas a Consumidor Final/], ['compras', /3. Libro de Compras/]] as const) {
    await page.getByRole('button', { name: label }).click();
    await expect(page.getByText('CONTADOR', { exact: true })).toBeVisible();
    let download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar Excel', exact: true }).click();
    const xlsx = await download, path = info.outputPath(`libro-${tab}.xlsx`); await xlsx.saveAs(path);
    const zip = unzipSync(await readFile(path));
    expect(strFromU8(zip['xl/worksheets/sheet1.xml'])).toContain('CONTADOR');
    expect(strFromU8(zip['xl/worksheets/sheet1.xml'])).toContain('Período:');
    download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
    const pdf = await download, pdfPath = info.outputPath(`libro-${tab}.pdf`); await pdf.saveAs(pdfPath);
    expect((await readFile(pdfPath)).subarray(0, 5).toString()).toBe('%PDF-');
    await page.screenshot({ path: info.outputPath(`libro-${tab}.png`), fullPage: true });
  }
});

test('F07 export requires classification review and downloads semicolon data', async ({ page }) => {
  await page.goto('/#/libros-iva');
  await page.getByLabel('Período', { exact: true }).fill('2026-09');
  await page.getByText('Anexo CSV F-07 del libro seleccionado', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Descargar anexo F-07 CSV', exact: true })).toBeDisabled();
  await page.getByLabel('Tipo de operación de renta', { exact: true }).selectOption('1');
  await page.getByLabel('Tipo de ingreso de renta', { exact: true }).selectOption('3');
  await page.getByLabel('Revisé que todos los registros comparten estos códigos y corresponden al período.', { exact: true }).check();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar anexo F-07 CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('F07_A1_202609.csv');
});
