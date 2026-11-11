import { createHash, createPrivateKey, createPublicKey, sign, timingSafeEqual, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { SaxesParser } from 'saxes';
import { diagnosticHash, haciendaTokenAuthorities, recordHaciendaDiagnostic, summarizeHaciendaRequest, summarizeHaciendaResponse, summarizeHaciendaToken } from './mhTestDiagnostics.js';

const baseUrl = 'https://apitest.dtes.mh.gob.sv';
const userAgent = 'SIVAR-FACT-DTE-Pruebas/1.0';
const maxEmissionAgeMinutes = 25;
const uuidV4 = /^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/;
const ajv = new Ajv({ allErrors: true, strict: false, multipleOfPrecision: 6 });
addFormats.default(ajv);
const schema = JSON.parse(readFileSync(new URL('./mh-schemas/fe-f-v2.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const checkSchema = ajv.compile<FacturaPrueba>(schema);

export interface FacturaPrueba {
  identificacion: {
    ambiente: '00'; version: 2; tipoDte: '01'; codigoGeneracion: string; numeroControl: string;
    tipoModelo: number; tipoOperacion: number; fecEmi: string; horEmi: string;
  };
  emisor: { nit: string };
  receptor: null | Record<string, unknown>;
}

export interface HaciendaTokenProfile {
  decodificable: boolean;
  autoridades: string[];
  usuarioApi: boolean;
}

// Describe el tipo de credencial sin exponer el token. Solo el usuario API del Sistema de Transmisión
// (contraseña de «Gestión de Usuario API» en el Sitio de Emisores DTE) recibe la autoridad USER_API.
export function haciendaTokenProfile(token: string): HaciendaTokenProfile {
  const autoridades = haciendaTokenAuthorities(token);
  return { decodificable: autoridades !== null, autoridades: autoridades || [], usuarioApi: Boolean(autoridades?.includes('USER_API')) };
}

export function missingApiAuthorityMessage(profile: HaciendaTokenProfile) {
  const roles = profile.decodificable ? profile.autoridades.join(', ') || 'ninguna' : 'token no decodificable';
  return 'El token de Hacienda no pertenece al usuario API del Sistema de Transmisión: no incluye la autoridad '
    + `USER_API (autoridades recibidas: ${roles}). Con ese tipo de token, /fesv/recepciondte responde 094 `
    + '«VERIFIQUE SU TIPO DE SOLICITUD DTE» incluso con un cuerpo vacío, antes de leer el DTE. '
    + 'El rol USER_API lo asigna el último paso de la acreditación («Asignando contraseña, para acceso API»). '
    + 'Si el Sitio de Emisores DTE no muestra el menú «Gestión de Usuario API», ese paso no terminó y Hacienda '
    + '(soporte.dtes@mh.gob.sv) debe asignar USER_API al NIT; si el menú existe, use la contraseña de ese menú. No se transmitió.';
}

const emissionInstant = ({ fecEmi, horEmi }: { fecEmi: string; horEmi: string }) => Date.parse(`${fecEmi}T${horEmi}-06:00`);

export function validateTestInvoice(document: unknown): FacturaPrueba {
  if (!checkSchema(document)) {
    recordHaciendaDiagnostic('esquema', { valido: false, erroresCantidad: checkSchema.errors?.length || 0 });
    const issues = checkSchema.errors?.map(error => `${error.instancePath || '/'} ${error.message}`);
    throw new Error(`El JSON no cumple el esquema de factura v2. ${issues?.join(' | ')}`);
  }
  const { identificacion, emisor } = document;
  if (identificacion.ambiente !== '00') throw new Error('El ambiente del documento debe ser 00.');
  if (!uuidV4.test(identificacion.codigoGeneracion)) throw new Error('El código de generación debe ser un UUID v4.');
  if (!/^\d{14}$/.test(emisor.nit)) throw new Error('El emisor debe tener un NIT de 14 dígitos sin guiones.');
  recordHaciendaDiagnostic('esquema', { valido: true, version: 2, ambiente: '00', codigoGeneracion: identificacion.codigoGeneracion });
  return document;
}

export function readCertificate(xml: string) {
  const values = new Map<string, string>();
  const wanted = new Set(['nit', 'activo', 'privateKey/clave', 'privateKey/encodied', 'publicKey/encodied']);
  const stack: string[] = [];
  const parser = new SaxesParser();
  parser.on('doctype', () => { throw new Error('El certificado contiene una declaración XML no permitida.'); });
  parser.on('opentag', tag => {
    if (!stack.length && tag.name !== 'CertificadoMH') throw new Error('El archivo no es un certificado XML de Hacienda.');
    stack.push(tag.name);
    const field = stack.slice(1).join('/');
    if (wanted.has(field)) {
      if (values.has(field)) throw new Error('El certificado repite un campo requerido.');
      values.set(field, '');
    }
  });
  parser.on('text', value => {
    const field = stack.slice(1).join('/');
    if (values.has(field)) values.set(field, values.get(field) + value);
  });
  parser.on('closetag', () => { stack.pop(); });
  parser.write(xml).close();
  return values;
}

export function signTestInvoice(document: FacturaPrueba, xml: string, password: string) {
  validateTestInvoice(document);
  const certificate = readCertificate(xml);
  if (certificate.get('nit')?.trim() !== document.emisor.nit || certificate.get('activo')?.trim() !== 'true') {
    throw new Error('El certificado local no está activo o su NIT no coincide con el emisor del JSON.');
  }
  const savedHash = certificate.get('privateKey/clave')?.trim() || '';
  const providedHash = createHash('sha512').update(password, 'utf8').digest();
  if (!/^[a-fA-F0-9]{128}$/.test(savedHash) || !timingSafeEqual(providedHash, Buffer.from(savedHash, 'hex'))) {
    throw new Error('La contraseña de firma no coincide con el certificado.');
  }
  const privateKey = createPrivateKey({
    key: Buffer.from(certificate.get('privateKey/encodied') || '', 'base64'), format: 'der', type: 'pkcs8',
  });
  const publicKey = createPublicKey({
    key: Buffer.from(certificate.get('publicKey/encodied') || '', 'base64'), format: 'der', type: 'spki',
  });
  if (privateKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyType !== 'rsa') {
    throw new Error('El certificado de Hacienda debe contener claves RSA.');
  }
  const header = Buffer.from('{"alg":"RS512"}').toString('base64url');
  const payload = Buffer.from(JSON.stringify(document)).toString('base64url');
  const signingInput = Buffer.from(`${header}.${payload}`);
  const signature = sign('RSA-SHA512', signingInput, privateKey);
  if (!verify('RSA-SHA512', signingInput, publicKey, signature)) throw new Error('No se pudo verificar la firma con el certificado.');
  recordHaciendaDiagnostic('firma_local', {
    verificada: true, algoritmo: 'RS512', bitsRsa: publicKey.asymmetricKeyDetails?.modulusLength || null,
    clavePublicaSha256: diagnosticHash(publicKey.export({ format: 'der', type: 'spki' })),
    payloadSha256: diagnosticHash(Buffer.from(JSON.stringify(document))), firmaBytes: signature.length,
  });
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

export async function request(path: string, body: URLSearchParams | string, authorization?: string) {
  const headers: Record<string, string> = {
    'Content-Type': typeof body === 'string' ? 'application/json' : 'application/x-www-form-urlencoded',
    'User-Agent': userAgent,
  };
  if (authorization) headers.Authorization = authorization;
  recordHaciendaDiagnostic('peticion_http', {
    metodo: 'POST', destino: baseUrl, ruta: path, userAgent,
    contentType: headers['Content-Type'], autorizacionPresente: Boolean(authorization),
    cuerpo: summarizeHaciendaRequest(body),
  });
  const started = performance.now();
  let response: Response;
  let json: any;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(20_000),
    });
    json = await response.json().catch(() => null);
  } catch (error) {
    const name = error instanceof Error && ['AbortError', 'TimeoutError', 'TypeError'].includes(error.name) ? error.name : 'Error';
    recordHaciendaDiagnostic('error_http', { ruta: path, tipo: name, duracionMs: Math.round(performance.now() - started) });
    throw error;
  }
  recordHaciendaDiagnostic('respuesta_http', { ruta: path, ...summarizeHaciendaResponse(json, response, Math.round(performance.now() - started)) });
  return { status: response.status, ok: response.ok, json, contentType: response.headers.get('content-type') };
}

export async function authenticateHaciendaTest(nit: string, password: string) {
  if (!/^\d{14}$/.test(nit) || !password) throw new Error('Se requiere el NIT sin guiones y la contraseña API.');
  const { ok, status, json } = await request('/seguridad/auth', new URLSearchParams({ user: nit, pwd: password }));
  const token = json?.body?.token;
  if (!ok || json?.status !== 'OK' || typeof token !== 'string' || !/^(?:Bearer )?[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
    const code = [json?.codigoMsg, json?.body?.codigo, json?.code].find(value => /^\d{2,4}$/.test(String(value)));
    throw new Error(`Hacienda no confirmó la autenticación (HTTP ${status}${code ? `, código ${code}` : ''}).`);
  }
  recordHaciendaDiagnostic('autenticacion', { confirmada: true, ...summarizeHaciendaToken(token, nit) });
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

export function receptionResult(
  { status, ok, json, contentType }: Awaited<ReturnType<typeof request>>,
  expectedGenerationCode: string,
) {
  const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 500) : null;
  const accepted = ok && json?.ambiente === '00' && json?.codigoGeneracion === expectedGenerationCode
    && json?.estado === 'PROCESADO' && /^[A-Z0-9]{40}$/i.test(json?.selloRecibido);
  return {
    http: status,
    respuestaJson: json !== null,
    tipoContenidoRespuesta: contentType,
    ambiente: '00',
    codigoGeneracion: expectedGenerationCode,
    ambienteReportado: text(json?.ambiente),
    codigoGeneracionReportado: text(json?.codigoGeneracion),
    estadoReportado: text(json?.estado),
    versionRespuesta: typeof json?.version === 'number' ? json.version : null,
    estado: accepted ? 'PROCESADO' : json?.ambiente === '00' && json?.codigoGeneracion === expectedGenerationCode
      && json?.estado === 'RECHAZADO' ? 'RECHAZADO' : 'SIN_CONFIRMAR',
    selloRecibido: accepted ? text(json.selloRecibido) : null,
    fhProcesamiento: text(json?.fhProcesamiento),
    codigoMsg: text(json?.codigoMsg),
    clasificaMsg: text(json?.clasificaMsg),
    descripcionMsg: text(json?.descripcionMsg),
    observaciones: Array.isArray(json?.observaciones) ? json.observaciones.slice(0, 20).map(text).filter(Boolean) : [],
    pista: json?.codigoMsg === '094'
      ? 'Código 94 del Manual Tecnológico V2.0: PARAMETROS NO SON VALIDOS. El 10/11/2026 se obtuvo idéntico con cuerpo '
        + 'vacío usando un token sin USER_API (usuario sin rol de acceso API): ejecutar `autenticar` antes de cambiar el DTE.'
      : null,
  };
}

interface TransmitOptions {
  /** Solo para experimentos controlados: transmite aunque el token no traiga USER_API. */
  permitirSinUsuarioApi?: boolean;
  ahora?: Date;
}

export async function transmitTestInvoice(document: FacturaPrueba, signature: string, token: string, options: TransmitOptions = {}) {
  const { codigoGeneracion, version, tipoDte, numeroControl, tipoModelo, tipoOperacion, fecEmi, horEmi } = validateTestInvoice(document).identificacion;
  const previous = await consultTestInvoice(document, token);
  if (previous.estado === 'PROCESADO') {
    recordHaciendaDiagnostic('decision_envio', { transmitir: false, motivo: 'sello_existente' });
    return { ...previous, reenvioEvitado: true };
  }
  const absent = previous.http === 400 && previous.ambienteReportado === '00'
    && previous.codigoMsg === '999' && previous.codigoGeneracionReportado === null
    && previous.descripcionMsg === 'No se encontro ningun registro que coincida';
  if (!absent) {
    recordHaciendaDiagnostic('decision_envio', { transmitir: false, motivo: 'consulta_sin_ausencia_confirmada' });
    throw new Error(`La consulta previa no confirmó ausencia del DTE (HTTP ${previous.http}, código ${previous.codigoMsg || 'sin código'}). No se reenvió.`);
  }
  const profile = haciendaTokenProfile(token);
  if (!profile.usuarioApi && !options.permitirSinUsuarioApi) {
    recordHaciendaDiagnostic('decision_envio', { transmitir: false, motivo: 'token_sin_user_api', autoridades: profile.autoridades });
    throw new Error(missingApiAuthorityMessage(profile));
  }
  const ageMinutes = ((options.ahora ?? new Date()).getTime() - emissionInstant({ fecEmi, horEmi })) / 60_000;
  if (tipoModelo === 1 && tipoOperacion === 1 && !(Math.abs(ageMinutes) <= maxEmissionAgeMinutes)) {
    recordHaciendaDiagnostic('decision_envio', { transmitir: false, motivo: 'hora_emision_fuera_de_ventana', minutos: Math.round(ageMinutes) });
    throw new Error(`La hora de emisión (${fecEmi} ${horEmi}, El Salvador) difiere ${Math.round(ageMinutes)} minutos de la hora actual. `
      + 'Vuelva a preparar la factura justo antes de transmitir (Hacienda tiene el código 34 «EXCEDE HOLGURA DE 30 MINUTOS»). No se transmitió.');
  }
  recordHaciendaDiagnostic('decision_envio', { transmitir: true, motivo: 'consulta_confirma_ausencia' });
  const response = await request('/fesv/recepciondte', JSON.stringify({
    ambiente: '00', idEnvio: Number(numeroControl.slice(-9)) || 1,
    version, tipoDte, documento: signature, codigoGeneracion,
  }), token);
  return { ...receptionResult(response, codigoGeneracion), reenvioEvitado: false };
}

export async function consultTestInvoice(document: FacturaPrueba, token: string) {
  const { codigoGeneracion, tipoDte } = validateTestInvoice(document).identificacion;
  const response = await request('/fesv/recepcion/consultadte', JSON.stringify({
    nitEmisor: document.emisor.nit, tdte: tipoDte, codigoGeneracion,
  }), token);
  return receptionResult(response, codigoGeneracion);
}
