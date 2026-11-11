// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateDte, validateEvent } from '../../server/mhDte.js';
import {
  buildCcf, buildContingencia, buildFactura, buildFse, buildInvalidacion, buildNotaCredito, buildNotaDebito,
  fechaHoraSV, montoEnLetras, numeroControl, receptorFactura, type Contribuyente, type EmisorDte,
} from '../../server/mhDteBuilders.js';

const emisor: EmisorDte = {
  nit: '00000000000000', nrc: '1234567', nombre: 'EMISOR FICTICIO', codActividad: '69200', descActividad: 'Actividades de contabilidad',
  nombreComercial: null, direccion: { departamento: '06', municipio: '23', distrito: '14', complemento: 'Dirección de prueba' },
  telefono: '00000000', correo: 'qa@example.invalid', codEstable: 'M001', codPuntoVenta: 'P099',
};
const receptor: Contribuyente = {
  nit: '00000000000000', nrc: '1234567', nombre: 'RECEPTOR FICTICIO', codActividad: '69200', descActividad: 'Actividades de contabilidad',
  nombreComercial: null, direccion: emisor.direccion, telefono: null, correo: null,
};
const ahora = new Date('2026-11-11T16:00:00Z');
const id = (tipo: string, n = 1) => ({ codigoGeneracion: `1832894F-E87E-4452-991C-E67655DC59${String(n).padStart(2, '0')}`, numeroControl: numeroControl(tipo, 'M001', 'P099', n), ahora });

describe('constructores de DTE (esquemas oficiales 2026)', () => {
  it('Factura 01 v2: gravado con IVA incluido, exento, descuento y receptor identificado', () => {
    const doc = validateDte(buildFactura(id('01'), emisor, receptorFactura(receptor), [
      { descripcion: 'Servicio gravado', cantidad: 1, precioUni: 3.39, descuento: 1.13 },
      { descripcion: 'Servicio exento', cantidad: 1, precioUni: 1, tipo: 'EXENTO' },
    ], { condicion: 2, plazoDias: 30 }, 'Prueba'));
    const r = (doc as any).resumen;
    expect(doc.identificacion).toMatchObject({ version: 2, tipoDte: '01', fecEmi: '2026-11-11', horEmi: '10:00:00', tipoModelo: 1 });
    expect(r).toMatchObject({ totalGravada: 2.26, totalExenta: 1, totalDescu: 1.13, totalPagar: 3.26, totalIva: 0.26, condicionOperacion: 2 });
    expect(r.pagos[0]).toMatchObject({ codigo: null, plazo: '01', periodo: 30, montoPago: 3.26 });
  });

  it('Factura en contingencia usa modelo diferido y transmisión por contingencia', () => {
    const doc = validateDte(buildFactura({ ...id('01'), contingencia: { tipo: 2, motivo: null } }, emisor, null,
      [{ descripcion: 'Venta', cantidad: 1, precioUni: 1.13 }], { condicion: 1 }, 'Prueba'));
    expect(doc.identificacion).toMatchObject({ tipoModelo: 2, tipoOperacion: 2, tipoContingencia: 2, motivoContin: null });
  });

  it('CCF 03 v4: IVA 13% en tributos y total a pagar', () => {
    const doc = validateDte(buildCcf(id('03'), emisor, receptor, [{ descripcion: 'Servicio', cantidad: 1, precioUni: 10 }], { condicion: 1, codigo: '01' }, 'Prueba'));
    expect((doc as any).resumen).toMatchObject({ totalGravada: 10, montoTotalOperacion: 11.3, totalPagar: 11.3,
      tributos: [{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: 1.3 }] });
    expect((doc as any).cuerpoDocumento[0].tributos).toEqual(['20']);
  });

  it('NC 05 y ND 06 v4 relacionan el CCF en documentoRelacionado y en cada ítem', () => {
    const rel = { tipoDte: '03' as const, codigoGeneracion: id('03').codigoGeneracion, fecEmi: '2026-11-11' };
    const nc = validateDte(buildNotaCredito(id('05'), emisor, receptor, rel, [{ descripcion: 'Ajuste', cantidad: 1, precioUni: 1 }], 1, 'Prueba'));
    const nd = validateDte(buildNotaDebito(id('06'), emisor, receptor, rel, [{ descripcion: 'Cargo', cantidad: 1, precioUni: 2 }], 1, 'Prueba'));
    expect((nc as any).documentoRelacionado).toEqual([{ tipoDocumento: '03', tipoGeneracion: 2, numeroDocumento: rel.codigoGeneracion, fechaEmision: '2026-11-11' }]);
    // Hacienda rechaza (código 020/096) un totalIva distinto de 0 cuando el IVA va en «tributos» (verificado el 11/11/2026).
    expect((nc as any).cuerpoDocumento[0]).toMatchObject({ numeroDocumento: rel.codigoGeneracion, totalIva: 0, tributos: ['20'] });
    expect((nc as any).resumen).toMatchObject({ totalIva: 0, totalPagar: 1.13 });
    expect((nc as any).resumen.tributos).toEqual([{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: 0.13 }]);
    expect((nd as any).resumen).toMatchObject({ totalPagar: 2.26, numPagoElectronico: null });
    expect((nc as any).receptor).toMatchObject({ tipoDocumento: '36', numDocumento: receptor.nit });
  });

  it('FSE 14 v2 con y sin retención de renta del 10%', () => {
    const sujeto = { tipoDocumento: '37', numDocumento: 'SEPRUEBA0001', nombre: 'SUJETO FICTICIO', codActividad: null, descActividad: null,
      direccion: emisor.direccion, telefono: null, correo: null };
    const servicio = validateDte(buildFse(id('14'), emisor, sujeto, [{ descripcion: 'Servicio', cantidad: 1, precioUni: 20 }], { condicion: 1 }, true, 'Prueba'));
    const bien = validateDte(buildFse(id('14', 2), emisor, sujeto, [{ descripcion: 'Bien', cantidad: 5, precioUni: 1, tipoItem: 1, uniMedida: 59 }], { condicion: 1 }, false, 'Prueba'));
    expect((servicio as any).resumen).toMatchObject({ totalCompra: 20, reteRenta: 2, totalPagar: 18 });
    expect((bien as any).resumen).toMatchObject({ totalCompra: 5, reteRenta: 0, totalPagar: 5 });
  });

  it('eventos de invalidación v3 y contingencia v4 cumplen sus esquemas', () => {
    const resp = { nombre: 'EMISOR FICTICIO', tipoDocumento: '36', numDocumento: emisor.nit };
    const inv = validateEvent('invalidacion', buildInvalidacion('2832894F-E87E-4452-991C-E67655DC5965', ahora, emisor, {
      tipoDte: '01', codigoGeneracion: id('01').codigoGeneracion, selloRecibido: 'A'.repeat(40), numeroControl: id('01').numeroControl, fecEmi: '2026-11-11',
    }, 2, null, 'Prueba', resp, resp));
    expect((inv as any).documento).toMatchObject({ codigoGeneracionR: null, tipoDocumento: null, nombre: null });
    const cont = validateEvent('contingencia', buildContingencia('3832894F-E87E-4452-991C-E67655DC5965', ahora, emisor, resp, '02',
      [{ tipoDte: '01', codigoGeneracion: id('01').codigoGeneracion }], { inicio: new Date(ahora.getTime() - 600_000), fin: new Date(ahora.getTime() - 60_000) }, { tipo: 2, motivo: 'Prueba' }));
    expect((cont as any).motivo).toMatchObject({ fInicio: '2026-11-11', hInicio: '09:50:00', hFin: '09:59:00', tipoContingencia: 2 });
  });

  it('rechaza ambiente distinto de 00 y conversiones auxiliares', () => {
    const doc = buildCcf(id('03'), emisor, receptor, [{ descripcion: 'Servicio', cantidad: 1, precioUni: 10 }], { condicion: 1 }, 'Prueba');
    (doc.identificacion as any).ambiente = '01';
    expect(() => validateDte(doc)).toThrow('ambiente');
    expect(montoEnLetras(11.3)).toBe('ONCE DÓLARES CON 30/100 USD');
    expect(montoEnLetras(1.13)).toBe('UN DÓLAR CON 13/100 USD');
    expect(montoEnLetras(2260)).toBe('DOS MIL DOSCIENTOS SESENTA DÓLARES CON 00/100 USD');
    expect(fechaHoraSV(ahora)).toEqual({ fecha: '2026-11-11', hora: '10:00:00' });
    expect(() => numeroControl('03', 'X001', 'P099', 1)).toThrow();
  });
});
