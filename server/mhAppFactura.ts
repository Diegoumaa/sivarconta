import type { InvoiceDocument } from '../src/types/index.js';
import { prepareTestFactura } from './mhTestFactura.js';
import { validateTestInvoice } from './mhTest.js';

const round = (n: number, decimals = 2) => Number(n.toFixed(decimals));

/** Only the trusted database snapshot is accepted here. The browser supplies IDs, never a DTE. */
export function prepareAppTestFactura(invoice: InvoiceDocument, issuer: Record<string, any>, now = new Date()) {
  if (invoice.dteType !== '01') throw new Error('Por ahora la transmisión de pruebas admite únicamente Factura 01.');
  if (invoice.retencion1 || invoice.percepcion1 || invoice.retencionRenta10) throw new Error('Esta Factura 01 contiene retenciones no admitidas por este adaptador.');
  if (!invoice.items.length || invoice.items.length > 2000) throw new Error('La factura requiere entre 1 y 2000 partidas.');
  // Reuse the proven v2 envelope, then replace every line and total with the stored business document.
  const base = prepareTestFactura({ generationCode: invoice.generationCode.toUpperCase(),
    items: [{ description: 'Preparación', unitOfMeasure: '59', quantity: 1, unitPrice: 1.13 }],
    totalPagar: 1.13, totalLetras: 'UN DOLAR CON 13/100 USD',
  }, { emisor: issuer, establecimientoControl: invoice.establishmentCode, puntoVentaControl: invoice.posCode,
    correlativo: invoice.controlNumber.slice(-15) }, now);
  const lines = invoice.items.map((item, index) => {
    if (!['GRAVADO', 'EXENTO', 'NO_SUJETO'].includes(item.taxType) || !item.description.trim()
      || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0
      || !Number.isFinite(item.discount) || item.discount < 0 || item.discount > item.quantity * item.unitPrice) {
      throw new Error('Revisa los importes y las descripciones de las partidas.');
    }
    const amount = round(item.quantity * item.unitPrice - item.discount, 8);
    if (round(amount) !== round(item.total)) throw new Error('El importe de una partida no coincide con el borrador guardado.');
    return { numItem: index + 1, tipoItem: item.unitOfMeasure === '99' ? 2 : 1, numeroDocumento: null,
      codigo: item.code || null, codTributo: null, descripcion: item.description, cantidad: item.quantity,
      uniMedida: Number(item.unitOfMeasure), precioUni: item.unitPrice, montoDescu: item.discount,
      ventaNoSuj: item.taxType === 'NO_SUJETO' ? amount : 0, ventaExenta: item.taxType === 'EXENTO' ? amount : 0,
      ventaGravada: item.taxType === 'GRAVADO' ? amount : 0, tributos: null, psv: 0, noGravado: 0,
      ivaItem: item.taxType === 'GRAVADO' ? round(amount * 13 / 113, 8) : 0 };
  });
  const sum = (field: 'ventaNoSuj' | 'ventaExenta' | 'ventaGravada' | 'ivaItem' | 'montoDescu') => round(lines.reduce((n, line) => n + line[field], 0));
  const total = round(sum('ventaNoSuj') + sum('ventaExenta') + sum('ventaGravada'));
  if (total !== round(invoice.totalPagar) || sum('ventaGravada') !== round(invoice.subtotalGravado)
    || sum('ventaExenta') !== round(invoice.subtotalExento) || sum('ventaNoSuj') !== round(invoice.subtotalNoSujeto)
    || sum('montoDescu') !== round(invoice.descuentoTotal) || sum('ivaItem') !== round(invoice.iva13)) {
    throw new Error('Los totales del borrador no coinciden con las partidas.');
  }
  const doc = invoice.clientDocNumber.trim();
  // Address is nullable in the official v2 schema. Do not invent district codes from old municipality names.
  const receptor = !doc ? null : { tipoDocumento: invoice.clientDocType === 'NIT' ? '36' : invoice.clientDocType === 'DUI' ? '13' : invoice.clientDocType === 'PASAPORTE' ? '03' : '37',
    numDocumento: invoice.clientDocType === 'NIT' ? doc.replace(/-/g, '') : invoice.clientDocType === 'DUI' ? doc.replace(/\D/g, '').replace(/(\d{8})(\d)$/, '$1-$2') : doc,
    nrc: invoice.clientNrc?.replace(/-/g, '') || null, nombre: invoice.clientName,
    codActividad: null, descActividad: null, direccion: null,
    telefono: invoice.clientPhone || null, correo: invoice.clientEmail || null };
  if (total >= 25000 && !receptor) throw new Error('Identifica al receptor para una factura de este importe.');
  const credit = invoice.condition === 'CREDITO';
  if (credit && (!invoice.creditTermDays || invoice.creditTermDays < 1)) throw new Error('Indica el plazo de crédito.');
  const document = { ...base, receptor, cuerpoDocumento: lines, resumen: { ...base.resumen,
    totalNoSuj: sum('ventaNoSuj'), totalExenta: sum('ventaExenta'), totalGravada: sum('ventaGravada'),
    subTotalVentas: total, subTotal: total, montoTotalOperacion: total, totalPagar: total,
    totalDescu: sum('montoDescu'), totalIva: sum('ivaItem'), totalLetras: invoice.totalLetras,
    condicionOperacion: credit ? 2 : 1,
    pagos: [{ codigo: invoice.paymentMethod, montoPago: total, referencia: null,
      periodo: credit ? invoice.creditTermDays! : null, plazo: credit ? '01' : null }],
    observaciones: ['AMBIENTE DE PRUEBAS 00 · SIN VALIDEZ FISCAL', invoice.observations].filter(Boolean).join('. '),
  } };
  return Object.assign(document, validateTestInvoice(document));
}
