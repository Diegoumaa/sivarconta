// Núcleo genérico de DTE para el ambiente de pruebas 00 (host apitest fijo).
// Valida contra los JSON Schemas oficiales, firma RS512 con el certificado de Hacienda,
// consulta antes de transmitir y aplica los mismos controles del adaptador de Factura 01.
import { createHash, createPrivateKey, createPublicKey, sign, timingSafeEqual, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Ajv, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { haciendaTokenProfile, missingApiAuthorityMessage, readCertificate, receptionResult, request } from './mhTest.js';
import { diagnosticHash, recordHaciendaDiagnostic } from './mhTestDiagnostics.js';

export type TipoDte = '01' | '03' | '05' | '06' | '14';
export type TipoEvento = 'invalidacion' | 'contingencia';

export const DTE_INFO: Record<TipoDte, { schema: string; version: number; nombre: string }> = {
  '01': { schema: 'fe-f-v2.json', version: 2, nombre: 'Factura' },
  '03': { schema: 'fe-ccf-v4.json', version: 4, nombre: 'Comprobante de Crédito Fiscal' },
  '05': { schema: 'fe-nc-v4.json', version: 4, nombre: 'Nota de Crédito' },
  '06': { schema: 'fe-nd-v4.json', version: 4, nombre: 'Nota de Débito' },
  '14': { schema: 'fe-fse-v2.json', version: 2, nombre: 'Factura de Sujeto Excluido' },
};
export const EVENT_INFO: Record<TipoEvento, { schema: string; version: number }> = {
  invalidacion: { schema: 'invalidacion-schema-v3.json', version: 3 },
  contingencia: { schema: 'contingencia-schema-v4.json', version: 4 },
};

const MAX_EMISSION_AGE_MINUTES = 25;
const UUID_V4 = /^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/;
const ajv = new Ajv({ allErrors: true, strict: false, multipleOfPrecision: 6 });
addFormats.default(ajv);
const compiled = new Map<string, ValidateFunction>();

function validatorFor(file: string) {
  let check = compiled.get(file);
  if (!check) {
    const schema = JSON.parse(readFileSync(new URL(`./mh-schemas/${file}`, import.meta.url), 'utf8').replace(/^﻿/, ''));
    check = ajv.compile(schema);
    compiled.set(file, check);
  }
  return check;
}

function assertSchema(file: string, document: unknown, label: string) {
  const check = validatorFor(file);
  if (!check(document)) {
    const issues = (check.errors || []).slice(0, 12).map(error => `${error.instancePath || '/'} ${error.message}`);
    recordHaciendaDiagnostic('esquema', { valido: false, documento: label, erroresCantidad: check.errors?.length || 0 });
    throw new Error(`El JSON no cumple el esquema oficial de ${label}. ${issues.join(' | ')}`);
  }
}

export interface DteDocument {
  identificacion: {
    version: number; ambiente: string; tipoDte: TipoDte; numeroControl: string; codigoGeneracion: string;
    tipoModelo: number; tipoOperacion: number; fecEmi: string; horEmi: string;
  };
  emisor: { nit: string };
  [key: string]: unknown;
}

export interface EventDocument {
  identificacion: { version: number; ambiente: string; codigoGeneracion: string };
  emisor: { nit: string };
  [key: string]: unknown;
}

export function validateDte(document: DteDocument): DteDocument {
  const tipo = document?.identificacion?.tipoDte;
  const info = DTE_INFO[tipo];
  if (!info) throw new Error('Tipo de DTE no admitido por el conector de pruebas.');
  assertSchema(info.schema, document, info.nombre);
  const { identificacion, emisor } = document;
  if (identificacion.ambiente !== '00') throw new Error('El ambiente del documento debe ser 00.');
  if (identificacion.version !== info.version) throw new Error(`La versión de ${info.nombre} debe ser ${info.version}.`);
  if (!UUID_V4.test(identificacion.codigoGeneracion)) throw new Error('El código de generación debe ser un UUID v4 en mayúsculas.');
  if (!/^\d{14}$/.test(emisor.nit)) throw new Error('El emisor debe tener un NIT de 14 dígitos sin guiones.');
  recordHaciendaDiagnostic('esquema', { valido: true, tipoDte: tipo, version: info.version, codigoGeneracion: identificacion.codigoGeneracion });
  return document;
}

export function validateEvent(kind: TipoEvento, document: EventDocument): EventDocument {
  const info = EVENT_INFO[kind];
  assertSchema(info.schema, document, kind === 'invalidacion' ? 'Evento de Invalidación' : 'Evento de Contingencia');
  if (document.identificacion.ambiente !== '00') throw new Error('El ambiente del evento debe ser 00.');
  if (document.identificacion.version !== info.version) throw new Error(`La versión del evento debe ser ${info.version}.`);
  if (!UUID_V4.test(document.identificacion.codigoGeneracion)) throw new Error('El código de generación del evento debe ser un UUID v4 en mayúsculas.');
  if (!/^\d{14}$/.test(document.emisor.nit)) throw new Error('El emisor debe tener un NIT de 14 dígitos sin guiones.');
  return document;
}

/** Firma RS512 (JWS compacto) idéntica al firmador oficial: cabecera {"alg":"RS512"} y payload JSON UTF-8. */
export function signJson(document: { emisor: { nit: string } }, xml: string, password: string) {
  const certificate = readCertificate(xml);
  if (certificate.get('nit')?.trim() !== document.emisor.nit || certificate.get('activo')?.trim() !== 'true') {
    throw new Error('El certificado local no está activo o su NIT no coincide con el emisor del JSON.');
  }
  const savedHash = certificate.get('privateKey/clave')?.trim() || '';
  const providedHash = createHash('sha512').update(password, 'utf8').digest();
  if (!/^[a-fA-F0-9]{128}$/.test(savedHash) || !timingSafeEqual(providedHash, Buffer.from(savedHash, 'hex'))) {
    throw new Error('La contraseña de firma no coincide con el certificado.');
  }
  const privateKey = createPrivateKey({ key: Buffer.from(certificate.get('privateKey/encodied') || '', 'base64'), format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey({ key: Buffer.from(certificate.get('publicKey/encodied') || '', 'base64'), format: 'der', type: 'spki' });
  const header = Buffer.from('{"alg":"RS512"}').toString('base64url');
  const payload = Buffer.from(JSON.stringify(document)).toString('base64url');
  const signingInput = Buffer.from(`${header}.${payload}`);
  const signature = sign('RSA-SHA512', signingInput, privateKey);
  if (!verify('RSA-SHA512', signingInput, publicKey, signature)) throw new Error('No se pudo verificar la firma con el certificado.');
  recordHaciendaDiagnostic('firma_local', { verificada: true, algoritmo: 'RS512', payloadSha256: diagnosticHash(Buffer.from(JSON.stringify(document))) });
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

export async function consultDte(tipoDte: TipoDte, nit: string, codigoGeneracion: string, token: string) {
  const response = await request('/fesv/recepcion/consultadte', JSON.stringify({ nitEmisor: nit, tdte: tipoDte, codigoGeneracion }), token);
  return receptionResult(response, codigoGeneracion);
}

const emissionInstant = (fecEmi: string, horEmi: string) => Date.parse(`${fecEmi}T${horEmi}-06:00`);

export interface TransmitDteOptions { ahora?: Date; idEnvio?: number }

/** Consulta previa → no reenvía sellados → exige ausencia (999) → USER_API → ventana horaria → recepción. */
export async function transmitDte(document: DteDocument, jws: string, token: string, options: TransmitDteOptions = {}) {
  const { codigoGeneracion, version, tipoDte, numeroControl, tipoModelo, tipoOperacion, fecEmi, horEmi } = validateDte(document).identificacion;
  const previous = await consultDte(tipoDte, document.emisor.nit, codigoGeneracion, token);
  if (previous.estado === 'PROCESADO') {
    recordHaciendaDiagnostic('decision_envio', { transmitir: false, motivo: 'sello_existente', tipoDte });
    return { ...previous, reenvioEvitado: true };
  }
  const absent = previous.http === 400 && previous.ambienteReportado === '00' && previous.codigoMsg === '999'
    && previous.codigoGeneracionReportado === null && previous.descripcionMsg === 'No se encontro ningun registro que coincida';
  if (!absent) {
    recordHaciendaDiagnostic('decision_envio', { transmitir: false, motivo: 'consulta_sin_ausencia_confirmada', tipoDte });
    throw new Error(`La consulta previa no confirmó ausencia del DTE (HTTP ${previous.http}, código ${previous.codigoMsg || 'sin código'}). No se reenvió.`);
  }
  const profile = haciendaTokenProfile(token);
  if (!profile.usuarioApi) throw new Error(missingApiAuthorityMessage(profile));
  const ageMinutes = ((options.ahora ?? new Date()).getTime() - emissionInstant(fecEmi, horEmi)) / 60_000;
  if (tipoModelo === 1 && tipoOperacion === 1 && !(Math.abs(ageMinutes) <= MAX_EMISSION_AGE_MINUTES)) {
    throw new Error(`La hora de emisión difiere ${Math.round(ageMinutes)} minutos de la actual. Prepare el documento justo antes de transmitir. No se transmitió.`);
  }
  recordHaciendaDiagnostic('decision_envio', { transmitir: true, motivo: 'consulta_confirma_ausencia', tipoDte });
  const response = await request('/fesv/recepciondte', JSON.stringify({
    ambiente: '00', idEnvio: options.idEnvio ?? (Number(numeroControl.slice(-9)) || 1), version, tipoDte, documento: jws, codigoGeneracion,
  }), token);
  return { ...receptionResult(response, codigoGeneracion), reenvioEvitado: false };
}

function eventResult({ status, ok, json }: Awaited<ReturnType<typeof request>>, expectedCodes: string[]) {
  const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 500) : null;
  const stamp = text(json?.selloRecibido);
  const codeOk = json?.codigoGeneracion == null || expectedCodes.includes(String(json.codigoGeneracion).trim().toUpperCase());
  const accepted = ok && ['PROCESADO', 'RECIBIDO'].includes(json?.estado) && !!stamp && /^[A-Z0-9]{40}$/i.test(stamp)
    && (json?.ambiente === undefined || json?.ambiente === '00') && codeOk;
  return {
    http: status, estadoReportado: text(json?.estado), estado: accepted ? 'PROCESADO' : json?.estado === 'RECHAZADO' ? 'RECHAZADO' : 'SIN_CONFIRMAR',
    selloRecibido: accepted ? stamp : null, codigoGeneracionReportado: text(json?.codigoGeneracion),
    fhProcesamiento: text(json?.fhProcesamiento ?? json?.fechaHora), codigoMsg: text(json?.codigoMsg),
    descripcionMsg: text(json?.descripcionMsg ?? json?.mensaje),
    observaciones: Array.isArray(json?.observaciones) ? json.observaciones.slice(0, 20).map(text).filter(Boolean) : [],
  };
}

/** Evento de invalidación: POST /fesv/anulardte con {ambiente, idEnvio, version, documento}. */
export async function transmitInvalidacion(event: EventDocument & { documento: { codigoGeneracion: string } }, jws: string, token: string, idEnvio = 1) {
  validateEvent('invalidacion', event);
  const profile = haciendaTokenProfile(token);
  if (!profile.usuarioApi) throw new Error(missingApiAuthorityMessage(profile));
  const response = await request('/fesv/anulardte', JSON.stringify({ ambiente: '00', idEnvio, version: EVENT_INFO.invalidacion.version, documento: jws }), token);
  return eventResult(response, [event.identificacion.codigoGeneracion, event.documento.codigoGeneracion]);
}

/** Evento de contingencia: POST /fesv/contingencia con {nit, documento}. Responde estado/fechaHora/mensaje/sello. */
export async function transmitContingencia(event: EventDocument, jws: string, token: string) {
  validateEvent('contingencia', event);
  const profile = haciendaTokenProfile(token);
  if (!profile.usuarioApi) throw new Error(missingApiAuthorityMessage(profile));
  const response = await request('/fesv/contingencia', JSON.stringify({ nit: event.emisor.nit, documento: jws }), token);
  return eventResult(response, [event.identificacion.codigoGeneracion]);
}
