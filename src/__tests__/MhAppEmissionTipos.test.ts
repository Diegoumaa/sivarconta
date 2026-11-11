// @vitest-environment node
// CCF 03, NC 05, ND 06, FSE 14 e Invalidación desde la aplicación (ambiente 00). Hacienda se simula aquí;
// los mismos constructores fueron aceptados por Hacienda en las pruebas de acreditación del 11/11/2026.
import { describe, it, expect, vi } from 'vitest';
import { handleMhTestEmission, type MhAppDependencies, type MhInvalidationReservation, type MhReservation } from '../../server/mhAppEmission.js';
import { MhDatoFaltante, prepareAppDte, type AppClientContext } from '../../server/mhAppDte.js';
import { validateEvent } from '../../server/mhDte.js';
import { calculateInvoiceTotals } from '../utils/dteUtils.js';
import { INITIAL_INVOICES } from '../data/mockData.js';
import type { DteType, InvoiceDocument, InvoiceItem } from '../types/index.js';

const now = new Date('2026-11-11T15:00:00Z');
const issuer = { nit: '00000000000000', nrc: '1234567', nombre: 'Emisor ficticio', codActividad: '62010',
  descActividad: 'Programación informática', nombreComercial: null,
  direccion: { departamento: '06', municipio: '23', distrito: '14', complemento: 'Dirección ficticia' },
  telefono: '00000000', correo: 'qa@example.invalid' };
const client: AppClientContext = { id: 'c4444444-4444-4444-8444-444444444444', economicActivity: '46510 - Venta al por mayor',
  districtCode: '14', department: 'San Salvador', municipality: 'San Salvador Centro', address: 'Colonia ficticia 1', nrc: '2580433' };
const UUID = 'C3333333-3333-4333-8333-333333333333';
const STAMP = 'A'.repeat(40);

function documento(dteType: DteType, items: Partial<InvoiceItem>[], extra: Partial<InvoiceDocument> = {}): InvoiceDocument {
  const lineas = items.map((x, i) => ({ id: `l${i}`, code: '', description: 'Servicio ficticio', quantity: 1, unitPrice: 10, discount: 0,
    taxType: 'GRAVADO' as const, unitOfMeasure: '99', total: 0, taxAmount: 0, ...x }));
  const base = { ...INITIAL_INVOICES.find(i => i.dteType === '01')!, ...extra };
  const totals = calculateInvoiceTotals(dteType, lineas, false, false, false, Boolean(base.pricesIncludeIva));
  return { ...base, ...totals, ...extra, items: lineas, dteType, id: 'c1111111-1111-4111-8111-111111111111',
    companyId: 'c2222222-2222-4222-8222-222222222222', status: 'BORRADOR', generationCode: UUID,
    controlNumber: `DTE-${dteType}-M001P001-000000000000001`, establishmentCode: 'M001', posCode: 'P001',
    clientId: client.id!, clientName: 'PRUEBA PERSONA JURIDICA', clientDocType: extra.clientDocType || 'NIT',
    clientDocNumber: extra.clientDocNumber ?? '44444444444443', clientNrc: extra.clientNrc ?? '2580433',
    clientDepartment: 'San Salvador', clientMunicipality: 'San Salvador Centro', clientAddress: 'Colonia ficticia 1',
    clientEmail: '', clientPhone: '', condition: 'CONTADO', paymentMethod: '01' };
}

const profile = `Bearer e30.${Buffer.from(JSON.stringify({ authorities: ['USER_API'] })).toString('base64url')}.ficticio`;
const consulta = (estado: 'PROCESADO' | 'AUSENTE') => ({ http: estado === 'AUSENTE' ? 400 : 202, ambiente: '00', ambienteReportado: '00',
  codigoGeneracion: UUID, codigoGeneracionReportado: estado === 'AUSENTE' ? null : UUID, estadoReportado: estado === 'AUSENTE' ? null : 'PROCESADO',
  estado: estado === 'AUSENTE' ? 'SIN_CONFIRMAR' : 'PROCESADO', selloRecibido: estado === 'AUSENTE' ? null : STAMP,
  codigoMsg: estado === 'AUSENTE' ? '999' : '001', descripcionMsg: estado === 'AUSENTE' ? 'No se encontro ningun registro que coincida' : 'RECIBIDO',
  observaciones: [], fhProcesamiento: null, respuestaJson: true, tipoContenidoRespuesta: 'application/json', versionRespuesta: 2,
  clasificaMsg: null, pista: null }) as any;

function dependencies(invoice: InvoiceDocument, context: Record<string, unknown> = { client }) {
  const reservation: MhReservation = { invoice, nit: issuer.nit, lease: 'ticket', state: 'PREPARADO', document: null, response: null };
  return { available: true, companyId: invoice.companyId, nit: issuer.nit, issuer,
    authenticateUser: vi.fn().mockResolvedValue('actor'), reserve: vi.fn().mockResolvedValue(reservation),
    prepare: vi.fn().mockResolvedValue(undefined), start: vi.fn().mockResolvedValue(undefined),
    finish: vi.fn().mockResolvedValue({ ...invoice, status: 'PROCESADO_MH' }),
    release: vi.fn().mockResolvedValue({ ...invoice, status: 'BORRADOR' }),
    authenticateHacienda: vi.fn().mockResolvedValue(profile), sign: vi.fn().mockReturnValue('firma-ficticia'),
    consult: vi.fn().mockResolvedValueOnce(consulta('AUSENTE')).mockResolvedValue(consulta('PROCESADO')),
    transmit: vi.fn().mockResolvedValue(consulta('PROCESADO')), loadContext: vi.fn().mockResolvedValue(context), now: () => now,
  } satisfies MhAppDependencies;
}
const request = (invoice: InvoiceDocument, data: Record<string, unknown> = {}) => new Request('https://sivarconta.vercel.app/api/mh-test-emission', {
  method: 'POST', headers: { authorization: 'Bearer sesion-ficticia' },
  body: JSON.stringify({ companyId: invoice.companyId, invoiceId: invoice.id, action: 'transmitir', ...data }),
});

describe('Documentos 03, 05, 06 y 14 desde la aplicación', () => {
  it('CCF: prepara el JSON v4 con receptor contribuyente, IVA en tributos y confirma con consulta', async () => {
    const invoice = documento('03', [{ quantity: 2, unitPrice: 10, unitOfMeasure: '59' }]);
    const deps = dependencies(invoice);
    const response = await handleMhTestEmission(request(invoice, { distrito: '14' }), deps);
    expect(response.status).toBe(200); expect((await response.json()).confirmed).toBe(true);
    expect(deps.loadContext).toHaveBeenCalledWith(invoice, { distrito: '14' });
    const document = deps.prepare.mock.calls[0][2] as any;
    expect(document.identificacion).toMatchObject({ tipoDte: '03', version: 4, ambiente: '00', codigoGeneracion: UUID, fecEmi: '2026-11-11' });
    expect(document.receptor).toMatchObject({ nit: '44444444444443', nrc: '2580433', codActividad: '46510',
      direccion: { departamento: '06', municipio: '23', distrito: '14', complemento: 'Colonia ficticia 1' } });
    expect(document.resumen).toMatchObject({ totalGravada: 20, totalPagar: 22.6, tributos: [{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: 2.6 }] });
    expect(document.resumen.observaciones).toContain('AMBIENTE DE PRUEBAS 00');
    expect(deps.start.mock.invocationCallOrder[0]).toBeLessThan(deps.transmit.mock.invocationCallOrder[0]);
  });
  it('CCF con precios con IVA incluido conserva los totales guardados', () => {
    const invoice = documento('03', [{ quantity: 1, unitPrice: 11.3 }], { pricesIncludeIva: true });
    const document = prepareAppDte(invoice, issuer, now, { client }) as any;
    expect(document.resumen).toMatchObject({ totalGravada: 10, totalPagar: 11.3 });
    expect(invoice.totalPagar).toBe(11.3);
  });
  it('sin distrito no reserva el envío: devuelve el borrador y pide exactamente ese dato', async () => {
    const invoice = documento('03', [{}]);
    const deps = dependencies(invoice, { client: { ...client, districtCode: null } });
    const response = await handleMhTestEmission(request(invoice), deps);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ campo: 'distrito', invoice: { status: 'BORRADOR' } });
    expect(deps.release).toHaveBeenCalledWith(invoice.id, 'ticket', expect.objectContaining({ estado: 'SIN_CONFIRMAR' }));
    expect(deps.finish).not.toHaveBeenCalled(); expect(deps.prepare).not.toHaveBeenCalled();
    expect(deps.authenticateHacienda).not.toHaveBeenCalled(); expect(deps.transmit).not.toHaveBeenCalled();
  });
  it('sin actividad económica válida pide el código CAT-019', async () => {
    const invoice = documento('03', [{}]);
    const deps = dependencies(invoice, { client: { ...client, economicActivity: 'Comercio' } });
    expect(await (await handleMhTestEmission(request(invoice), deps)).json()).toMatchObject({ campo: 'actividad' });
    expect(() => prepareAppDte(invoice, issuer, now, { client: { ...client, economicActivity: '99999' } })).toThrow('CAT-019');
  });
  it('rechaza datos del panel mal formados antes de tocar la base o Hacienda', async () => {
    const invoice = documento('03', [{}]);
    const deps = dependencies(invoice);
    expect((await handleMhTestEmission(request(invoice, { distrito: '1' }), deps)).status).toBe(400);
    expect((await handleMhTestEmission(request(invoice, { actividad: 'comercio' }), deps)).status).toBe(400);
    expect(deps.reserve).not.toHaveBeenCalled();
  });
  it('CCF exige NIT y NRC del receptor', () => {
    expect(() => prepareAppDte(documento('03', [{}], { clientDocType: 'DUI', clientDocNumber: '00000000-0' }), issuer, now, { client }))
      .toThrow(MhDatoFaltante);
    expect(() => prepareAppDte(documento('03', [{}], { clientNrc: '' }), issuer, now, { client: { ...client, nrc: null } })).toThrow('NRC');
  });
  it('NC y ND requieren un CCF sellado en 00 y lo relacionan por su código de generación', async () => {
    const nc = documento('05', [{ unitPrice: 1 }]);
    const sinRelacion = dependencies(nc, { client });
    expect(await (await handleMhTestEmission(request(nc), sinRelacion)).json()).toMatchObject({ campo: 'relacionado' });
    expect(sinRelacion.release).toHaveBeenCalled();
    const relacionado = { codigoGeneracion: 'D5555555-5555-4555-8555-555555555555', fecEmi: '2026-11-10', dteType: '03' };
    const doc = prepareAppDte(nc, issuer, now, { client, relacionado }) as any;
    expect(doc.identificacion).toMatchObject({ tipoDte: '05', version: 4 });
    expect(doc.documentoRelacionado).toEqual([{ tipoDocumento: '03', tipoGeneracion: 2, numeroDocumento: relacionado.codigoGeneracion, fechaEmision: '2026-11-10' }]);
    expect(doc.resumen).toMatchObject({ totalIva: 0, totalPagar: 1.13 });
    const nd = prepareAppDte(documento('06', [{ unitPrice: 2 }]), issuer, now, { client, relacionado }) as any;
    expect(nd.identificacion.tipoDte).toBe('06'); expect(nd.resumen).toMatchObject({ totalPagar: 2.26, numPagoElectronico: null });
    expect(() => prepareAppDte(nc, issuer, now, { client, relacionado: { ...relacionado, dteType: '01' } })).toThrow(MhDatoFaltante);
  });
  it('FSE: sujeto excluido con DUI, retención de renta guardada y totales cotejados', () => {
    const invoice = documento('14', [{ unitPrice: 20, unitOfMeasure: '99' }], { clientDocType: 'DUI', clientDocNumber: '012345678', clientNrc: '' });
    expect(invoice.retencionRenta10).toBe(2);
    const doc = prepareAppDte(invoice, issuer, now, { client: { ...client, economicActivity: null } }) as any;
    expect(doc.identificacion).toMatchObject({ tipoDte: '14', version: 2 });
    // En el esquema oficial fe-fse-v2 el sujeto excluido va en «receptor».
    expect(doc.receptor).toMatchObject({ tipoDocumento: '13', numDocumento: '01234567-8', codActividad: null });
    expect(doc.resumen).toMatchObject({ totalCompra: 20, reteRenta: 2, totalPagar: 18 });
  });
  it('bloquea totales adulterados antes de firmar', () => {
    const invoice = { ...documento('03', [{}]), totalPagar: 99 };
    expect(() => prepareAppDte(invoice, issuer, now, { client })).toThrow('totales');
  });
});

describe('Evento de invalidación desde la aplicación', () => {
  const ccf = { ...documento('03', [{}]), status: 'PROCESADO_MH' as const, mhEnvironment: '00' as const, mhReceptionStamp: STAMP, emissionDate: '2026-11-11' };
  const dteDocument = prepareAppDte(documento('03', [{}]), issuer, now, { client }) as any;
  const evento = { http: 200, estado: 'PROCESADO', estadoReportado: 'PROCESADO', selloRecibido: 'B'.repeat(40), codigoGeneracionReportado: null,
    fhProcesamiento: '11/11/2026 09:05:00', codigoMsg: '001', descripcionMsg: 'RECIBIDO', observaciones: [] };
  function deps(state: MhInvalidationReservation['state'] = 'PREPARADO', event: Record<string, any> | null = null) {
    const reservation: MhInvalidationReservation = { invoice: ccf, nit: issuer.nit, lease: 'ticket-inv', eventCode: 'E6666666-6666-4666-8666-666666666666',
      state, dteDocument, event, response: null };
    return { ...dependencies(ccf), reserveInvalidation: vi.fn().mockResolvedValue(reservation),
      prepareInvalidation: vi.fn().mockResolvedValue(undefined), startInvalidation: vi.fn().mockResolvedValue(undefined),
      finishInvalidation: vi.fn().mockResolvedValue({ ...ccf, status: 'INVALIDADO', mhInvalidationStamp: 'B'.repeat(40) }),
      signEvent: vi.fn().mockReturnValue('firma-evento'), transmitInvalidation: vi.fn().mockResolvedValue(evento) } satisfies MhAppDependencies;
  }
  const invalidar = (data: Record<string, unknown> = {}) => request(ccf, { action: 'invalidar', motivo: 'Operación rescindida por el cliente', ...data });

  it('rescinde (tipo 2) con un evento v3 válido, marca el envío antes de transmitir y guarda el sello del evento', async () => {
    const d = deps();
    const response = await handleMhTestEmission(invalidar(), d);
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ confirmed: true });
    const event = d.prepareInvalidation.mock.calls[0][2] as any;
    expect(() => validateEvent('invalidacion', event)).not.toThrow();
    expect(event.identificacion).toMatchObject({ version: 3, ambiente: '00', codigoGeneracion: 'E6666666-6666-4666-8666-666666666666' });
    expect(event.documento).toMatchObject({ tipoDte: '03', codigoGeneracion: UUID, selloRecibido: STAMP, numeroControl: ccf.controlNumber, codigoGeneracionR: null });
    expect(event.motivo).toMatchObject({ tipoAnulacion: 2, motivoAnulacion: 'Operación rescindida por el cliente', tipDocResponsable: '36', numDocResponsable: issuer.nit });
    expect(d.startInvalidation.mock.invocationCallOrder[0]).toBeLessThan(d.transmitInvalidation.mock.invocationCallOrder[0]);
    expect(d.finishInvalidation).toHaveBeenCalledWith(ccf.id, 'ticket-inv', expect.objectContaining({ estado: 'PROCESADO', selloRecibido: 'B'.repeat(40) }));
    expect(d.reserve).not.toHaveBeenCalled(); expect(d.transmit).not.toHaveBeenCalled();
  });
  it('exige motivo y, para los tipos 1 y 3, el documento de reemplazo', async () => {
    const d = deps();
    expect((await handleMhTestEmission(invalidar({ motivo: 'no' }), d)).status).toBe(400);
    expect((await handleMhTestEmission(invalidar({ tipoAnulacion: 4 }), d)).status).toBe(400);
    const sinReemplazo = await handleMhTestEmission(invalidar({ tipoAnulacion: 1 }), d);
    expect(sinReemplazo.status).toBe(422); expect((await sinReemplazo.json()).error).toContain('reemplaza');
    expect(d.transmitInvalidation).not.toHaveBeenCalled();
  });
  it('un rechazo del reenvío de un evento incierto no se da por definitivo', async () => {
    const d = deps('ENVIO_INCIERTO', { identificacion: { codigoGeneracion: 'E6666666-6666-4666-8666-666666666666' } });
    d.transmitInvalidation.mockResolvedValue({ ...evento, estado: 'RECHAZADO', selloRecibido: null, codigoMsg: '004', descripcionMsg: 'YA EXISTE' });
    const response = await handleMhTestEmission(invalidar(), d);
    expect(response.status).toBe(422);
    expect(d.prepareInvalidation).not.toHaveBeenCalled();
    expect(d.finishInvalidation).toHaveBeenCalledWith(ccf.id, 'ticket-inv', expect.objectContaining({ estado: 'SIN_CONFIRMAR', selloRecibido: null }));
  });
  it('sin USER_API no envía el evento; y un servidor sin invalidación configurada responde 503', async () => {
    const d = deps(); d.authenticateHacienda.mockResolvedValue('Bearer e30.e30.ficticio');
    expect((await handleMhTestEmission(invalidar(), d)).status).toBe(409);
    expect(d.transmitInvalidation).not.toHaveBeenCalled();
    expect((await handleMhTestEmission(invalidar(), dependencies(ccf))).status).toBe(503);
  });
  it('solo documentos aceptados en 00 y solo roles autorizados', async () => {
    const d = deps(); d.reserveInvalidation.mockRejectedValueOnce({ message: 'mh_not_accepted' }).mockRejectedValueOnce({ code: '42501' });
    expect((await handleMhTestEmission(invalidar(), d)).status).toBe(409);
    expect((await handleMhTestEmission(invalidar(), d)).status).toBe(403);
    expect(d.authenticateHacienda).not.toHaveBeenCalled();
  });
});
