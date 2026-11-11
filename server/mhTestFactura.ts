import { validateTestInvoice } from './mhTest.js';

interface TestDraft {
  generationCode: string;
  items: { description: string; unitOfMeasure: string; quantity: number; unitPrice: number }[];
  totalPagar: number;
  totalLetras: string;
}

interface TestIssuer {
  emisor: object;
  establecimientoControl: string;
  puntoVentaControl: string;
  correlativo: string;
}

export function prepareTestFactura(draft: TestDraft, config: TestIssuer, now = new Date()) {
  if (!/^[MBSP]\d{3}$/.test(config.establecimientoControl) || !/^P\d{3}$/.test(config.puntoVentaControl)
    || typeof config.correlativo !== 'string' || !/^\d{1,15}$/.test(config.correlativo) || Number(config.correlativo) < 1) {
    throw new Error('Se requieren el establecimiento, el punto de venta y un correlativo de pruebas de hasta 15 dígitos.');
  }
  const round = (value: number, places = 2) => Number(value.toFixed(places));
  if (!Array.isArray(draft.items) || !draft.items.length) throw new Error('El borrador debe contener partidas gravadas de prueba.');
  const cuerpoDocumento = draft.items.map((item, index) => {
    const ventaGravada = round(item.quantity * item.unitPrice, 8);
    if (!Number.isFinite(ventaGravada) || ventaGravada <= 0) throw new Error('Las partidas deben tener un importe positivo.');
    return {
      numItem: index + 1, tipoItem: item.unitOfMeasure === '99' ? 2 : 1, numeroDocumento: null,
      codigo: null, codTributo: null, descripcion: item.description, cantidad: item.quantity,
      uniMedida: Number(item.unitOfMeasure), precioUni: item.unitPrice, montoDescu: 0,
      ventaNoSuj: 0, ventaExenta: 0, ventaGravada, tributos: null,
      psv: 0, noGravado: 0, ivaItem: round(ventaGravada * 13 / 113, 8),
    };
  });
  const totalGravada = round(cuerpoDocumento.reduce((sum, item) => sum + item.ventaGravada, 0));
  if (totalGravada !== draft.totalPagar) throw new Error('Las partidas no coinciden con el total del borrador.');
  const totalIva = round(cuerpoDocumento.reduce((sum, item) => sum + item.ivaItem, 0));
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const document = {
    identificacion: {
      version: 2, ambiente: '00', tipoDte: '01', codigoGeneracion: draft.generationCode,
      numeroControl: `DTE-01-${config.establecimientoControl}${config.puntoVentaControl}-${config.correlativo.padStart(15, '0')}`,
      tipoModelo: 1, tipoOperacion: 1, tipoContingencia: null, motivoContin: null,
      fecEmi: `${dateParts.year}-${dateParts.month}-${dateParts.day}`, horEmi: `${dateParts.hour}:${dateParts.minute}:${dateParts.second}`,
      tipoMoneda: 'USD',
    },
    documentoRelacionado: null, emisor: config.emisor, receptor: null, otrosDocumentos: null, ventaTercero: null,
    cuerpoDocumento,
    resumen: {
      totalNoSuj: 0, totalExenta: 0, totalGravada, subTotalVentas: totalGravada,
      descuNoSuj: 0, descuExenta: 0, descuGravada: 0, porcentajeDescuento: 0, totalDescu: 0,
      tributos: null, subTotal: totalGravada, ivaRete: 0, montoTotalOperacion: totalGravada,
      totalNoGravado: 0, totalPagar: totalGravada, totalLetras: draft.totalLetras, totalIva, saldoFavor: 0,
      condicionOperacion: 1, pagos: [{ codigo: '01', montoPago: totalGravada, referencia: null, periodo: null, plazo: null }],
      numPagoElectronico: null, observaciones: 'FACTURA FICTICIA DE PRUEBA SIVAR FACT',
    },
    apendice: null,
  };
  validateTestInvoice(document);
  return document;
}
