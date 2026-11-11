// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handleMhTestEmission, type MhAppDependencies, type MhResult, type MhReservation } from '../../server/mhAppEmission.js';
import { prepareAppTestFactura } from '../../server/mhAppFactura.js';
import { INITIAL_INVOICES } from '../data/mockData.js';
import { buildF07Annex } from '../utils/f07Export.js';
import { calculateIvaLedger } from '../utils/ivaLedger.js';
import { buildIvaBookReport } from '../utils/ivaBookReport.js';

const now = new Date('2026-11-11T15:00:00Z');
const invoice = { ...INITIAL_INVOICES.find(i => i.dteType === '01')!,
  id: 'c1111111-1111-4111-8111-111111111111', companyId: 'c2222222-2222-4222-8222-222222222222',
  status: 'BORRADOR' as const, generationCode: 'C3333333-3333-4333-8333-333333333333',
  controlNumber: 'DTE-01-M001P001-000000000000003', clientDocNumber: '', clientName: 'CONSUMIDOR FINAL',
  establishmentCode: 'M001', posCode: 'P001', clientNrc: undefined, condition: 'CONTADO' as const, paymentMethod: '01',
  items: [{ id: 'line', code: 'QA', description: 'Servicio ficticio', quantity: 1, unitPrice: 1.13,
    discount: 0, taxType: 'GRAVADO' as const, unitOfMeasure: '99', total: 1.13, taxAmount: .13 }],
  subtotalGravado: 1.13, subtotalExento: 0, subtotalNoSujeto: 0, descuentoTotal: 0, iva13: .13,
  retencion1: 0, percepcion1: 0, retencionRenta10: 0, totalPagar: 1.13, totalLetras: 'UN DOLAR CON 13/100 USD',
};
const issuer = { nit: '00000000000000', nrc: '1234567', nombre: 'Emisor ficticio', codActividad: '62010',
  descActividad: 'Programación informática', nombreComercial: null,
  direccion: { departamento: '06', municipio: '23', distrito: '14', complemento: 'Dirección ficticia' },
  telefono: '00000000', correo: 'qa@example.invalid', codEstable: null, codPuntoVenta: null };
const profile = `Bearer e30.${Buffer.from(JSON.stringify({ authorities: ['USER_API'] })).toString('base64url')}.ficticio`;
function result(state: 'PROCESADO' | 'SIN_CONFIRMAR' | 'RECHAZADO' = 'PROCESADO', http = 200): MhResult {
  return { http, ambiente: '00', estado: state, ambienteReportado: '00', codigoGeneracion: invoice.generationCode,
    codigoGeneracionReportado: state === 'SIN_CONFIRMAR' ? null : invoice.generationCode,
    estadoReportado: state, codigoMsg: state === 'SIN_CONFIRMAR' ? '999' : state === 'RECHAZADO' ? '098' : '001',
    selloRecibido: state === 'PROCESADO' ? 'A'.repeat(40) : null, fhProcesamiento: '11/11/2026 09:00:01',
    descripcionMsg: state === 'SIN_CONFIRMAR' ? 'No se encontro ningun registro que coincida' : state === 'RECHAZADO' ? 'DATOS INVALIDOS' : 'RECIBIDO',
    observaciones: state === 'RECHAZADO' ? ['Revisa el campo señalado'] : [], pista: null,
    respuestaJson: true, tipoContenidoRespuesta: 'application/json', versionRespuesta: 2, clasificaMsg: '10' };
}
const missing = () => result('SIN_CONFIRMAR', 400);
const reservation = (): MhReservation => ({ invoice, nit: issuer.nit, lease: 'ticket', state: 'PREPARADO', document: null, response: null });
function dependencies() {
  return { available: true, companyId: invoice.companyId, nit: issuer.nit, issuer,
    authenticateUser: vi.fn().mockResolvedValue('actor'), reserve: vi.fn().mockResolvedValue(reservation()),
    prepare: vi.fn().mockResolvedValue(undefined), start: vi.fn().mockResolvedValue(undefined),
    finish: vi.fn().mockResolvedValue({ ...invoice, status: 'PROCESADO_MH', mhEnvironment: '00', mhReceptionStamp: 'A'.repeat(40) }),
    authenticateHacienda: vi.fn().mockResolvedValue(profile), sign: vi.fn().mockReturnValue('firma-ficticia'),
    consult: vi.fn().mockResolvedValueOnce(missing()).mockResolvedValue(result('PROCESADO', 202)),
    transmit: vi.fn().mockResolvedValue(result()), now: () => now,
  } satisfies MhAppDependencies;
}
const request = (data: Record<string, unknown> = {}, authorized = true) => new Request('https://sivarconta.vercel.app/api/mh-test-emission', {
  method: 'POST', headers: authorized ? { authorization: 'Bearer sesion-ficticia' } : {},
  body: JSON.stringify({ companyId: invoice.companyId, invoiceId: invoice.id, action: 'transmitir', ...data }),
});

describe('Emisión desde la aplicación', () => {
  it.each([200, 202])('solo confirma con consulta independiente PROCESADO HTTP %s y guarda el sello', async http => {
    const deps = dependencies(); deps.consult.mockReset().mockResolvedValueOnce(missing()).mockResolvedValueOnce(result('PROCESADO', http));
    const response = await handleMhTestEmission(request(), deps);
    expect(response.status).toBe(200); expect((await response.json()).confirmed).toBe(true);
    expect(deps.authenticateHacienda).toHaveBeenCalledTimes(2);
    expect(deps.finish).toHaveBeenCalledWith(invoice.id, 'ticket', expect.objectContaining({ selloRecibido: 'A'.repeat(40), ambienteReportado: '00' }));
    expect(deps.start.mock.invocationCallOrder[0]).toBeLessThan(deps.transmit.mock.invocationCallOrder[0]);
  });
  it('recupera un documento previamente aceptado sin firmar ni volver a enviarlo', async () => {
    const deps = dependencies(); deps.consult.mockReset().mockResolvedValue(result('PROCESADO', 202));
    expect((await (await handleMhTestEmission(request(), deps)).json()).confirmed).toBe(true);
    expect(deps.transmit).not.toHaveBeenCalled(); expect(deps.sign).not.toHaveBeenCalled();
  });
  it('después de un envío incierto solo consulta aunque Hacienda aún responda 999', async () => {
    const deps = dependencies(); deps.reserve.mockResolvedValue({ ...reservation(), state: 'ENVIO_INCIERTO', document: prepareAppTestFactura(invoice, issuer, now) });
    expect((await handleMhTestEmission(request(), deps)).status).toBe(202);
    expect(deps.prepare).not.toHaveBeenCalled(); expect(deps.transmit).not.toHaveBeenCalled();
  });
  it('un timeout tras iniciar queda sin sello y permite recuperar el mismo UUID por consulta', async () => {
    const deps = dependencies(); deps.transmit.mockRejectedValue(new TypeError('network-secret-placeholder'));
    const response = await handleMhTestEmission(request(), deps);
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('network-secret-placeholder');
    expect(deps.finish).toHaveBeenCalledWith(invoice.id, 'ticket', expect.objectContaining({ estado: 'SIN_CONFIRMAR', selloRecibido: null }));
  });
  it('un recibo PROCESADO sin consulta confirmada no se guarda como aceptado', async () => {
    const deps = dependencies(); deps.consult.mockReset().mockResolvedValueOnce(missing()).mockRejectedValueOnce(new Error('fallo consulta'));
    expect((await handleMhTestEmission(request(), deps)).status).toBe(503);
    expect(deps.finish).toHaveBeenCalledWith(invoice.id, 'ticket', expect.objectContaining({ estado: 'SIN_CONFIRMAR', selloRecibido: null }));
  });
  it('un recibo PROCESADO seguido de consulta 999 queda pendiente, sin sello confirmado', async () => {
    const deps = dependencies(); deps.consult.mockReset().mockResolvedValue(missing());
    expect((await handleMhTestEmission(request(), deps)).status).toBe(202);
    expect(deps.finish).toHaveBeenCalledWith(invoice.id, 'ticket', expect.objectContaining({ estado: 'SIN_CONFIRMAR', selloRecibido: null }));
  });
  it('no acepta dos sellos distintos para el mismo UUID', async () => {
    const deps = dependencies(); deps.consult.mockReset().mockResolvedValueOnce(missing()).mockResolvedValueOnce({ ...result(), selloRecibido: 'B'.repeat(40) });
    expect((await handleMhTestEmission(request(), deps)).status).toBe(503);
    expect(deps.finish).toHaveBeenCalledWith(invoice.id, 'ticket', expect.objectContaining({ estado: 'SIN_CONFIRMAR', selloRecibido: null }));
  });
  it('conserva el rechazo y las observaciones, sin presentar un sello', async () => {
    const deps = dependencies(); deps.transmit.mockResolvedValue(result('RECHAZADO', 400)); deps.consult.mockReset().mockResolvedValue(missing());
    await handleMhTestEmission(request(), deps);
    expect(deps.finish).toHaveBeenCalledWith(invoice.id, 'ticket', expect.objectContaining({ estado: 'RECHAZADO', observaciones: ['Revisa el campo señalado'], selloRecibido: null }));
  });
  it('conserva el 094 cuando recepción rechaza antes de leer el UUID', async () => {
    const deps = dependencies(); deps.transmit.mockResolvedValue({ ...result('SIN_CONFIRMAR', 400), codigoMsg: '094', descripcionMsg: 'VERIFIQUE SU TIPO DE SOLICITUD DTE' });
    deps.consult.mockReset().mockResolvedValue(missing()); await handleMhTestEmission(request(), deps);
    expect(deps.finish).toHaveBeenCalledWith(invoice.id, 'ticket', expect.objectContaining({ codigoMsg: '094' }));
  });
  it('sin USER_API explica la causa y nunca llama a recepción', async () => {
    const deps = dependencies(); deps.authenticateHacienda.mockResolvedValue('Bearer e30.e30.ficticio');
    const response = await handleMhTestEmission(request(), deps);
    expect(response.status).toBe(409); expect((await response.json()).error).toContain('USER_API');
    expect(deps.transmit).not.toHaveBeenCalled();
  });
  it('una consulta solicitada por el usuario no transmite una factura ausente', async () => {
    const deps = dependencies(); await handleMhTestEmission(request({ action: 'consultar' }), deps);
    expect(deps.transmit).not.toHaveBeenCalled();
  });
  it('la sesión y el rol se comprueban antes de usar las claves MH', async () => {
    const deps = dependencies(); expect((await handleMhTestEmission(request({}, false), deps)).status).toBe(401);
    deps.reserve.mockRejectedValue({ code: '42501', message: 'credencial interna' });
    expect((await handleMhTestEmission(request(), deps)).status).toBe(403);
    expect(deps.authenticateHacienda).not.toHaveBeenCalled();
  });
  it('bloquea otra empresa, producción y doble clic en una reserva activa', async () => {
    const deps = dependencies(); expect((await handleMhTestEmission(request({ companyId: 'd2222222-2222-4222-8222-222222222222' }), deps)).status).toBe(403);
    deps.reserve.mockRejectedValueOnce({ message: 'mh_test_only' }).mockRejectedValueOnce({ code: '55P03' });
    expect((await handleMhTestEmission(request(), deps)).status).toBe(409);
    expect((await handleMhTestEmission(request(), deps)).status).toBe(409);
    expect(deps.transmit).not.toHaveBeenCalled();
  });
  it('verifica NIT de la empresa contra el certificado configurado antes de enviar', async () => {
    const deps = dependencies(); deps.reserve.mockResolvedValue({ ...reservation(), nit: '11111111111111' });
    expect((await handleMhTestEmission(request(), deps)).status).toBe(503); expect(deps.authenticateHacienda).not.toHaveBeenCalled();
  });
});

describe('Factura 01 v2 de negocio', () => {
  it('incluye receptor identificado, descuento por partida y pago a crédito', () => {
    const document = prepareAppTestFactura({ ...invoice, clientDocNumber: '00000000-0', clientDocType: 'DUI', clientNrc: undefined,
      condition: 'CREDITO', creditTermDays: 30, paymentMethod: '04', descuentoTotal: 1,
      items: [{ ...invoice.items[0], unitPrice: 2.13, discount: 1 }] }, issuer, now);
    expect(document.identificacion).toMatchObject({ ambiente: '00', version: 2, horEmi: '09:00:00' });
    expect(document.receptor).toMatchObject({ tipoDocumento: '13', numDocumento: '00000000-0' });
    expect(document.resumen).toMatchObject({ totalDescu: 1, totalPagar: 1.13, condicionOperacion: 2 });
    expect(document.resumen.pagos[0]).toMatchObject({ codigo: '04', periodo: 30, plazo: '01' });
  });
  it('separa ventas exentas y no sujetas sin sumarles IVA', () => {
    const document = prepareAppTestFactura({ ...invoice, subtotalGravado: 0, subtotalExento: 1.13, iva13: 0,
      items: [{ ...invoice.items[0], taxType: 'EXENTO' }] }, issuer, now);
    expect(document.resumen).toMatchObject({ totalExenta: 1.13, totalGravada: 0, totalIva: 0 });
    expect(document.cuerpoDocumento[0].ivaItem).toBe(0);
  });
  it('bloquea otros tipos DTE y totales adulterados antes de firmar', () => {
    expect(() => prepareAppTestFactura({ ...invoice, dteType: '03' }, issuer, now)).toThrow('únicamente Factura 01');
    expect(() => prepareAppTestFactura({ ...invoice, totalPagar: 4 }, issuer, now)).toThrow('totales');
  });
  it('normaliza el UUID que PostgreSQL devuelve en minúsculas sin cambiar su identidad', () => {
    const document = prepareAppTestFactura({ ...invoice, generationCode: invoice.generationCode.toLowerCase() }, issuer, now);
    expect(document.identificacion.codigoGeneracion).toBe(invoice.generationCode);
  });
  it('los documentos aceptados en 00 no contaminan libros, saldo de IVA ni CSV fiscales', () => {
    const test = { ...invoice, status: 'PROCESADO_MH' as const, mhEnvironment: '00' as const };
    expect(buildIvaBookReport('ventas_consumidor', [test], []).rows).toHaveLength(0);
    expect(calculateIvaLedger([test], [], invoice.emissionDate.slice(0, 7)).debit).toBe(0);
    expect(() => buildF07Annex('ventas_consumidor', [test], [])).toThrow();
  });
});
