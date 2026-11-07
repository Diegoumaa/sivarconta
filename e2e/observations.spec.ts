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

test('FSE applies the 10% only when a service is marked', async ({ page }, info) => {
  await page.goto('/#/inicio');
  await page.getByRole('button', { name: /^14 / }).click();
  await expect(page.getByLabel('Cliente Registrado', { exact: true })).toHaveValue('cli-2');
  await page.getByRole('button', { name: 'Continuar a Productos', exact: true }).click();
  const isr = page.getByRole('checkbox', { name: 'Aplicar retención del 10% de ISR a partida 1', exact: true });
  await expect(isr).toHaveCount(0);
  await page.getByLabel('Producto de partida 1', { exact: true }).filter({ visible: true }).selectOption('prod-4');
  await expect(page.getByLabel('Naturaleza de partida 1', { exact: true })).toHaveValue('SERVICIO');
  await page.getByLabel('Precio unitario de partida 1', { exact: true }).filter({ visible: true }).fill('27.77');
  await expect(isr).not.toBeChecked();
  await page.getByRole('button', { name: 'Continuar a Pago', exact: true }).click();
  await expect(page.getByText(/Retienes \$/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await isr.check();
  await page.locator('.space-y-4').filter({
    has: page.getByText('Paso 2: ¿Qué productos o servicios vas a facturar?', { exact: true }),
  }).last().screenshot({ path: info.outputPath('fse-isr-activado.png') });
  await page.getByRole('button', { name: 'Continuar a Pago', exact: true }).click();
  await expect(page.getByText(/Retienes \$2.78/)).toBeVisible();
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await isr.uncheck();
  await page.getByRole('button', { name: 'Continuar a Pago', exact: true }).click();
  await expect(page.getByText(/Retienes \$/)).toHaveCount(0);
});

test('inclusive CCF saves its F07 classification without changing its IVA', async ({ page }) => {
  await page.goto('/#/inicio');
  await page.getByRole('button', { name: /^03 / }).click();
  await page.getByRole('button', { name: 'Continuar a Productos', exact: true }).click();
  await page.getByLabel('Ingresar precios con IVA incluido', { exact: true }).check();
  await page.getByLabel('Precio unitario de partida 1', { exact: true }).filter({ visible: true }).fill('113');
  await page.getByRole('button', { name: 'Continuar a Pago', exact: true }).click();
  await page.getByLabel('Tipo de operación de renta', { exact: true }).selectOption('1');
  await page.getByLabel('Tipo de ingreso de renta', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Revisar borrador', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar borrador de prueba', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Vista previa del documento' });
  await expect(dialog).toContainText('$113.00');
  await expect(dialog).toContainText('$100.00');
  await expect(dialog).toContainText('$13.00');
  await expect(dialog.getByRole('columnheader', { name: 'Ventas no sujetas', exact: true })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Ventas exentas', exact: true })).toBeVisible();
  await page.reload();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sivarconta_demo_v2_invoices') ?? localStorage.getItem('sivarconta_invoices') ?? '[]')
    .find((invoice: { status: string; totalPagar: number }) => invoice.status === 'BORRADOR' && invoice.totalPagar === 113)?.f07Renta))
    .toEqual({ operation: '1', income: '2' });
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
    const book = page.locator('#printable-iva-book');
    const region = book.getByRole('region');
    const documentCell = region.locator('tbody tr').first().locator('td').nth(2);
    await expect(documentCell).toBeVisible();
    expect((await documentCell.boundingBox())?.width).toBeGreaterThan(190);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    await region.evaluate(element => { element.scrollLeft = 0; });
    await book.screenshot({ path: info.outputPath(`libro-${tab}.png`) });
    await region.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await book.screenshot({ path: info.outputPath(`libro-${tab}-montos.png`) });
    let download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar Excel', exact: true }).click();
    const xlsx = await download, path = info.outputPath(`libro-${tab}.xlsx`); await xlsx.saveAs(path);
    const zip = unzipSync(await readFile(path));
    const sheet = strFromU8(zip['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('CONTADOR');
    expect(sheet).toContain('Período:');
    expect(sheet).toContain('orientation="landscape" paperSize="5"');
    const signatureRow = sheet.match(/<c r="A(\d+)" s="4" t="inlineStr"><is><t xml:space="preserve">CONTADOR/)?.[1];
    expect(signatureRow).toBeTruthy();
    expect(sheet).toContain(`mergeCell ref="A${signatureRow}:${tab === 'consumidor' ? 'N' : 'O'}${signatureRow}"`);
    download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
    const pdf = await download, pdfPath = info.outputPath(`libro-${tab}.pdf`); await pdf.saveAs(pdfPath);
    const pdfText = (await readFile(pdfPath)).toString('latin1');
    expect(pdfText.startsWith('%PDF-')).toBe(true);
    const dimensions = pdfText.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
    expect(Number(dimensions?.[1])).toBeCloseTo(1008, 0);
    expect(Number(dimensions?.[2])).toBeCloseTo(612, 0);
  }
});

test('F07 export requires classification review and downloads semicolon data', async ({ page }, info) => {
  await page.goto('/#/libros-iva');
  await page.getByLabel('Período', { exact: true }).fill('2026-09');
  await page.getByText('Anexo CSV F-07 del libro seleccionado', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Descargar anexo F-07 CSV', exact: true })).toBeDisabled();
  const picker = page.getByLabel('Revisar clasificación de un comprobante', { exact: true });
  const pending = await picker.locator('option').filter({ hasText: 'Pendiente' }).all();
  expect(pending.length).toBeGreaterThan(0);
  const pendingIds = await Promise.all(pending.map(option => option.getAttribute('value')));
  for (const [index, id] of pendingIds.entries()) {
    await picker.selectOption(id!);
    await page.getByLabel('Tipo de operación de renta', { exact: true }).selectOption('1');
    await page.getByLabel('Tipo de ingreso de renta', { exact: true }).selectOption(index === 0 ? '2' : '3');
    await page.getByRole('button', { name: 'Guardar clasificación del comprobante' }).click();
  }
  await page.reload();
  await page.getByLabel('Período', { exact: true }).fill('2026-09');
  await page.getByText('Anexo CSV F-07 del libro seleccionado', { exact: true }).click();
  await expect(picker.locator('option').filter({ hasText: 'Pendiente' })).toHaveCount(0);
  await page.getByLabel('Revisé las clasificaciones y el período del anexo.', { exact: true }).check();
  await page.locator('details', { hasText: 'Anexo CSV F-07 del libro seleccionado' }).screenshot({ path: info.outputPath('anexo-f07.png') });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar anexo F-07 CSV', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('F07_A1_202609.csv');
  const path = info.outputPath(file.suggestedFilename());
  await file.saveAs(path);
  const data = (await readFile(path, 'utf8')).trim().split(/\r?\n/);
  expect(data.length).toBeGreaterThan(0);
  expect(data.map(line => line.split(';')[18])).toContain('2');
  if (pendingIds.length > 1) expect(data.map(line => line.split(';')[18])).toContain('3');
  for (const line of data) {
    expect(line).toMatch(/^\d{2}\/\d{2}\/\d{4};/);
    expect(line.split(';')).toHaveLength(20);
  }
});

test('October purchase downloads the fiscal Annex 3 separately from the IVA book', async ({ page }, info) => {
  await page.goto('/#/compras');
  await page.getByRole('button', { name: 'Registrar Compra', exact: true }).click();
  await page.getByLabel('Nombre del Proveedor', { exact: true }).fill('Proveedor ficticio E2E');
  await page.getByLabel('NIT Proveedor', { exact: true }).fill('0000-000000-000-0');
  await page.getByLabel('Clase del comprobante', { exact: true }).selectOption('4');
  await page.getByLabel('Código de generación del proveedor', { exact: true }).fill('12345678-1234-4234-8234-123456789ABC');
  await page.getByLabel('Número de Documento', { exact: true }).fill('DTE-03-M001P001-000000000000027');
  await page.getByLabel('Fecha de compra', { exact: true }).fill('2026-10-27');
  await page.getByLabel('Concepto del Gasto', { exact: true }).fill('Suministros de oficina');
  await page.getByLabel('Monto Gravado ($)', { exact: true }).fill('100');
  await page.getByLabel('Tipo de operación de renta', { exact: true }).selectOption('1');
  await page.getByLabel('Clasificación de renta', { exact: true }).selectOption('2');
  await page.getByLabel('Sector de renta', { exact: true }).selectOption('2');
  await page.getByLabel('Tipo de costo o gasto', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Guardar Compra', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Registrar Compra', exact: true }).click();
  await page.getByLabel('Nombre del Proveedor', { exact: true }).fill('Proveedor de materiales E2E');
  await page.getByLabel('NIT Proveedor', { exact: true }).fill('0000-000000-000-0');
  await page.getByLabel('Clase del comprobante', { exact: true }).selectOption('1');
  await page.getByLabel('Número de Documento', { exact: true }).fill('CCF-E2E-COSTO');
  await page.getByLabel('Fecha de compra', { exact: true }).fill('2026-10-28');
  await page.getByLabel('Concepto del Gasto', { exact: true }).fill('Materiales de obra');
  await page.getByLabel('Monto Gravado ($)', { exact: true }).fill('50');
  await page.getByLabel('Tipo de operación de renta', { exact: true }).selectOption('1');
  await page.getByLabel('Clasificación de renta', { exact: true }).selectOption('1');
  await page.getByLabel('Sector de renta', { exact: true }).selectOption('4');
  await page.getByLabel('Tipo de costo o gasto', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Guardar Compra', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();

  await page.goto('/#/libros-iva');
  await page.getByLabel('Período', { exact: true }).fill('2026-10');
  await page.getByRole('button', { name: '3. Libro de Compras', exact: true }).click();
  const bookView = page.getByRole('region', { name: /Libro de Compras/i });
  await bookView.screenshot({ path: info.outputPath('libro-de-compras.png') });

  let pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar Excel', exact: true }).click();
  const excel = await pending;
  expect(excel.suggestedFilename()).toBe('Libro_IVA_compras_2026-10.xlsx');
  const excelPath = info.outputPath(excel.suggestedFilename());
  await excel.saveAs(excelPath);
  const sheet = strFromU8(unzipSync(await readFile(excelPath))['xl/worksheets/sheet1.xml']);
  expect(sheet).toContain('Proveedor ficticio E2E');
  expect(sheet).toContain('SIN VALIDEZ FISCAL');

  pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV del libro', exact: true }).click();
  const book = await pending;
  expect(book.suggestedFilename()).toBe('Libro_IVA_compras_10_2026.csv');
  const bookPath = info.outputPath(book.suggestedFilename());
  await book.saveAs(bookPath);
  expect(await readFile(bookPath, 'utf8')).toMatch(/^\uFEFF"Fecha","Tipo_Doc","Numero_Documento"/);

  await page.getByText('Anexo CSV F-07 del libro seleccionado', { exact: true }).click();
  await page.getByLabel('Revisé las clasificaciones y el período del anexo.', { exact: true }).check();
  await page.locator('details', { hasText: 'Anexo CSV F-07 del libro seleccionado' }).screenshot({ path: info.outputPath('anexo-f07-compras.png') });
  pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar anexo F-07 CSV', exact: true }).click();
  const annex = await pending;
  expect(annex.suggestedFilename()).toBe('F07_A3_202610.csv');
  const annexPath = info.outputPath(annex.suggestedFilename());
  await annex.saveAs(annexPath);
  const data = await readFile(annexPath, 'utf8');
  expect(data.trim().split('\r\n')).toEqual(expect.arrayContaining([
    '27/10/2026;4;03;12345678123442348234123456789ABC;00000000000000;Proveedor ficticio E2E;0.00;0.00;0.00;100.00;0.00;0.00;0.00;13.00;100.00;;1;2;2;2;3',
    '28/10/2026;1;03;CCFE2ECOSTO;00000000000000;Proveedor de materiales E2E;0.00;0.00;0.00;50.00;0.00;0.00;0.00;6.50;50.00;;1;1;4;5;3',
  ]));
  expect(data.trim().split('\r\n')).toHaveLength(2);
});
