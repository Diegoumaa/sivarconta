import type { InvoiceDocument } from '../src/types/index.js';
import { isTeamId } from '../src/types/companyTeam.js';
import { MhDatoFaltante, prepareAppDte, type AppDteContext } from './mhAppDte.js';
import type { DteDocument } from './mhDte.js';
import { buildInvalidacion, type EmisorDte } from './mhDteBuilders.js';
import { haciendaTokenProfile, missingApiAuthorityMessage, type FacturaPrueba } from './mhTest.js';

export type MhResult = Awaited<ReturnType<typeof import('./mhTest.js').consultTestInvoice>>;
export type MhDocument = FacturaPrueba | DteDocument;
export type MhEventResult = Awaited<ReturnType<typeof import('./mhDte.js').transmitInvalidacion>>;
export interface MhReservation {
  invoice: InvoiceDocument; nit: string; lease: string;
  state: 'PREPARADO' | 'ENVIO_INCIERTO' | 'PROCESADO' | 'RECHAZADO';
  document: MhDocument | null; response: MhResult | null;
}
export interface MhInvalidationReservation {
  invoice: InvoiceDocument; nit: string; lease: string; eventCode: string;
  state: 'PREPARADO' | 'ENVIO_INCIERTO' | 'PROCESADO' | 'RECHAZADO';
  dteDocument: Record<string, any> | null; event: Record<string, any> | null; response: Record<string, any> | null;
}
/** Datos del receptor que el usuario completa en el panel cuando faltan (se validan con el catálogo oficial). */
export interface ClientOverrides { distrito?: string; actividad?: string }
export interface MhAppDependencies {
  available: boolean; companyId: string; nit: string; issuer: Record<string, any>;
  authenticateUser(token: string): Promise<string | null>;
  reserve(company: string, invoice: string, actor: string): Promise<MhReservation>;
  prepare(invoice: string, lease: string, document: MhDocument): Promise<void>;
  start(invoice: string, lease: string): Promise<void>;
  finish(invoice: string, lease: string, result: Partial<MhResult>): Promise<InvoiceDocument>;
  /** Devuelve a BORRADOR una reserva cuyo JSON nunca se congeló ni se envió (faltaban datos). */
  release?(invoice: string, lease: string, reason: Partial<MhResult>): Promise<InvoiceDocument>;
  authenticateHacienda(): Promise<string>;
  sign(document: MhDocument): string;
  consult(document: MhDocument, token: string): Promise<MhResult>;
  transmit(document: MhDocument, signature: string, token: string): Promise<MhResult>;
  /** CCF, notas y FSE: datos del cliente y del CCF relacionado leídos en el servidor. */
  loadContext?(invoice: InvoiceDocument, overrides: ClientOverrides): Promise<AppDteContext>;
  reserveInvalidation?(company: string, invoice: string, actor: string): Promise<MhInvalidationReservation>;
  prepareInvalidation?(invoice: string, lease: string, event: Record<string, unknown>): Promise<void>;
  startInvalidation?(invoice: string, lease: string): Promise<void>;
  finishInvalidation?(invoice: string, lease: string, result: Partial<MhEventResult>): Promise<InvoiceDocument>;
  signEvent?(event: Record<string, unknown>): string;
  transmitInvalidation?(event: Record<string, unknown>, signature: string, token: string): Promise<MhEventResult>;
  now?: () => Date;
}
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const absent = (result: MhResult) => result.http === 400 && result.ambienteReportado === '00' && result.codigoMsg === '999'
  && result.codigoGeneracionReportado === null && result.descripcionMsg === 'No se encontro ningun registro que coincida';
const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

export async function handleMhTestEmission(request: Request, deps: MhAppDependencies): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método no admitido.' }, 405);
  const token = request.headers.get('authorization')?.match(/^Bearer ([\w.-]+)$/i)?.[1];
  if (!token) return json({ error: 'Inicia sesión para transmitir.' }, 401);
  if (!deps.available) return json({ error: 'La conexión de pruebas de Hacienda no está configurada en este servidor.' }, 503);
  let reservation: MhReservation | undefined;
  let result: Partial<MhResult> = { estado: 'SIN_CONFIRMAR', ambiente: '00', descripcionMsg: 'Consulta el estado antes de continuar.' };
  try {
    const actor = await deps.authenticateUser(token);
    if (!actor) return json({ error: 'Tu sesión venció. Vuelve a iniciar sesión.' }, 401);
    const raw = await request.text();
    if (raw.length > 2000) return json({ error: 'La solicitud supera el tamaño admitido.' }, 413);
    const input = JSON.parse(raw);
    if (!input || !isTeamId(input.invoiceId) || !isTeamId(input.companyId) || !['transmitir', 'consultar', 'invalidar'].includes(input.action)) {
      return json({ error: 'Selecciona un documento y una acción válidos.' }, 400);
    }
    const overrides: ClientOverrides = {};
    if (input.distrito !== undefined) {
      if (typeof input.distrito !== 'string' || !/^\d{2}$/.test(input.distrito)) return json({ error: 'Distrito no válido.' }, 400);
      overrides.distrito = input.distrito;
    }
    if (input.actividad !== undefined) {
      if (typeof input.actividad !== 'string' || !/^\d{5,6}$/.test(input.actividad.trim())) return json({ error: 'Indica el código numérico de actividad económica (CAT-019).' }, 400);
      overrides.actividad = input.actividad.trim();
    }
    if (input.companyId !== deps.companyId) return json({ error: 'Esta conexión de pruebas está habilitada para una sola empresa.' }, 403);
    if (input.action === 'invalidar') return await handleInvalidation(input, actor, deps);
    reservation = await deps.reserve(input.companyId, input.invoiceId, actor);
    const { invoice, lease } = reservation;
    if (reservation.nit.replace(/-/g, '') !== deps.nit || deps.issuer.nit !== deps.nit) {
      throw new Error('mh_issuer_mismatch');
    }
    // A new emission gets a server UUID and an atomic control. Retries keep exactly that identity.
    let document = reservation.document;
    if (reservation.state === 'PREPARADO') {
      try {
        const context = invoice.dteType === '01' ? {} : (await deps.loadContext?.(invoice, overrides)) || {};
        document = prepareAppDte(invoice, deps.issuer, deps.now?.() || new Date(), context);
      } catch (error) {
        // Nada llegó a Hacienda: si el JSON nunca se congeló, el documento vuelve a BORRADOR para corregirlo.
        result = { ...result, descripcionMsg: error instanceof MhDatoFaltante ? error.message
          : `El documento no cumple el formato oficial: ${error instanceof Error ? error.message.slice(0, 300) : 'revisa el borrador guardado.'}` };
        const saved = deps.release && !reservation.document
          ? await deps.release(invoice.id, lease, result) : await deps.finish(invoice.id, lease, result);
        reservation = undefined;
        return json({ invoice: saved, error: result.descripcionMsg, campo: error instanceof MhDatoFaltante ? error.campo : undefined }, 422);
      }
      await deps.prepare(invoice.id, lease, document);
    }
    if (!document) throw new Error('mh_missing_document');
    const mhToken = await deps.authenticateHacienda();
    const profile = haciendaTokenProfile(mhToken);
    if (!profile.usuarioApi) {
      result = { ...result, descripcionMsg: missingApiAuthorityMessage(profile), codigoMsg: '094' };
      const saved = await deps.finish(invoice.id, lease, result); reservation = undefined;
      return json({ invoice: saved, error: result.descripcionMsg }, 409);
    }
    const previous = await deps.consult(document, mhToken);
    result = previous;
    if (previous.estado === 'PROCESADO' || previous.estado === 'RECHAZADO') {
      const saved = await deps.finish(invoice.id, lease, previous); reservation = undefined;
      return json({ invoice: saved, confirmed: previous.estado === 'PROCESADO', resent: false });
    }
    // A started request is ambiguous after a timeout/crash. Query-only recovery NEVER retransmits it.
    if (reservation.state !== 'PREPARADO' || input.action === 'consultar' || !absent(previous)) {
      const saved = await deps.finish(invoice.id, lease, previous); reservation = undefined;
      return json({ invoice: saved, confirmed: false, message: 'Aún no hay sello confirmado. Se consultó el UUID; no se volvió a transmitir.' }, 202);
    }
    const signature = deps.sign(document);
    // Durable marker before the HTTP request: concurrent clicks and process crashes cannot resend.
    await deps.start(invoice.id, lease);
    const reception = await deps.transmit(document, signature, mhToken);
    // A receipt alone is insufficient. Independent authentication + query must confirm its seal.
    result = { ...reception, estado: 'SIN_CONFIRMAR', selloRecibido: null };
    const queryToken = await deps.authenticateHacienda();
    const confirmed = await deps.consult(document, queryToken);
    if (confirmed.estado === 'PROCESADO' && reception.estado === 'PROCESADO' && confirmed.selloRecibido !== reception.selloRecibido) {
      throw new Error('mh_seal_mismatch');
    }
    result = confirmed.estado === 'PROCESADO'
      ? { ...confirmed, fhProcesamiento: confirmed.fhProcesamiento || reception.fhProcesamiento }
      : { ...reception, estado: reception.estado === 'RECHAZADO' ? 'RECHAZADO' : 'SIN_CONFIRMAR', selloRecibido: null };
    const saved = await deps.finish(invoice.id, lease, result); reservation = undefined;
    return json({ invoice: saved, confirmed: result.estado === 'PROCESADO', resent: false }, result.estado === 'SIN_CONFIRMAR' ? 202 : 200);
  } catch (error) {
    const detail = error as { code?: string; message?: string };
    let saved: InvoiceDocument | undefined;
    if (reservation) {
      // If persistence itself fails, the lease expires; the next request recovers by consulting the same UUID.
      try { saved = await deps.finish(reservation.invoice.id, reservation.lease, result); } catch { /* No secrets or raw SDK errors in logs/responses. */ }
    }
    return errorResponse(error, detail, saved);
  }
}

function errorResponse(error: unknown, detail: { code?: string; message?: string }, saved?: InvoiceDocument) {
  if (error instanceof SyntaxError) return json({ error: 'La solicitud no es válida.' }, 400);
  if (detail.code === '42501') return json({ error: 'Solo el propietario, administrador o facturador de esta empresa puede emitir o invalidar.' }, 403);
  if (detail.code === '55P03') return json({ error: 'Este documento ya se está verificando. Espera y consulta su estado.' }, 409);
  if (detail.message === 'mh_test_only') return json({ error: 'Solo se permite el ambiente de pruebas 00.' }, 409);
  if (detail.message === 'mh_type_unsupported') return json({ error: 'Este tipo de documento no se transmite desde la aplicación.' }, 422);
  if (detail.message === 'mh_not_draft') return json({ error: 'El documento no es un borrador disponible para transmitir.' }, 409);
  if (detail.message === 'mh_not_accepted') return json({ error: 'Solo se puede invalidar un documento aceptado por Hacienda en el ambiente 00.' }, 409);
  return json({ invoice: saved, error: 'No se pudo confirmar la operación. Consulta el estado del mismo documento antes de continuar; no crees otro documento para reintentar.' }, 503);
}

/**
 * Evento de invalidación (v3) en el ambiente 00. Por defecto tipo 2 (rescindir la operación, sin documento de reemplazo).
 * Tipos 1 y 3 exigen el código de generación del documento de reemplazo ya sellado (excepto Nota de Crédito).
 */
async function handleInvalidation(input: Record<string, any>, actor: string, deps: MhAppDependencies): Promise<Response> {
  if (!deps.reserveInvalidation || !deps.prepareInvalidation || !deps.startInvalidation || !deps.finishInvalidation || !deps.signEvent || !deps.transmitInvalidation) {
    return json({ error: 'La invalidación no está habilitada en este servidor.' }, 503);
  }
  const tipo = input.tipoAnulacion === undefined ? 2 : Number(input.tipoAnulacion);
  if (![1, 2, 3].includes(tipo)) return json({ error: 'Tipo de invalidación no válido.' }, 400);
  const motivo = typeof input.motivo === 'string' ? input.motivo.trim() : '';
  if (motivo.length < 5 || motivo.length > 200) return json({ error: 'Describe el motivo de la invalidación (5 a 200 caracteres).' }, 400);
  const reemplazo = input.reemplazo ? String(input.reemplazo).toUpperCase() : null;
  if (reemplazo && !UUID.test(reemplazo)) return json({ error: 'El código del documento de reemplazo no es válido.' }, 400);
  let reservation: MhInvalidationReservation | undefined;
  let result: Partial<MhEventResult> = { estado: 'SIN_CONFIRMAR', selloRecibido: null, descripcionMsg: 'Invalidación sin confirmar.' };
  try {
    reservation = await deps.reserveInvalidation(input.companyId, input.invoiceId, actor);
    const { invoice, lease } = reservation;
    if (reservation.state === 'PROCESADO') {
      const saved = await deps.finishInvalidation(invoice.id, lease, reservation.response || {}); reservation = undefined;
      return json({ invoice: saved, confirmed: true, message: 'La invalidación ya estaba registrada en Hacienda.' });
    }
    const dte = reservation.dteDocument;
    if (!dte || !invoice.mhReceptionStamp) throw new Error('mh_not_accepted');
    if (tipo !== 2 && !reemplazo && invoice.dteType !== '05') {
      throw Object.assign(new Error('Para los tipos 1 y 3 primero emite y transmite el documento que reemplaza al invalidado.'), { user: true });
    }
    let event = reservation.event;
    if (!event) {
      const issuer = deps.issuer as EmisorDte;
      const emisor: EmisorDte = { ...issuer, codEstable: invoice.establishmentCode, codPuntoVenta: invoice.posCode };
      const r = dte.receptor || null;
      const receptor = r ? { tipoDocumento: r.tipoDocumento ?? (r.nit ? '36' : null), numDocumento: r.numDocumento ?? r.nit ?? null,
        nombre: r.nombre ?? null, telefono: r.telefono ?? null, correo: r.correo ?? null } : undefined;
      const responsable = { nombre: String(issuer.nombre).slice(0, 100), tipoDocumento: '36', numDocumento: deps.nit };
      event = buildInvalidacion(reservation.eventCode.toUpperCase(), deps.now?.() || new Date(), emisor, {
        tipoDte: invoice.dteType, codigoGeneracion: invoice.generationCode.toUpperCase(), selloRecibido: invoice.mhReceptionStamp,
        numeroControl: invoice.controlNumber, fecEmi: dte.identificacion?.fecEmi || invoice.emissionDate, receptor,
      }, tipo as 1 | 2 | 3, tipo === 2 ? null : reemplazo, motivo, responsable, responsable) as unknown as Record<string, any>;
      await deps.prepareInvalidation(invoice.id, lease, event);
    }
    const mhToken = await deps.authenticateHacienda();
    const profile = haciendaTokenProfile(mhToken);
    if (!profile.usuarioApi) {
      result = { ...result, descripcionMsg: missingApiAuthorityMessage(profile), codigoMsg: '094' };
      const saved = await deps.finishInvalidation(invoice.id, lease, result); reservation = undefined;
      return json({ invoice: saved, error: result.descripcionMsg }, 409);
    }
    const signature = deps.signEvent(event);
    const reintento = reservation.state === 'ENVIO_INCIERTO';
    await deps.startInvalidation(invoice.id, lease);
    result = await deps.transmitInvalidation(event, signature, mhToken);
    // /consultadte no refleja invalidaciones (verificado el 11/11/2026). Si un envío anterior quedó incierto y el
    // reenvío del MISMO evento se rechaza, puede ser porque ya se aplicó: no se descarta, se pide verificarlo.
    if (reintento && result.estado === 'RECHAZADO') {
      result = { ...result, estado: 'SIN_CONFIRMAR', selloRecibido: null,
        descripcionMsg: `Hacienda rechazó el reenvío (${result.codigoMsg || 'sin código'} ${result.descripcionMsg || ''}). Verifica en la consulta pública si el documento ya figura como «Invalidado» antes de intentar de nuevo.`.slice(0, 500) };
    }
    const saved = await deps.finishInvalidation(invoice.id, lease, result); reservation = undefined;
    return json({ invoice: saved, confirmed: result.estado === 'PROCESADO',
      message: result.estado === 'PROCESADO' ? 'Documento invalidado en Hacienda (ambiente 00).' : undefined,
      error: result.estado === 'PROCESADO' ? undefined : `Hacienda no aceptó la invalidación: ${result.codigoMsg || ''} ${result.descripcionMsg || ''}`.trim() },
      result.estado === 'PROCESADO' ? 200 : 422);
  } catch (error) {
    const detail = error as { code?: string; message?: string; user?: boolean };
    let saved: InvoiceDocument | undefined;
    if (reservation) { try { saved = await deps.finishInvalidation(reservation.invoice.id, reservation.lease, result); } catch { /* sin detalles */ } }
    if (detail.user) return json({ invoice: saved, error: detail.message }, 422);
    return errorResponse(error, detail, saved);
  }
}
