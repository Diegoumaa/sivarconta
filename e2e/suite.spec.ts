import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Network-independent functional tests; the UI review also checks the real font.
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
});

async function billing(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Entrar a SIVAR FACT', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Así va tu negocio', exact: true })).toBeVisible();
}

test('suite shows four modules, three disabled, and the requested blue billing access', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Inicio · SIVAR SUITE');
  await expect(page.getByRole('article')).toHaveCount(4);
  const entry = page.getByRole('link', { name: 'Entrar a SIVAR FACT', exact: true });
  await expect(entry).toHaveAttribute('href', '#/inicio');
  await expect(entry).toHaveCSS('background-image', /rgb\(8, 121, 245\)/);
  for (const name of ['CONTA', 'STOCK', 'ADMIN']) await expect(page.getByRole('button', { name: `SIVAR ${name} · Próximamente`, exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: /^Entrar a SIVAR/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('search filters accented module names and recovers from an empty result', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('textbox', { name: 'Buscar módulos' });
  await search.fill('administracion');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'SIVAR ADMIN · Próximamente', exact: true })).toBeDisabled();
  await search.fill('no-existe');
  await expect(page.getByRole('heading', { name: 'No encontramos ese módulo' })).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar todos los módulos' }).click();
  await expect(page.getByRole('article')).toHaveCount(4);
  await expect(search).toHaveValue('');
});

test('news and account panels open, dismiss and keep a working billing destination', async ({ page }) => {
  await page.goto('/');
  const news = page.getByRole('button', { name: 'Novedades de la suite' });
  await news.click();
  await expect(page.getByRole('region', { name: 'Novedades', exact: true })).toContainText('SIVAR FACT ya está disponible.');
  await page.keyboard.press('Escape');
  await expect(news).toHaveAttribute('aria-expanded', 'false');
  await expect(news).toBeFocused();
  await page.getByRole('button', { name: 'Acceso a mi cuenta' }).click();
  await page.getByRole('link', { name: 'Ir a SIVAR FACT' }).click();
  await expect(page.getByRole('heading', { name: 'Así va tu negocio' })).toBeVisible();
});

test('suite navigation, help and browser Back/Forward work at both sizes', async ({ page }, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir menú de la suite' }).click();
  await page.getByRole('navigation', { name: 'Navegación de la suite' }).getByRole('link', { name: 'Ayuda', exact: true }).click();
  await expect(page).toHaveURL(/#\/ayuda$/);
  await expect(page.getByRole('heading', { name: '¿Por dónde empiezo?' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Módulos de SIVAR SUITE' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: '¿Por dónde empiezo?' })).toBeVisible();
});

test('billing keeps its blue identity and can return to the suite', async ({ page }) => {
  await billing(page);
  await expect(page.getByRole('button', { name: 'SIVAR FACT · Inicio', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('button', { name: 'Nueva factura', exact: true })).toHaveCSS('background-color', 'rgb(7, 107, 237)');
  await page.getByRole('link', { name: 'Volver a SIVAR SUITE' }).click();
  await expect(page.getByRole('heading', { name: 'SIVAR SUITE', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Así va tu negocio' })).toBeVisible();
});

test('all existing billing sections still open by URL and survive a reload', async ({ page }) => {
  for (const [path, heading] of [
    ['facturas', 'Facturas y documentos'], ['productos', 'Productos y servicios'], ['clientes', 'Clientes'],
    ['compras', 'Compras y gastos'], ['libros-iva', 'Libros de IVA'], ['configuracion', 'Configuración de tu empresa'],
  ]) {
    await page.goto('/#/' + path);
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Configuración de tu empresa' })).toBeVisible();
});

test('new client and product survive reload and are used in a saved draft', async ({ page }) => {
  await page.goto('/#/clientes');
  await page.getByRole('button', { name: 'Nuevo Cliente', exact: true }).click();
  await page.getByLabel('Nombre o Razón Social', { exact: true }).fill('Cliente E2E ficticio');
  await page.getByLabel('Número de Doc.', { exact: true }).fill('0000-000000-000-0');
  await page.getByLabel('NRC (Si aplica CCF)', { exact: true }).fill('999999-9');
  await page.locator('#client-address').fill('Dirección ficticia E2E');
  await page.locator('#client-email').fill('qa@example.invalid');
  await page.getByRole('button', { name: 'Guardar Cliente', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cliente E2E ficticio' })).toBeVisible();

  await page.goto('/#/productos');
  await page.getByRole('button', { name: 'Nuevo Producto / Servicio', exact: true }).click();
  await page.getByLabel('Código / SKU', { exact: true }).fill('E2E-SRV');
  await page.getByLabel('Nombre del Producto / Servicio', { exact: true }).fill('Servicio E2E ficticio');
  await page.getByLabel('Precio Unitario ($)', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Guardar Producto', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Servicio E2E ficticio' })).toBeVisible();

  await page.goto('/#/inicio');
  await page.getByRole('button', { name: /^03 / }).click();
  const client = page.getByLabel('Cliente Registrado', { exact: true });
  const clientId = await client.locator('option').filter({ hasText: 'Cliente E2E ficticio' }).getAttribute('value');
  await client.selectOption(clientId!);
  await page.getByRole('button', { name: 'Continuar a Productos', exact: true }).click();
  // The first option is the product just created; choose it by its actual SKU/name.
  const product = page.getByLabel('Producto de partida 1', { exact: true }).filter({ visible: true });
  const option = await product.locator('option').filter({ hasText: 'Servicio E2E ficticio' }).getAttribute('value');
  await product.selectOption(option!);
  await page.getByLabel('Cantidad de partida 1', { exact: true }).filter({ visible: true }).fill('3');
  await page.getByRole('button', { name: 'Continuar a Pago', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar borrador', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar borrador de prueba', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Vista previa del documento' });
  await expect(preview).toContainText('Cliente E2E ficticio');
  await expect(preview).toContainText('Servicio E2E ficticio');
  // The demo issuer is a large taxpayer: this fixture includes 1% perception.
  await expect(preview).toContainText('Percepción IVA 1%');
  await expect(preview).toContainText('171.00');
});

for (const type of ['01', '03', '05', '06', '14']) {
  test(`draft type ${type} completes the four-step wizard and persists`, async ({ page }) => {
    await page.goto('/#/inicio');
    await page.getByRole('button', { name: new RegExp('^' + type + ' ') }).click();
    await expect(page.getByRole('heading', { name: 'Nueva factura', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar a Productos', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar a Pago', exact: true }).click();
    await page.getByRole('button', { name: 'Revisar borrador', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar borrador de prueba', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Vista previa del documento' });
    await expect(preview).toBeVisible();
    const control = await preview.getByText(new RegExp('^DTE-' + type + '-M001P001-')).innerText();
    await expect(preview).toContainText('Borrador · sin transmitir');
    await expect(preview).toContainText('SIN VALIDEZ FISCAL');
    await page.getByRole('button', { name: 'Cerrar vista previa' }).click();
    await page.reload();
    await expect(page.getByText(control, { exact: true })).toBeVisible();
  });
}

test('PDF download produces a nonempty file with a PDF signature', async ({ page }, testInfo) => {
  await page.goto('/#/facturas');
  await page.getByRole('button', { name: 'Ver', exact: true }).first().click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^DTE-.*\.pdf$/);
  const path = testInfo.outputPath('documento-de-prueba.pdf');
  await download.saveAs(path);
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(path);
  expect(bytes.length).toBeGreaterThan(1000);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
});

test('preview actions fit the viewport and its close button dismisses the document', async ({ page }) => {
  await page.goto('/#/facturas');
  await page.getByRole('button', { name: 'Ver', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Vista previa del documento' });
  await expect(dialog).toBeVisible();
  for (const name of ['Descargar PDF', 'Imprimir documento', 'Cerrar vista previa']) {
    const button = dialog.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await dialog.getByRole('button', { name: 'Cerrar vista previa', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Facturas y documentos', exact: true })).toBeVisible();
});

test('a purchase saves its concept and amount and can be found after reload', async ({ page }) => {
  await page.goto('/#/compras');
  await page.getByRole('button', { name: 'Registrar Compra', exact: true }).click();
  await page.getByLabel('Número de Documento', { exact: true }).fill('E2E-CCF-001');
  await page.getByLabel('Nombre del Proveedor', { exact: true }).fill('Proveedor E2E ficticio');
  await page.getByLabel('NIT Proveedor', { exact: true }).fill('0000-000000-000-0');
  await page.getByLabel('Concepto del Gasto', { exact: true }).fill('Suministros E2E');
  await page.getByLabel('Monto Gravado ($)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Guardar Compra', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.getByRole('textbox', { name: 'Buscar compras', exact: true }).fill('E2E-CCF-001');
  const row = page.getByRole('row').filter({ hasText: 'E2E-CCF-001' });
  await expect(row).toContainText('Suministros E2E');
  await expect(row).toContainText('113.00');
});

test('invoice filters, invalid dates and reset recover the document list', async ({ page }) => {
  await page.goto('/#/facturas');
  await page.getByRole('textbox', { name: 'Buscar facturas por cliente, número o fecha' }).fill('no-existe-e2e');
  await expect(page.getByText('No se encontraron documentos emitidos en este filtro')).toBeVisible();
  await page.getByRole('button', { name: 'Restablecer filtros', exact: true }).click();
  await page.getByLabel('Facturas desde', { exact: true }).fill('2026-10-27');
  await page.getByLabel('Facturas hasta', { exact: true }).fill('2026-09-01');
  await expect(page.getByRole('alert')).toContainText('fecha inicial');
  await page.getByRole('button', { name: 'Restablecer filtros', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver', exact: true }).first()).toBeVisible();
});

test('command search opens a section and closes on Escape', async ({ page }) => {
  await billing(page);
  await page.getByRole('button', { name: 'Abrir buscador' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('suite fits narrow screens without horizontal document overflow', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'SIVAR SUITE', exact: true })).toBeVisible();
    const sizes = await page.locator('body').evaluate(body => ({ width: document.documentElement.clientWidth, scroll: Math.max(document.documentElement.scrollWidth, body.scrollWidth) }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
  }
});

test('IVA book exports the selected period as a CSV file', async ({ page }, testInfo) => {
  await page.goto('/#/libros-iva');
  await page.getByLabel('Período', { exact: true }).fill('2026-09');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV (Excel)', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('_09_2026.csv');
  const file = testInfo.outputPath('libro-de-prueba.csv');
  await download.saveAs(file);
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(file, 'utf8');
  expect(text).toContain('Numero_Control');
  expect(text).toContain('DTE-03-M001P001-000000000000104');
});

test('switching company isolates lists and a new company persists', async ({ page }) => {
  await page.goto('/#/configuracion');
  await page.getByRole('button', { name: '+ Registrar Otra Empresa', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar Nueva Empresa', exact: true });
  await dialog.locator('#comp-name').fill('Empresa E2E ficticia');
  await dialog.locator('#comp-nit').fill('0000-000000-000-0');
  await dialog.locator('#comp-nrc').fill('999999-9');
  await dialog.locator('#comp-activity').fill('Datos sintéticos E2E');
  await dialog.locator('#comp-email').fill('qa@example.invalid');
  await dialog.locator('#comp-address').fill('Dirección ficticia de prueba');
  await dialog.getByRole('button', { name: 'Guardar y Activar Empresa', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Empresa E2E ficticia', exact: true })).toBeVisible();
  // Dismiss the success notice before using the header it temporarily covers.
  await expect(page.getByText('Empresa registrada exitosamente', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close toast', exact: true }).click();
  await page.goto('/#/clientes');
  await expect(page.getByText('Directorio de Clientes Vacío')).toBeVisible();
  await page.getByRole('button', { name: 'Empresa E2E ficticia', exact: true }).click();
  await page.getByRole('button', { name: /Distribuidora Cuscatlán.*NRC/ }).click();
  await page.goto('/#/clientes');
  await expect(page.getByRole('heading', { name: 'Farmacéutica Santa Lucía, S.A. de C.V.', exact: true })).toBeVisible();
});

test('invalid client data stays in the form until corrected', async ({ page }) => {
  await page.goto('/#/clientes');
  await page.getByRole('button', { name: 'Nuevo Cliente', exact: true }).click();
  await page.getByLabel('Nombre o Razón Social', { exact: true }).fill('Cliente a corregir E2E');
  await page.getByLabel('Número de Doc.', { exact: true }).fill('incorrecto');
  await page.locator('#client-address').fill('Dirección ficticia E2E');
  await page.locator('#client-email').fill('qa@example.invalid');
  await page.getByRole('button', { name: 'Guardar Cliente', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('NIT');
  await expect(page.getByLabel('Nombre o Razón Social', { exact: true })).toHaveValue('Cliente a corregir E2E');
  await page.getByLabel('Número de Doc.', { exact: true }).fill('0000-000000-000-0');
  await page.getByRole('button', { name: 'Guardar Cliente', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Cliente a corregir E2E', exact: true })).toBeVisible();
});
