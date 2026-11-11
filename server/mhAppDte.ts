// Convierte un documento guardado en SIVAR FACT (snapshot de la base) en el DTE oficial para el ambiente 00.
// Factura 01 usa el adaptador ya probado (mhAppFactura). CCF 03, NC 05, ND 06 y FSE 14 usan mhDteBuilders.
// El navegador solo envía IDs: los importes se recalculan aquí y se cotejan con lo guardado.
import { readFileSync } from 'node:fs';
import type { InvoiceDocument } from '../src/types/index.js';
import { codigoDepartamento, codigoMunicipio, distritoValido } from '../src/data/mhCatalogos.js';
import { prepareAppTestFactura } from './mhAppFactura.js';
import { validateDte, type DteDocument } from './mhDte.js';
import {
  buildCcf, buildFse, buildNotaCredito, buildNotaDebito, r2, r8,
  type Contribuyente, type Direccion, type EmisorDte, type Linea, type Pago, type SujetoExcluido,
} from './mhDteBuilders.js';

const ACTIVIDADES: Record<string, string> = JSON.parse(readFileSync(new URL('./mh-schemas/cat-019-actividades.json', import.meta.url), 'utf8'));
const OBS_PRUEBAS = 'AMBIENTE DE PRUEBAS 00 · SIN VALIDEZ FISCAL';

export interface AppClientContext {
  id?: string; economicActivity?: string | null; districtCode?: string | null; department?: string | null;
  municipality?: string | null; address?: string | null; phone?: string | null; email?: string | null; nrc?: string | null;
}
export interface AppDteContext {
  client?: AppClientContext | null;
  relacionado?: { codigoGeneracion: string; fecEmi: string; dteType: string } | null;
}

/** Error con un código estable para que la interfaz pida exactamente el dato que falta. */
export class MhDatoFaltante extends Error {
  constructor(public readonly campo: 'distrito' | 'actividad' | 'relacionado' | 'receptor' | 'totales', message: string) { super(message); }
}

const digits = (s?: string | null) => (s || '').replace(/\D/g, '');
const telefono = (s?: string | null) => { const d = digits(s); return d.length >= 8 && d.length <= 30 ? d : null; };
const correo = (s?: string | null) => { const v = (s || '').trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length >= 6 && v.length <= 100 ? v : null; };

export function actividadEconomica(texto?: string | null) {
  const m = (texto || '').trim().match(/^(\d{5,6})(?:\s*[-–:.]?\s*(.*))?$/);
  if (!m) throw new MhDatoFaltante('actividad', 'Registra la actividad económica del cliente con su código del catálogo CAT-019 (por ejemplo «62010»).');
  const descripcion = ACTIVIDADES[m[1]];
  if (!descripcion) throw new MhDatoFaltante('actividad', `El código de actividad ${m[1]} no está en el catálogo oficial CAT-019.`);
  return { codActividad: m[1], descActividad: descripcion.slice(0, 150) };
}

function direccion(invoice: InvoiceDocument, client?: AppClientContext | null): Direccion {
  const departamento = codigoDepartamento(client?.department || invoice.clientDepartment || '');
  const municipio = departamento && codigoMunicipio(departamento, client?.municipality || invoice.clientMunicipality || '');
  if (!departamento || !municipio) throw new MhDatoFaltante('receptor', 'El departamento y municipio del cliente deben corresponder al catálogo oficial.');
  const distrito = client?.districtCode || '';
  if (!distritoValido(departamento, distrito)) throw new MhDatoFaltante('distrito', 'Selecciona el distrito del cliente (catálogo oficial de Hacienda).');
  const complemento = (client?.address || invoice.clientAddress || '').trim();
  if (!complemento) throw new MhDatoFaltante('receptor', 'Completa la dirección del cliente.');
  return { departamento, municipio, distrito, complemento: complemento.slice(0, 200) };
}

function contribuyente(invoice: InvoiceDocument, client?: AppClientContext | null): Contribuyente {
  if (invoice.clientDocType !== 'NIT') throw new MhDatoFaltante('receptor', 'El receptor de un CCF o una nota debe identificarse con NIT.');
  const nit = digits(invoice.clientDocNumber);
  if (!/^(\d{14}|\d{9})$/.test(nit)) throw new MhDatoFaltante('receptor', 'El NIT del receptor debe tener 14 dígitos (o 9 si está homologado con el DUI).');
  const nrc = digits(invoice.clientNrc || client?.nrc);
  if (!/^\d{2,8}$/.test(nrc)) throw new MhDatoFaltante('receptor', 'El receptor debe tener NRC: el CCF y sus notas son para contribuyentes de IVA.');
  return { nit, nrc, nombre: invoice.clientName.trim().slice(0, 250), ...actividadEconomica(client?.economicActivity),
    nombreComercial: null, direccion: direccion(invoice, client), telefono: telefono(invoice.clientPhone || client?.phone),
    correo: correo(invoice.clientEmail || client?.email) };
}

function sujetoExcluido(invoice: InvoiceDocument, client?: AppClientContext | null): SujetoExcluido {
  const raw = (invoice.clientDocNumber || '').trim();
  if (!raw) throw new MhDatoFaltante('receptor', 'Identifica al sujeto excluido (DUI, NIT, pasaporte u otro documento).');
  const t = invoice.clientDocType;
  const tipoDocumento = t === 'DUI' ? '13' : t === 'NIT' ? '36' : t === 'PASAPORTE' ? '03' : '37';
  const numDocumento = t === 'DUI' ? digits(raw).replace(/^(\d{8})(\d)$/, '$1-$2') : t === 'NIT' ? digits(raw) : raw.slice(0, 20);
  let act: { codActividad: string | null; descActividad: string | null } = { codActividad: null, descActividad: null };
  if (client?.economicActivity && /^\d{5,6}/.test(client.economicActivity.trim())) act = actividadEconomica(client.economicActivity);
  return { tipoDocumento, numDocumento, nombre: invoice.clientName.trim().slice(0, 250), ...act, direccion: direccion(invoice, client),
    telefono: telefono(invoice.clientPhone || client?.phone), correo: correo(invoice.clientEmail || client?.email) };
}

function lineas(invoice: InvoiceDocument): Linea[] {
  return invoice.items.map(item => {
    if (!item.description.trim() || !(item.quantity > 0) || !(item.unitPrice >= 0) || !(item.discount >= 0)) {
      throw new MhDatoFaltante('totales', 'Revisa las cantidades, precios y descripciones de las partidas.');
    }
    const factor = invoice.pricesIncludeIva && ['03', '05', '06'].includes(invoice.dteType) && item.taxType === 'GRAVADO' ? 1.13 : 1;
    return { descripcion: item.description.trim().slice(0, 1000), cantidad: item.quantity, precioUni: r8(item.unitPrice / factor),
      descuento: r8((item.discount || 0) / factor), uniMedida: Number(item.unitOfMeasure) || 59,
      tipoItem: item.unitOfMeasure === '99' ? 2 : 1, tipo: item.taxType, codigo: item.code?.trim().slice(0, 25) || null };
  });
}

const pago = (invoice: InvoiceDocument): Pago => ({ condicion: invoice.condition === 'CREDITO' ? 2 : 1,
  codigo: invoice.paymentMethod || '01', plazoDias: invoice.creditTermDays || 30 });
const observaciones = (invoice: InvoiceDocument) => [OBS_PRUEBAS, invoice.observations?.trim()].filter(Boolean).join('. ').slice(0, 3000);
const cerca = (a: number, b: number) => Math.abs(r2(a) - r2(b)) <= 0.01;

function cotejar(invoice: InvoiceDocument, doc: DteDocument) {
  const r = (doc as any).resumen;
  const checks: [number, number][] = invoice.dteType === '14'
    ? [[r.totalCompra, invoice.subtotalGravado + invoice.subtotalExento + invoice.subtotalNoSujeto], [r.reteRenta, invoice.retencionRenta10], [r.totalPagar, invoice.totalPagar]]
    : [[r.totalGravada, invoice.subtotalGravado], [r.totalExenta, invoice.subtotalExento], [r.totalNoSuj, invoice.subtotalNoSujeto],
       [r.tributos?.[0]?.valor ?? 0, invoice.iva13], [r.totalPagar, invoice.totalPagar]];
  if (!checks.every(([a, b]) => cerca(a, b))) throw new MhDatoFaltante('totales', 'Los totales guardados no coinciden con las partidas. Abre el borrador y guárdalo de nuevo.');
}

/** Prepara el DTE oficial del documento guardado. `ahora` fija fecha y hora de emisión (El Salvador). */
export function prepareAppDte(invoice: InvoiceDocument, issuer: Record<string, any>, ahora: Date, context: AppDteContext = {}): DteDocument {
  if (invoice.dteType === '01') return prepareAppTestFactura(invoice, issuer, ahora) as unknown as DteDocument;
  const emisor: EmisorDte = { ...(issuer as EmisorDte), codEstable: invoice.establishmentCode, codPuntoVenta: invoice.posCode };
  const id = { codigoGeneracion: invoice.generationCode.toUpperCase(), numeroControl: invoice.controlNumber, ahora };
  let doc: DteDocument;
  if (invoice.dteType === '03') {
    doc = buildCcf(id, emisor, contribuyente(invoice, context.client), lineas(invoice), pago(invoice), observaciones(invoice),
      { ivaRete: invoice.retencion1 || 0, ivaPerci: invoice.percepcion1 || 0 });
  } else if (invoice.dteType === '05' || invoice.dteType === '06') {
    if ((invoice.retencion1 || 0) > 0 || (invoice.percepcion1 || 0) > 0) throw new MhDatoFaltante('totales', 'Las notas con retención o percepción del 1% aún no se transmiten desde la aplicación.');
    const rel = context.relacionado;
    if (!rel || rel.dteType !== '03') throw new MhDatoFaltante('relacionado', 'La nota debe referirse a un CCF de esta empresa ya aceptado por Hacienda en el ambiente 00 (indica su número de control o código de generación).');
    const build = invoice.dteType === '05' ? buildNotaCredito : buildNotaDebito;
    doc = build(id, emisor, contribuyente(invoice, context.client), { tipoDte: '03', codigoGeneracion: rel.codigoGeneracion.toUpperCase(), fecEmi: rel.fecEmi },
      lineas(invoice), invoice.condition === 'CREDITO' ? 2 : 1, observaciones(invoice));
  } else if (invoice.dteType === '14') {
    doc = buildFse(id, emisor, sujetoExcluido(invoice, context.client), lineas(invoice), pago(invoice), invoice.retencionRenta10 || 0, observaciones(invoice));
  } else {
    throw new MhDatoFaltante('totales', 'Tipo de documento no admitido por el conector de pruebas.');
  }
  cotejar(invoice, doc);
  return validateDte(doc);
}
