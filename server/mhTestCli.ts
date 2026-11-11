import { readFile, writeFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import {
  authenticateHaciendaTest, consultTestInvoice, haciendaTokenProfile, missingApiAuthorityMessage,
  signTestInvoice, transmitTestInvoice, validateTestInvoice,
} from './mhTest.js';
import { prepareTestFactura } from './mhTestFactura.js';
import { withHaciendaDiagnostics } from './mhTestDiagnostics.js';

const [action, input, configuration, output] = process.argv.slice(2);
const readJson = async (path: string) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en el entorno del proceso.`);
  return value;
}

async function main() {
  if (action === 'autenticar') {
    const profile = haciendaTokenProfile(await authenticateHaciendaTest(env('MH_TEST_NIT'), env('MH_TEST_API_PASSWORD')));
    console.log(JSON.stringify({ autenticacionConfirmada: true, usuarioApi: profile.usuarioApi, autoridades: profile.autoridades }, null, 2));
    if (!profile.usuarioApi) {
      console.error(missingApiAuthorityMessage(profile).replace(' No se transmitió.', ''));
      process.exitCode = 3;
    }
    return;
  }
  if (action === 'preparar' && input && configuration && output) {
    const document = prepareTestFactura(await readJson(input), await readJson(configuration));
    await writeFile(output, JSON.stringify(document, null, 2) + '\n', { flag: 'wx' });
    console.log('Factura 01 v2 validada y guardada para el ambiente 00.');
    return;
  }
  if (!input || !['validar', 'firmar', 'enviar', 'consultar', 'diagnosticar'].includes(action)) {
    throw new Error('Usa autenticar, preparar <borrador> <emisor> <salida>, o validar|firmar|enviar|consultar|diagnosticar <factura.json>.');
  }
  const document = validateTestInvoice(await readJson(input));
  if (action === 'validar') {
    console.log('JSON válido. Factura 01 v2, ambiente 00.');
    return;
  }
  if (action === 'consultar') {
    const token = await authenticateHaciendaTest(document.emisor.nit, env('MH_TEST_API_PASSWORD'));
    const result = await consultTestInvoice(document, token);
    console.log(JSON.stringify(result, null, 2));
    if (result.estado !== 'PROCESADO') process.exitCode = 2;
    return;
  }
  const xml = await readFile(env('MH_TEST_CERTIFICATE'), 'utf8');
  const signature = signTestInvoice(document, xml, env('MH_TEST_SIGNING_PASSWORD'));
  if (action === 'firmar') {
    console.log('Firma RS512 generada y verificada localmente.');
    return;
  }
  const token = await authenticateHaciendaTest(document.emisor.nit, env('MH_TEST_API_PASSWORD'));
  const profile = haciendaTokenProfile(token);
  if (action === 'diagnosticar') {
    const result = await consultTestInvoice(document, token);
    console.log(JSON.stringify({
      esquemaValido: true, firmaLocalVerificada: true, autenticacionConfirmada: true,
      credencial: { usuarioApi: profile.usuarioApi, autoridades: profile.autoridades },
      advertencia: profile.usuarioApi ? null : missingApiAuthorityMessage(profile).replace(' No se transmitió.', ''),
      transmitido: false, consulta: result,
    }, null, 2));
    return;
  }
  const result = await transmitTestInvoice(document, signature, token, {
    permitirSinUsuarioApi: process.env.MH_TEST_PERMITIR_SIN_USER_API === '1',
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.estado !== 'PROCESADO') process.exitCode = 2;
}

const logPath = process.env.MH_TEST_LOG_PATH;
const operation = logPath
  ? withHaciendaDiagnostics(event => appendFileSync(logPath, JSON.stringify(event) + '\n', { encoding: 'utf8', mode: 0o600 }), main)
  : main();
operation.catch(error => {
  console.error(error instanceof Error ? error.message : 'Falló la operación de pruebas.');
  process.exitCode = 1;
});
