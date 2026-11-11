// Ejecutor de las pruebas mínimas de acreditación en el ambiente 00 (solo apitest).
// Uso: node --import tsx server/mhPruebasCli.ts estado
//      node --import tsx server/mhPruebasCli.ts enviar <factura|ccf|nc|nd|fse> <cantidad>
//      node --import tsx server/mhPruebasCli.ts invalidar <cantidad>
//      node --import tsx server/mhPruebasCli.ts contingencia <cantidad>
//      node --import tsx server/mhPruebasCli.ts verificar   (consulta independiente de todo lo aceptado; no transmite)
// Requiere en el entorno del proceso: MH_TEST_NIT, MH_TEST_API_PASSWORD, MH_TEST_SIGNING_PASSWORD, MH_TEST_CERTIFICATE.
// Nunca imprime claves, tokens ni JWS. Se detiene ante el primer documento no aceptado.
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { authenticateHaciendaTest } from './mhTest.js';
import { consultDte, signJson, transmitContingencia, transmitDte, transmitInvalidacion, validateDte, validateEvent, type DteDocument, type TipoDte } from './mhDte.js';
import {
  buildCcf, buildContingencia, buildFactura, buildFse, buildInvalidacion, buildNotaCredito, buildNotaDebito, numeroControl, receptorFactura,
  type Contribuyente, type EmisorDte, type Linea, type Pago, type Responsable, type SujetoExcluido,
} from './mhDteBuilders.js';
import { withHaciendaDiagnostics } from './mhTestDiagnostics.js';

const OUT = process.env.MH_PRUEBAS_DIR || 'C:/Users/55554/Downloads/SIVAR FACT - Pruebas Hacienda (acreditacion)';
const EMISOR_JSON = process.env.MH_PRUEBAS_EMISOR || 'C:/Users/55554/Downloads/SIVAR FACT - Causa del 094 y correccion/caso/emisor-sivarconta-pruebas.json';
const ESTABLECIMIENTO = 'M001';
const PUNTO_VENTA = process.env.MH_PRUEBAS_PUNTO_VENTA || 'P099';
const PAUSA_MS = Number(process.env.MH_PRUEBAS_PAUSA_MS || 1500);
const REGISTRO = join(OUT, 'registro.jsonl');
const CORRELATIVOS = join(OUT, 'correlativos.json');
const DOCS = join(OUT, 'documentos');
const OBS = 'PRUEBA FICTICIA SIVAR FACT · AMBIENTE 00 · SIN VALIDEZ FISCAL';

type Tipo = TipoDte | 'INV' | 'CONT';
interface Registro {
  fecha: string; tipo: Tipo; escenario: string; codigoGeneracion: string; numeroControl: string | null; fecEmi: string | null;
  estado: string; sello: string | null; codigoMsg: string | null; descripcionMsg: string | null; observaciones: string[];
  total?: number; relacionado?: string | null; contingencia?: boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const env = (name: string) => { const v = process.env[name]; if (!v) throw new Error(`Falta ${name} en el entorno del proceso.`); return v; };
const nuevoUuid = () => randomUUID().toUpperCase();

function cargarEmisor(): EmisorDte {
  const raw = JSON.parse(readFileSync(EMISOR_JSON, 'utf8').replace(/^\uFEFF/, ''));
  const e = raw.emisor || raw;
  return { ...e, codEstable: ESTABLECIMIENTO, codPuntoVenta: PUNTO_VENTA };
}

function registros(): Registro[] {
  if (!existsSync(REGISTRO)) return [];
  return readFileSync(REGISTRO, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
}

function siguienteCorrelativo(tipo: TipoDte): number {
  const estado = existsSync(CORRELATIVOS) ? JSON.parse(readFileSync(CORRELATIVOS, 'utf8')) : {};
  const n = (estado[tipo] || 0) + 1;
  estado[tipo] = n;
  writeFileSync(CORRELATIVOS, JSON.stringify(estado, null, 2) + '\n'); // se reserva ANTES de transmitir
  return n;
}

/** Un RECHAZADO definitivo no registra el documento en Hacienda: se libera su correlativo si fue el último reservado. */
function liberarCorrelativo(tipo: TipoDte, n: number) {
  const estado = JSON.parse(readFileSync(CORRELATIVOS, 'utf8'));
  if (estado[tipo] === n) { estado[tipo] = n - 1; writeFileSync(CORRELATIVOS, JSON.stringify(estado, null, 2) + '\n'); }
}

function guardar(reg: Registro, documento?: object) {
  appendFileSync(REGISTRO, JSON.stringify(reg) + '\n');
  if (documento) writeFileSync(join(DOCS, `${reg.tipo}-${reg.numeroControl || 'evento'}-${reg.codigoGeneracion}.json`), JSON.stringify(documento, null, 2) + '\n');
}

const emisor = () => cargarEmisor();
const contribuyente = (e: EmisorDte): Contribuyente => {
  const archivo = process.env.MH_PRUEBAS_RECEPTOR;
  if (archivo) return JSON.parse(readFileSync(archivo, 'utf8').replace(/^\uFEFF/, ''));
  // Por defecto, la propia empresa como receptor de prueba (no se usan datos de terceros).
  return { nit: e.nit, nrc: e.nrc, nombre: e.nombre, codActividad: e.codActividad, descActividad: e.descActividad,
    nombreComercial: e.nombreComercial, direccion: e.direccion, telefono: e.telefono, correo: e.correo };
};
const sujetoExcluido = (e: EmisorDte): SujetoExcluido => {
  const archivo = process.env.MH_PRUEBAS_SUJETO;
  if (archivo) return JSON.parse(readFileSync(archivo, 'utf8').replace(/^\uFEFF/, ''));
  return { tipoDocumento: '37', numDocumento: 'SEPRUEBA0001', nombre: 'SUJETO EXCLUIDO FICTICIO DE PRUEBA', codActividad: null,
    descActividad: null, direccion: { ...e.direccion, complemento: 'Dirección ficticia de prueba' }, telefono: null, correo: null };
};
const responsable = (e: EmisorDte): Responsable => {
  const archivo = process.env.MH_PRUEBAS_RESPONSABLE;
  if (archivo) return JSON.parse(readFileSync(archivo, 'utf8').replace(/^\uFEFF/, ''));
  return { nombre: 'SIVARCONTA, S.A. DE C.V.', tipoDocumento: '36', numDocumento: e.nit };
};

// Escenarios variados para que las pruebas ejerciten distintas reglas (montos, unidades, exento, descuento, crédito).
function escenarioFactura(i: number, e: EmisorDte): { nombre: string; lineas: Linea[]; pago: Pago; receptor: Record<string, unknown> | null } {
  const s = i % 6;
  const contado: Pago = { condicion: 1, codigo: '01' };
  if (s === 1) return { nombre: 'bienes-gravados', lineas: [{ descripcion: 'PRUEBA FICTICIA: artículo de oficina', cantidad: 2, precioUni: 5.65, uniMedida: 59, tipoItem: 1 }], pago: contado, receptor: null };
  if (s === 2) return { nombre: 'gravado-y-exento', lineas: [
    { descripcion: 'PRUEBA FICTICIA: servicio gravado', cantidad: 1, precioUni: 2.26 },
    { descripcion: 'PRUEBA FICTICIA: servicio exento', cantidad: 1, precioUni: 1.00, tipo: 'EXENTO' }], pago: contado, receptor: null };
  if (s === 3) return { nombre: 'descuento-por-item', lineas: [{ descripcion: 'PRUEBA FICTICIA: servicio con descuento', cantidad: 1, precioUni: 3.39, descuento: 1.13 }], pago: contado, receptor: null };
  if (s === 4) return { nombre: 'receptor-identificado', lineas: [{ descripcion: 'PRUEBA FICTICIA: servicio contable', cantidad: 1, precioUni: 11.30 }], pago: { condicion: 1, codigo: '04' }, receptor: receptorFactura(contribuyente(e)) };
  if (s === 5) return { nombre: 'credito-30-dias', lineas: [{ descripcion: 'PRUEBA FICTICIA: asesoría a crédito', cantidad: 1, precioUni: 22.60 }], pago: { condicion: 2, plazoDias: 30 }, receptor: null };
  return { nombre: 'servicio-contado', lineas: [{ descripcion: 'PRUEBA FICTICIA: servicio contable', cantidad: 1, precioUni: 1.13 }], pago: contado, receptor: null };
}

function escenarioCcf(i: number): { nombre: string; lineas: Linea[]; pago: Pago } {
  const s = i % 5;
  if (s === 1) return { nombre: 'bienes', lineas: [{ descripcion: 'PRUEBA FICTICIA: papelería', cantidad: 2, precioUni: 3.5, uniMedida: 59, tipoItem: 1 }], pago: { condicion: 1, codigo: '01' } };
  if (s === 2) return { nombre: 'gravado-y-exento', lineas: [
    { descripcion: 'PRUEBA FICTICIA: servicio gravado', cantidad: 1, precioUni: 10 },
    { descripcion: 'PRUEBA FICTICIA: servicio exento', cantidad: 1, precioUni: 2, tipo: 'EXENTO' }], pago: { condicion: 1, codigo: '01' } };
  if (s === 3) return { nombre: 'credito-30-dias', lineas: [{ descripcion: 'PRUEBA FICTICIA: asesoría tributaria', cantidad: 1, precioUni: 20 }], pago: { condicion: 2, plazoDias: 30 } };
  if (s === 4) return { nombre: 'descuento-por-item', lineas: [{ descripcion: 'PRUEBA FICTICIA: servicio con descuento', cantidad: 1, precioUni: 15, descuento: 5 }], pago: { condicion: 1, codigo: '01' } };
  return { nombre: 'servicio', lineas: [{ descripcion: 'PRUEBA FICTICIA: servicio contable', cantidad: 1, precioUni: 10 }], pago: { condicion: 1, codigo: '01' } };
}

async function enviarDte(token: string, tipo: TipoDte, construir: (id: { codigoGeneracion: string; numeroControl: string; ahora: Date }) => DteDocument,
  escenario: string, extra: Partial<Registro> = {}, ahora = new Date()) {
  const xml = readFileSync(env('MH_TEST_CERTIFICATE'), 'utf8');
  const correlativo = siguienteCorrelativo(tipo);
  const id = { codigoGeneracion: nuevoUuid(), numeroControl: numeroControl(tipo, ESTABLECIMIENTO, PUNTO_VENTA, correlativo), ahora };
  const documento = validateDte(construir(id));
  const jws = signJson(documento, xml, env('MH_TEST_SIGNING_PASSWORD'));
  const r = await transmitDte(documento, jws, token, { idEnvio: correlativo });
  const reg: Registro = { fecha: new Date().toISOString(), tipo, escenario, codigoGeneracion: id.codigoGeneracion, numeroControl: id.numeroControl,
    fecEmi: documento.identificacion.fecEmi, estado: r.estado, sello: r.selloRecibido, codigoMsg: r.codigoMsg, descripcionMsg: r.descripcionMsg,
    observaciones: r.observaciones, total: (documento as any).resumen?.totalPagar, ...extra };
  guardar(reg, documento);
  console.log(`${tipo} ${id.numeroControl} ${escenario}: ${r.estado} ${r.codigoMsg || ''} ${r.selloRecibido || r.descripcionMsg || ''}${r.observaciones.length ? ` | obs: ${r.observaciones.join(' / ')}` : ''}`);
  if (r.estado === 'RECHAZADO') liberarCorrelativo(tipo, correlativo);
  if (r.estado !== 'PROCESADO') throw new Error(`Documento no aceptado (${r.codigoMsg} ${r.descripcionMsg}). Observaciones: ${r.observaciones.join(' | ') || 'ninguna'}. Se detiene la tanda.`);
  return { reg, documento };
}

async function enviar(token: string, tipoNombre: string, cantidad: number) {
  const e = emisor();
  const aceptados = registros().filter(x => x.estado === 'PROCESADO');
  for (let i = 0; i < cantidad; i++) {
    if (i) await sleep(PAUSA_MS);
    const n = aceptados.length + i;
    if (tipoNombre === 'factura') {
      const esc = escenarioFactura(n, e);
      await enviarDte(token, '01', id => buildFactura(id, e, esc.receptor, esc.lineas, esc.pago, OBS), esc.nombre);
    } else if (tipoNombre === 'ccf') {
      const esc = escenarioCcf(n);
      await enviarDte(token, '03', id => buildCcf(id, e, contribuyente(e), esc.lineas, esc.pago, OBS), esc.nombre);
    } else if (tipoNombre === 'nc' || tipoNombre === 'nd') {
      const tipo: TipoDte = tipoNombre === 'nc' ? '05' : '06';
      const usados = new Set(registros().filter(x => x.tipo === tipo && x.estado === 'PROCESADO').map(x => x.relacionado));
      const ccf = registros().find(x => x.tipo === '03' && x.estado === 'PROCESADO' && !usados.has(x.codigoGeneracion) && x.fecEmi);
      if (!ccf) throw new Error('No hay CCF aceptados libres para relacionar. Envíe primero más CCF.');
      const rel = { tipoDte: '03' as const, codigoGeneracion: ccf.codigoGeneracion, fecEmi: ccf.fecEmi! };
      const lineas: Linea[] = [{ descripcion: tipo === '05' ? 'PRUEBA FICTICIA: ajuste a favor del cliente' : 'PRUEBA FICTICIA: cargo adicional', cantidad: 1, precioUni: tipo === '05' ? 1 : 2 }];
      const build = tipo === '05' ? buildNotaCredito : buildNotaDebito;
      await enviarDte(token, tipo, id => build(id, e, contribuyente(e), rel, lineas, 1, OBS), tipo === '05' ? 'credito-parcial' : 'debito-cargo', { relacionado: ccf.codigoGeneracion });
    } else if (tipoNombre === 'fse') {
      const servicio = n % 2 === 1;
      const lineas: Linea[] = servicio
        ? [{ descripcion: 'PRUEBA FICTICIA: servicio de limpieza', cantidad: 1, precioUni: 20 }]
        : [{ descripcion: 'PRUEBA FICTICIA: compra de productos agrícolas', cantidad: 5, precioUni: 1, uniMedida: 59, tipoItem: 1 }];
      await enviarDte(token, '14', id => buildFse(id, e, sujetoExcluido(e), lineas, { condicion: 1, codigo: '01' }, servicio, OBS), servicio ? 'servicio-con-renta' : 'compra-bien');
    } else throw new Error('Tipo no reconocido. Use factura, ccf, nc, nd o fse.');
  }
}

async function invalidar(token: string, cantidad: number) {
  const e = emisor();
  const xml = readFileSync(env('MH_TEST_CERTIFICATE'), 'utf8');
  for (let i = 0; i < cantidad; i++) {
    if (i) await sleep(PAUSA_MS);
    const todos = registros();
    const invalidados = new Set(todos.filter(x => x.tipo === 'INV' && x.estado === 'PROCESADO').map(x => x.relacionado));
    const factura = todos.find(x => x.tipo === '01' && x.estado === 'PROCESADO' && x.sello && !invalidados.has(x.codigoGeneracion) && !x.contingencia);
    if (!factura) throw new Error('No hay facturas aceptadas libres para invalidar.');
    const doc = JSON.parse(readFileSync(join(DOCS, `01-${factura.numeroControl}-${factura.codigoGeneracion}.json`), 'utf8'));
    const rec = doc.receptor ? { tipoDocumento: doc.receptor.tipoDocumento, numDocumento: doc.receptor.numDocumento, nombre: doc.receptor.nombre,
      telefono: doc.receptor.telefono, correo: doc.receptor.correo } : undefined;
    const evento = validateEvent('invalidacion', buildInvalidacion(nuevoUuid(), new Date(), e, { tipoDte: '01', codigoGeneracion: factura.codigoGeneracion,
      selloRecibido: factura.sello!, numeroControl: factura.numeroControl!, fecEmi: factura.fecEmi!, receptor: rec }, 2, null,
      'PRUEBA EN AMBIENTE 00: OPERACION FICTICIA RESCINDIDA', responsable(e), responsable(e)));
    const r = await transmitInvalidacion(evento as any, signJson(evento, xml, env('MH_TEST_SIGNING_PASSWORD')), token, i + 1);
    const reg: Registro = { fecha: new Date().toISOString(), tipo: 'INV', escenario: 'rescindir-factura', codigoGeneracion: evento.identificacion.codigoGeneracion,
      numeroControl: null, fecEmi: (evento as any).identificacion.fecEmi, estado: r.estado, sello: r.selloRecibido, codigoMsg: r.codigoMsg,
      descripcionMsg: r.descripcionMsg, observaciones: r.observaciones, relacionado: factura.codigoGeneracion };
    guardar(reg, evento);
    console.log(`INV de ${factura.numeroControl}: ${r.estado} ${r.codigoMsg || ''} ${r.selloRecibido || r.descripcionMsg || ''}${r.observaciones.length ? ` | obs: ${r.observaciones.join(' / ')}` : ''}`);
    if (r.estado !== 'PROCESADO') throw new Error('Invalidación no aceptada. Se detiene la tanda.');
  }
}

async function contingencia(token: string, cantidad: number) {
  const e = emisor();
  const xml = readFileSync(env('MH_TEST_CERTIFICATE'), 'utf8');
  for (let i = 0; i < cantidad; i++) {
    if (i) await sleep(PAUSA_MS);
    const ahora = Date.now();
    const periodo = { inicio: new Date(ahora - 10 * 60_000), fin: new Date(ahora - 60_000) };
    const motivo = { tipo: 2 as const, motivo: 'PRUEBA: indisponibilidad simulada del sistema del emisor (ambiente 00)' };
    // 1) Factura generada "durante" la contingencia (modelo diferido, transmisión por contingencia), aún sin transmitir.
    const correlativo = siguienteCorrelativo('01');
    const id = { codigoGeneracion: nuevoUuid(), numeroControl: numeroControl('01', ESTABLECIMIENTO, PUNTO_VENTA, correlativo), ahora: new Date(ahora - 5 * 60_000), contingencia: motivo };
    const factura = validateDte(buildFactura(id, e, null, [{ descripcion: 'PRUEBA FICTICIA: venta en contingencia', cantidad: 1, precioUni: 1.13 }], { condicion: 1, codigo: '01' }, OBS));
    // 2) Evento de contingencia que informa esa factura.
    const evento = validateEvent('contingencia', buildContingencia(nuevoUuid(), new Date(), e, responsable(e), '02',
      [{ tipoDte: '01', codigoGeneracion: id.codigoGeneracion }], periodo, motivo));
    const ev = await transmitContingencia(evento, signJson(evento, xml, env('MH_TEST_SIGNING_PASSWORD')), token);
    guardar({ fecha: new Date().toISOString(), tipo: 'CONT', escenario: 'contingencia-sistema-emisor', codigoGeneracion: evento.identificacion.codigoGeneracion,
      numeroControl: null, fecEmi: (evento as any).identificacion.fTransmision, estado: ev.estado, sello: ev.selloRecibido, codigoMsg: ev.codigoMsg,
      descripcionMsg: ev.descripcionMsg, observaciones: ev.observaciones, relacionado: id.codigoGeneracion }, evento);
    console.log(`CONT evento: ${ev.estado} ${ev.selloRecibido || ev.descripcionMsg || ''}${ev.observaciones.length ? ` | obs: ${ev.observaciones.join(' / ')}` : ''}`);
    if (ev.estado !== 'PROCESADO') throw new Error('Evento de contingencia no aceptado. Se detiene.');
    await sleep(PAUSA_MS);
    // 3) Transmisión de la factura informada en el evento.
    const r = await transmitDte(factura, signJson(factura, xml, env('MH_TEST_SIGNING_PASSWORD')), token, { idEnvio: correlativo });
    guardar({ fecha: new Date().toISOString(), tipo: '01', escenario: 'emitida-en-contingencia', codigoGeneracion: id.codigoGeneracion,
      numeroControl: id.numeroControl, fecEmi: factura.identificacion.fecEmi, estado: r.estado, sello: r.selloRecibido, codigoMsg: r.codigoMsg,
      descripcionMsg: r.descripcionMsg, observaciones: r.observaciones, total: 1.13, contingencia: true }, factura);
    console.log(`01 ${id.numeroControl} en contingencia: ${r.estado} ${r.codigoMsg || ''} ${r.selloRecibido || r.descripcionMsg || ''}${r.observaciones.length ? ` | obs: ${r.observaciones.join(' / ')}` : ''}`);
    if (r.estado !== 'PROCESADO') throw new Error('Factura de contingencia no aceptada. Se detiene.');
  }
}

/** Corrobora cada DTE aceptado con una consulta independiente (token nuevo). No transmite nada. */
async function verificar(token: string) {
  const e = emisor();
  const regs = registros();
  const invalidados = new Set(regs.filter(x => x.tipo === 'INV' && x.estado === 'PROCESADO').map(x => x.relacionado));
  const destino = join(OUT, 'verificacion.jsonl');
  writeFileSync(destino, '');
  const resumen: Record<string, Record<string, number>> = {};
  for (const reg of regs.filter(x => x.estado === 'PROCESADO' && x.tipo !== 'INV' && x.tipo !== 'CONT')) {
    const r = await consultDte(reg.tipo as TipoDte, e.nit, reg.codigoGeneracion, token);
    // Observado el 11/11/2026: /consultadte sigue mostrando PROCESADO y el sello original de un DTE ya invalidado
    // (no refleja el evento). La invalidación se acredita con el sello propio del evento, guardado en el registro.
    const invalidado = invalidados.has(reg.codigoGeneracion);
    const resultado = r.estado === 'PROCESADO' && r.selloRecibido === reg.sello
      ? (invalidado ? 'CORROBORADO_E_INVALIDADO_POR_EVENTO' : 'CORROBORADO') : 'DISCREPANCIA';
    appendFileSync(destino, JSON.stringify({ tipo: reg.tipo, numeroControl: reg.numeroControl, codigoGeneracion: reg.codigoGeneracion, selloRegistrado: reg.sello,
      http: r.http, ambienteReportado: r.ambienteReportado, codigoGeneracionReportado: r.codigoGeneracionReportado, estadoReportado: r.estadoReportado,
      selloConsulta: r.selloRecibido, fhProcesamiento: r.fhProcesamiento, codigoMsg: r.codigoMsg, resultado }) + '\n');
    resumen[reg.tipo] ||= {};
    resumen[reg.tipo][resultado] = (resumen[reg.tipo][resultado] || 0) + 1;
    if (resultado === 'DISCREPANCIA') console.log(`DISCREPANCIA ${reg.tipo} ${reg.numeroControl}: HTTP ${r.http} ${r.estadoReportado} ${r.codigoMsg || ''}`);
    await sleep(250);
  }
  const salida = { fecha: new Date().toISOString(), consultaIndependiente: true, resumen };
  writeFileSync(join(OUT, 'verificacion-resumen.json'), JSON.stringify(salida, null, 2) + '\n');
  console.log(JSON.stringify(salida, null, 2));
}

function estado() {
  const regs = registros();
  const resumen: Record<string, { aceptados: number; otros: number }> = {};
  for (const r of regs) {
    resumen[r.tipo] ||= { aceptados: 0, otros: 0 };
    resumen[r.tipo][r.estado === 'PROCESADO' ? 'aceptados' : 'otros']++;
  }
  console.log(JSON.stringify({ carpeta: OUT, puntoVenta: `${ESTABLECIMIENTO}${PUNTO_VENTA}`, resumen }, null, 2));
}

async function main() {
  const [accion, a, b] = process.argv.slice(2);
  mkdirSync(DOCS, { recursive: true });
  if (accion === 'estado') return estado();
  const token = await authenticateHaciendaTest(env('MH_TEST_NIT'), env('MH_TEST_API_PASSWORD'));
  if (accion === 'enviar') return enviar(token, a, Math.max(1, Number(b) || 1));
  if (accion === 'invalidar') return invalidar(token, Math.max(1, Number(a) || 1));
  if (accion === 'contingencia') return contingencia(token, Math.max(1, Number(a) || 1));
  if (accion === 'verificar') return verificar(token);
  throw new Error('Acción no reconocida. Use estado, enviar, invalidar, contingencia o verificar.');
}

mkdirSync(OUT, { recursive: true });
withHaciendaDiagnostics(event => appendFileSync(join(OUT, 'diagnostico.jsonl'), JSON.stringify(event) + '\n'), main).catch(error => {
  console.error(error instanceof Error ? error.message : 'Falló la operación.');
  process.exitCode = 1;
});
