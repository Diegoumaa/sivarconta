// Constructores de DTE y eventos según los JSON Schemas oficiales publicados por Hacienda (11/08/2026):
// Factura 01 v2, CCF 03 v4, Nota de Crédito 05 v4, Nota de Débito 06 v4, Sujeto Excluido 14 v2,
// Evento de Invalidación v3 y Evento de Contingencia v4. Solo ambiente 00.
import type { DteDocument, EventDocument } from './mhDte.js';

export interface Direccion { departamento: string; municipio: string; distrito: string; complemento: string }
export interface EmisorDte {
  nit: string; nrc: string; nombre: string; codActividad: string; descActividad: string; nombreComercial: string | null;
  direccion: Direccion; telefono: string; correo: string; codEstable: string; codPuntoVenta: string;
}
export interface Contribuyente {
  nit: string; nrc: string; nombre: string; codActividad: string; descActividad: string; nombreComercial: string | null;
  direccion: Direccion; telefono: string | null; correo: string | null;
}
export interface SujetoExcluido {
  tipoDocumento: string; numDocumento: string; nombre: string; codActividad: string | null; descActividad: string | null;
  direccion: Direccion; telefono: string | null; correo: string | null;
}
export type TipoVenta = 'GRAVADO' | 'EXENTO' | 'NO_SUJETO';
export interface Linea {
  descripcion: string; cantidad: number; precioUni: number; uniMedida?: number; tipoItem?: 1 | 2;
  descuento?: number; tipo?: TipoVenta; codigo?: string | null;
}
export interface Contingencia { tipo: 1 | 2 | 3 | 4 | 5; motivo: string | null }
export interface Identidad { codigoGeneracion: string; numeroControl: string; ahora: Date; contingencia?: Contingencia }
export interface Pago { condicion: 1 | 2; codigo?: string; plazoDias?: number }
export interface DocRelacionado { tipoDte: '03'; codigoGeneracion: string; fecEmi: string }

const IVA = 0.13;
const IVA_DESC = 'Impuesto al Valor Agregado 13%';
export const r2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
export const r8 = (n: number) => Number(n.toFixed(8));

export function fechaHoraSV(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}:${p.second}` };
}

export function numeroControl(tipoDte: string, establecimiento: string, puntoVenta: string, correlativo: number) {
  if (!/^[MBSP]\d{3}$/.test(establecimiento) || !/^P\d{3}$/.test(puntoVenta)) throw new Error('Establecimiento o punto de venta inválido.');
  if (!Number.isSafeInteger(correlativo) || correlativo < 1 || correlativo > 999999999999999) throw new Error('Correlativo inválido.');
  return `DTE-${tipoDte}-${establecimiento}${puntoVenta}-${String(correlativo).padStart(15, '0')}`;
}

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE',
  'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS',
  'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
function grupo(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100); const resto = n % 100;
  const partes = [CENTENAS[c]];
  if (resto < 30) partes.push(UNIDADES[resto]);
  else partes.push(DECENAS[Math.floor(resto / 10)] + (resto % 10 ? ` Y ${UNIDADES[resto % 10]}` : ''));
  return partes.filter(Boolean).join(' ');
}
export function montoEnLetras(monto: number) {
  const centavos = Math.round(r2(monto) * 100);
  const entero = Math.floor(centavos / 100);
  const cents = String(centavos % 100).padStart(2, '0');
  let palabras: string;
  if (entero === 0) palabras = 'CERO';
  else if (entero < 1000) palabras = grupo(entero);
  else if (entero < 1_000_000) {
    const miles = Math.floor(entero / 1000);
    palabras = `${miles === 1 ? 'MIL' : `${grupo(miles)} MIL`} ${grupo(entero % 1000)}`.trim();
  } else palabras = String(entero);
  return `${palabras} ${entero === 1 ? 'DÓLAR' : 'DÓLARES'} CON ${cents}/100 USD`;
}

function identificacion(tipoDte: string, version: number, id: Identidad, extra: Record<string, unknown> = {}) {
  const { fecha, hora } = fechaHoraSV(id.ahora);
  const c = id.contingencia;
  return {
    version, ambiente: '00', tipoDte, numeroControl: id.numeroControl, codigoGeneracion: id.codigoGeneracion,
    tipoModelo: c ? 2 : 1, tipoOperacion: c ? 2 : 1, tipoContingencia: c ? c.tipo : null, motivoContin: c ? c.motivo : null,
    fecEmi: fecha, horEmi: hora, tipoMoneda: 'USD', ...extra,
  };
}

function pagos(total: number, pago: Pago) {
  const credito = pago.condicion === 2;
  return [{ codigo: credito ? null : (pago.codigo || '01'), montoPago: total, referencia: null,
    plazo: credito ? '01' : null, periodo: credito ? (pago.plazoDias || 30) : null }];
}

function lineAmounts(l: Linea) {
  const descuento = l.descuento || 0;
  const neto = r8(l.cantidad * l.precioUni - descuento);
  if (!(neto > 0) || descuento < 0) throw new Error(`Importe inválido en la partida «${l.descripcion}».`);
  const tipo = l.tipo || 'GRAVADO';
  return { neto, descuento, tipo, ventaNoSuj: tipo === 'NO_SUJETO' ? neto : 0, ventaExenta: tipo === 'EXENTO' ? neto : 0, ventaGravada: tipo === 'GRAVADO' ? neto : 0 };
}

const sum = <T>(rows: T[], pick: (row: T) => number) => r2(rows.reduce((n, row) => n + pick(row), 0));

const emisorBase = (e: EmisorDte) => ({ nit: e.nit, nrc: e.nrc, nombre: e.nombre, codActividad: e.codActividad, descActividad: e.descActividad,
  nombreComercial: e.nombreComercial, direccion: e.direccion, telefono: e.telefono, correo: e.correo });

/** Factura 01 v2. precioUni incluye IVA (13/113). Receptor opcional (consumidor final sin identificar si es null). */
export function buildFactura(id: Identidad, emisor: EmisorDte, receptor: Record<string, unknown> | null, lineas: Linea[], pago: Pago, observaciones: string): DteDocument {
  const items = lineas.map((l, i) => {
    const a = lineAmounts(l);
    return { numItem: i + 1, tipoItem: l.tipoItem || 2, numeroDocumento: null, codigo: l.codigo || null, codTributo: null,
      descripcion: l.descripcion, cantidad: l.cantidad, uniMedida: l.uniMedida || 99, precioUni: l.precioUni, montoDescu: a.descuento,
      ventaNoSuj: a.ventaNoSuj, ventaExenta: a.ventaExenta, ventaGravada: a.ventaGravada, tributos: null, psv: 0, noGravado: 0,
      ivaItem: a.tipo === 'GRAVADO' ? r8(a.neto * 13 / 113) : 0 };
  });
  const totalNoSuj = sum(items, x => x.ventaNoSuj), totalExenta = sum(items, x => x.ventaExenta), totalGravada = sum(items, x => x.ventaGravada);
  const subTotalVentas = r2(totalNoSuj + totalExenta + totalGravada);
  if (subTotalVentas >= 25000 && !receptor) throw new Error('Una factura de $25,000 o más requiere receptor identificado.');
  return {
    identificacion: identificacion('01', 2, id), documentoRelacionado: null,
    emisor: { ...emisorBase(emisor), codEstable: emisor.codEstable, codPuntoVenta: emisor.codPuntoVenta },
    receptor, otrosDocumentos: null, ventaTercero: null, cuerpoDocumento: items,
    resumen: { totalNoSuj, totalExenta, totalGravada, subTotalVentas, descuNoSuj: 0, descuExenta: 0, descuGravada: 0,
      porcentajeDescuento: 0, totalDescu: sum(items, x => x.montoDescu), tributos: null, subTotal: subTotalVentas, ivaRete: 0,
      montoTotalOperacion: subTotalVentas, totalNoGravado: 0, totalPagar: subTotalVentas, totalLetras: montoEnLetras(subTotalVentas),
      totalIva: sum(items, x => x.ivaItem), saldoFavor: 0, condicionOperacion: pago.condicion, pagos: pagos(subTotalVentas, pago),
      numPagoElectronico: null, observaciones },
    apendice: null,
  } as unknown as DteDocument;
}

/** Receptor de Factura 01 a partir de un contribuyente (identificado por NIT). */
export function receptorFactura(c: Contribuyente) {
  return { tipoDocumento: '36', numDocumento: c.nit, nrc: c.nrc, nombre: c.nombre, codActividad: c.codActividad,
    descActividad: c.descActividad, direccion: c.direccion, telefono: c.telefono, correo: c.correo };
}

export interface Retenciones { ivaRete?: number; ivaPerci?: number }

/** Comprobante de Crédito Fiscal 03 v4. precioUni SIN IVA; IVA 13% en resumen.tributos (código 20). */
export function buildCcf(id: Identidad, emisor: EmisorDte, receptor: Contribuyente, lineas: Linea[], pago: Pago, observaciones: string,
  retenciones: Retenciones = {}): DteDocument {
  const items = lineas.map((l, i) => {
    const a = lineAmounts(l);
    return { numItem: i + 1, tipoItem: l.tipoItem || 2, numeroDocumento: null, codigo: l.codigo || null, codTributo: null,
      descripcion: l.descripcion, cantidad: l.cantidad, uniMedida: l.uniMedida || 99, precioUni: l.precioUni, montoDescu: a.descuento,
      ventaNoSuj: a.ventaNoSuj, ventaExenta: a.ventaExenta, ventaGravada: a.ventaGravada,
      tributos: a.tipo === 'GRAVADO' ? ['20'] : null, psv: 0, noGravado: 0 };
  });
  const totalNoSuj = sum(items, x => x.ventaNoSuj), totalExenta = sum(items, x => x.ventaExenta), totalGravada = sum(items, x => x.ventaGravada);
  const subTotalVentas = r2(totalNoSuj + totalExenta + totalGravada);
  const iva = r2(totalGravada * IVA);
  const montoTotalOperacion = r2(subTotalVentas + iva);
  const ivaRete = r2(retenciones.ivaRete || 0), ivaPerci = r2(retenciones.ivaPerci || 0);
  const totalPagar = r2(montoTotalOperacion - ivaRete + ivaPerci);
  return {
    identificacion: identificacion('03', 4, id), documentoRelacionado: null,
    emisor: { ...emisorBase(emisor), codEstable: emisor.codEstable, codPuntoVenta: emisor.codPuntoVenta },
    receptor: { nit: receptor.nit, nrc: receptor.nrc, nombre: receptor.nombre, codActividad: receptor.codActividad,
      descActividad: receptor.descActividad, nombreComercial: receptor.nombreComercial, direccion: receptor.direccion,
      telefono: receptor.telefono, correo: receptor.correo },
    otrosDocumentos: null, ventaTercero: null, cuerpoDocumento: items,
    resumen: { totalNoSuj, totalExenta, totalGravada, subTotalVentas, descuNoSuj: 0, descuExenta: 0, descuGravada: 0,
      porcentajeDescuento: 0, totalDescu: sum(items, x => x.montoDescu),
      tributos: totalGravada > 0 ? [{ codigo: '20', descripcion: IVA_DESC, valor: iva }] : null,
      subTotal: subTotalVentas, ivaPerci, ivaRete, montoTotalOperacion, totalNoGravado: 0, totalPagar,
      totalLetras: montoEnLetras(totalPagar), saldoFavor: 0, condicionOperacion: pago.condicion,
      pagos: pagos(totalPagar, pago), numPagoElectronico: null, observaciones },
    apendice: null,
  } as unknown as DteDocument;
}

function buildNota(tipoDte: '05' | '06', id: Identidad, emisor: EmisorDte, receptor: Contribuyente, relacionado: DocRelacionado,
  lineas: Linea[], condicion: 1 | 2, observaciones: string): DteDocument {
  const items = lineas.map((l, i) => {
    const a = lineAmounts(l);
    return { numItem: i + 1, tipoItem: l.tipoItem || 2, numeroDocumento: relacionado.codigoGeneracion, cantidad: l.cantidad,
      codigo: l.codigo || null, codTributo: null, uniMedida: l.uniMedida || 99, descripcion: l.descripcion, precioUni: l.precioUni,
      montoDescu: a.descuento, ventaNoSuj: a.ventaNoSuj, ventaExenta: a.ventaExenta, ventaGravada: a.ventaGravada,
      // Validado contra Hacienda (11/11/2026): con IVA en tributos (código 20), totalIva debe ser 0.
      tributos: a.tipo === 'GRAVADO' ? ['20'] : null, noGravado: 0, ivaPerci: 0, totalIva: 0, ivaRete: 0 };
  });
  const totalNoSuj = sum(items, x => x.ventaNoSuj), totalExenta = sum(items, x => x.ventaExenta), totalGravada = sum(items, x => x.ventaGravada);
  const subTotalVentas = r2(totalNoSuj + totalExenta + totalGravada);
  const iva = r2(totalGravada * IVA);
  const montoTotalOperacion = r2(subTotalVentas + iva);
  const resumen: Record<string, unknown> = { totalNoSuj, totalExenta, totalGravada, subTotalVentas, totalDescu: sum(items, x => x.montoDescu),
    tributos: totalGravada > 0 ? [{ codigo: '20', descripcion: IVA_DESC, valor: iva }] : null, montoTotalOperacion,
    ivaPerci: 0, totalIva: 0, ivaRete: 0, totalNoGravado: 0, totalPagar: montoTotalOperacion,
    totalLetras: montoEnLetras(montoTotalOperacion), condicionOperacion: condicion, observaciones, codigoRetencionMH: null };
  if (tipoDte === '06') resumen.numPagoElectronico = null;
  return {
    identificacion: identificacion(tipoDte, 4, id, { fusion: null }),
    documentoRelacionado: [{ tipoDocumento: relacionado.tipoDte, tipoGeneracion: 2, numeroDocumento: relacionado.codigoGeneracion, fechaEmision: relacionado.fecEmi }],
    emisor: emisorBase(emisor),
    receptor: { tipoDocumento: '36', numDocumento: receptor.nit, nrc: receptor.nrc, nombre: receptor.nombre, codActividad: receptor.codActividad,
      descActividad: receptor.descActividad, nombreComercial: receptor.nombreComercial, direccion: receptor.direccion,
      telefono: receptor.telefono, correo: receptor.correo },
    ventaTercero: null, cuerpoDocumento: items, resumen, apendice: null,
  } as unknown as DteDocument;
}

export const buildNotaCredito = (id: Identidad, e: EmisorDte, r: Contribuyente, rel: DocRelacionado, l: Linea[], c: 1 | 2, o: string) => buildNota('05', id, e, r, rel, l, c, o);
export const buildNotaDebito = (id: Identidad, e: EmisorDte, r: Contribuyente, rel: DocRelacionado, l: Linea[], c: 1 | 2, o: string) => buildNota('06', id, e, r, rel, l, c, o);

/** Factura de Sujeto Excluido 14 v2. reteRenta: true = 10% del total; número = monto exacto calculado por la app. */
export function buildFse(id: Identidad, emisor: EmisorDte, sujeto: SujetoExcluido, lineas: Linea[], pago: Pago, retenerRenta: boolean | number, observaciones: string): DteDocument {
  const items = lineas.map((l, i) => {
    const descuento = l.descuento || 0;
    const compra = r8(l.cantidad * l.precioUni - descuento);
    if (!(compra > 0)) throw new Error(`Importe inválido en la partida «${l.descripcion}».`);
    return { numItem: i + 1, tipoItem: l.tipoItem || 2, cantidad: l.cantidad, codigo: l.codigo || null, uniMedida: l.uniMedida || 99,
      descripcion: l.descripcion, precioUni: l.precioUni, montoDescu: descuento, compra };
  });
  const totalCompra = sum(items, x => x.compra);
  const reteRenta = typeof retenerRenta === 'number' ? r2(retenerRenta) : retenerRenta ? r2(totalCompra * 0.10) : 0;
  if (reteRenta < 0 || reteRenta > totalCompra) throw new Error('La retención de renta no puede superar el total de la compra.');
  const totalPagar = r2(totalCompra - reteRenta);
  return {
    identificacion: identificacion('14', 2, id),
    emisor: { nit: emisor.nit, nrc: emisor.nrc, nombre: emisor.nombre, codActividad: emisor.codActividad, descActividad: emisor.descActividad,
      direccion: emisor.direccion, telefono: emisor.telefono, codEstable: emisor.codEstable, codPuntoVenta: emisor.codPuntoVenta, correo: emisor.correo },
    receptor: sujeto, cuerpoDocumento: items,
    resumen: { totalCompra, descu: 0, totalDescu: sum(items, x => x.montoDescu), subTotal: totalCompra, reteRenta, totalPagar,
      totalLetras: montoEnLetras(totalPagar), condicionOperacion: pago.condicion, pagos: pagos(totalPagar, pago), observaciones },
    apendice: null,
  } as unknown as DteDocument;
}

export interface Responsable { nombre: string; tipoDocumento: string; numDocumento: string }
export interface DteAceptado {
  tipoDte: string; codigoGeneracion: string; selloRecibido: string; numeroControl: string; fecEmi: string;
  receptor?: { tipoDocumento: string | null; numDocumento: string | null; nombre: string | null; telefono: string | null; correo: string | null };
}

/** Evento de Invalidación v3 (tipoAnulacion 2 = rescindir: sin documento de reemplazo). */
export function buildInvalidacion(codigoGeneracion: string, ahora: Date, emisor: EmisorDte, dte: DteAceptado, tipoAnulacion: 1 | 2 | 3,
  codigoReemplazo: string | null, motivoAnulacion: string, responsable: Responsable, solicitante: Responsable): EventDocument {
  const { fecha, hora } = fechaHoraSV(ahora);
  if (tipoAnulacion !== 2 && !codigoReemplazo && !['05'].includes(dte.tipoDte)) throw new Error('Las invalidaciones 1 y 3 requieren el documento de reemplazo ya sellado.');
  const r = dte.receptor || { tipoDocumento: null, numDocumento: null, nombre: null, telefono: null, correo: null };
  return {
    identificacion: { version: 3, ambiente: '00', codigoGeneracion, fecEmi: fecha, horEmi: hora, fusion: null },
    emisor: { nit: emisor.nit, nombre: emisor.nombre, codEstableMH: emisor.codEstable, codEstable: emisor.codEstable,
      codPuntoVentaMH: emisor.codPuntoVenta, codPuntoVenta: emisor.codPuntoVenta, telefono: emisor.telefono, correo: emisor.correo },
    documento: { tipoDte: dte.tipoDte, codigoGeneracion: dte.codigoGeneracion, selloRecibido: dte.selloRecibido, numeroControl: dte.numeroControl,
      fecEmi: dte.fecEmi, codigoGeneracionR: tipoAnulacion === 2 ? null : codigoReemplazo, tipoDocumento: r.tipoDocumento,
      numDocumento: r.numDocumento, nombre: r.nombre, telefono: r.telefono, correo: r.correo },
    motivo: { tipoAnulacion, motivoAnulacion, nombreResponsable: responsable.nombre, tipDocResponsable: responsable.tipoDocumento,
      numDocResponsable: responsable.numDocumento, nombreSolicita: solicitante.nombre, tipDocSolicita: solicitante.tipoDocumento,
      numDocSolicita: solicitante.numDocumento },
  } as unknown as EventDocument;
}

/** Evento de Contingencia v4: informa los DTE generados en contingencia (tipoModelo 2 / tipoOperacion 2). */
export function buildContingencia(codigoGeneracion: string, ahora: Date, emisor: EmisorDte, responsable: Responsable, tipoEstablecimiento: string,
  documentos: { tipoDte: string; codigoGeneracion: string }[], periodo: { inicio: Date; fin: Date }, contingencia: Contingencia): EventDocument {
  const t = fechaHoraSV(ahora), i = fechaHoraSV(periodo.inicio), f = fechaHoraSV(periodo.fin);
  return {
    identificacion: { version: 4, ambiente: '00', codigoGeneracion, fTransmision: t.fecha, hTransmision: t.hora },
    emisor: { nit: emisor.nit, nombre: emisor.nombre, nombreResponsable: responsable.nombre, tipoDocResponsable: responsable.tipoDocumento,
      numeroDocResponsable: responsable.numDocumento, tipoEstablecimiento, codEstableMH: emisor.codEstable, codPuntoVentaMH: emisor.codPuntoVenta,
      telefono: emisor.telefono, correo: emisor.correo },
    detalleDTE: documentos.map((d, n) => ({ noItem: n + 1, tipoDoc: d.tipoDte, codigoGeneracion: d.codigoGeneracion })),
    motivo: { fInicio: i.fecha, fFin: f.fecha, hInicio: i.hora, hFin: f.hora, tipoContingencia: contingencia.tipo,
      motivoContingencia: contingencia.motivo },
  } as unknown as EventDocument;
}
