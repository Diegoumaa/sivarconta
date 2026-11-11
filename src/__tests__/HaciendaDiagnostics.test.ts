// @vitest-environment node
import { createHash, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateHaciendaTest, consultTestInvoice, signTestInvoice, validateTestInvoice } from '../../server/mhTest.js';
import { prepareTestFactura } from '../../server/mhTestFactura.js';
import { recordHaciendaDiagnostic, summarizeHaciendaRequest, summarizeHaciendaToken, withHaciendaDiagnostics, type HaciendaDiagnosticEvent } from '../../server/mhTestDiagnostics.js';

afterEach(() => vi.unstubAllGlobals());

describe('diagnóstico de Hacienda sin credenciales', () => {
  it('registra validación, firma, autenticación y HTTP sin copiar claves, token, certificado ni datos de la factura', async () => {
    const nit = '00000000000000';
    const password = 'CLAVE-PRIVADA-FICTICIA';
    const apiPassword = 'CLAVE-API-FICTICIA';
    const token = `eyJhbGciOiJIUzUxMiJ9.${Buffer.from(JSON.stringify({ c_nit: nit, sub: nit, exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url')}.firmaFicticia`;
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateDer = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
    const xml = `<CertificadoMH><nit>${nit}</nit><activo>true</activo><privateKey><encodied>${privateDer}</encodied><clave>${createHash('sha512').update(password).digest('hex')}</clave></privateKey><publicKey><encodied>${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}</encodied></publicKey></CertificadoMH>`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ status: 'OK', body: { token, debug: apiPassword } }))
      .mockResolvedValueOnce(Response.json({ codigoMsg: '999', observaciones: [password] }, { status: 400, headers: { 'x-request-id': 'request-123', 'set-cookie': 'credencial-secreta' } }));
    vi.stubGlobal('fetch', fetchMock);
    const events: HaciendaDiagnosticEvent[] = [];
    let jws = '';
    await withHaciendaDiagnostics(event => events.push(event), async () => {
      const invoice = validateTestInvoice(prepareTestFactura({
        generationCode: '1832894F-E87E-4452-991C-E67655DC5965', totalPagar: 1.13, totalLetras: 'UN DÓLAR CON 13/100',
        items: [{ description: 'DESCRIPCION-PRIVADA', quantity: 1, unitPrice: 1.13, unitOfMeasure: '99' }],
      }, {
        establecimientoControl: 'M001', puntoVentaControl: 'P001', correlativo: '1',
        emisor: { nit, nrc: '1234567', nombre: 'EMPRESA-PRIVADA', codActividad: '62010', descActividad: 'Programación informática', nombreComercial: null, direccion: { departamento: '06', municipio: '23', distrito: '14', complemento: 'DIRECCION-PRIVADA' }, telefono: '00000000', correo: 'privado@example.invalid', codEstable: null, codPuntoVenta: null },
      }));
      jws = signTestInvoice(invoice, xml, password);
      recordHaciendaDiagnostic('prueba_cuerpo', summarizeHaciendaRequest(JSON.stringify({ ambiente: '00', idEnvio: 1, version: 2, tipoDte: '01', codigoGeneracion: invoice.identificacion.codigoGeneracion, documento: jws })));
      const auth = await authenticateHaciendaTest(nit, apiPassword);
      await consultTestInvoice(invoice, auth);
    });
    const text = JSON.stringify(events);
    for (const secret of [nit, password, apiPassword, token, privateDer, xml, jws, 'credencial-secreta', 'EMPRESA-PRIVADA', 'DIRECCION-PRIVADA', 'DESCRIPCION-PRIVADA', 'privado@example.invalid']) {
      expect(text).not.toContain(secret);
    }
    expect(events.map(e => e.etapa)).toEqual(expect.arrayContaining(['esquema', 'firma_local', 'peticion_http', 'respuesta_http', 'autenticacion', 'fin']));
    expect(events.find(e => e.etapa === 'autenticacion')?.datos).toMatchObject({ confirmada: true, nitClaimCoincide: true, expiracionFutura: true });
    expect(events.filter(e => e.etapa === 'respuesta_http').at(-1)?.datos).toMatchObject({ http: 400, codigoMsg: '999', cabeceras: { 'x-request-id': 'request-123' } });
    expect(new Set(events.map(e => e.traceId)).size).toBe(1);
    expect(events.map(e => e.secuencia)).toEqual(events.map((_, i) => i + 1));
  });

  it('no guarda el cuerpo ni su huella cuando contiene la contraseña API', () => {
    const body = new URLSearchParams({ user: '12345678901234', pwd: 'api-secreta' });
    expect(summarizeHaciendaRequest(body)).toEqual({ campos: ['pwd', 'user'], nitEnmascarado: '**********1234', clavePresente: true });
  });

  it('identifica una identidad distinta o un token no decodificable sin revelar sus claims', () => {
    const token = `a.${Buffer.from(JSON.stringify({ c_nit: '11111111111111', sub: 'usuario-privado', exp: 1 })).toString('base64url')}.b`;
    expect(summarizeHaciendaToken(token, '00000000000000')).toMatchObject({ nitClaimCoincide: false, sujetoCoincide: false, expiracionFutura: false });
    expect(summarizeHaciendaToken('no-es-jwt', '00000000000000')).toEqual({ claimsDecodificables: false });
  });

  it('registra el tipo de credencial (autoridades y USER_API) sin copiar otros claims', () => {
    const nit = '00000000000000';
    const claims = { sub: nit, c_nit: nit, c_dui: 'DUI-PRIVADO', exp: 4102444800 };
    const withApi = `a.${Buffer.from(JSON.stringify({ ...claims, authorities: ['USER', 'USER_API', 'Usuario'] })).toString('base64url')}.b`;
    const withoutApi = `a.${Buffer.from(JSON.stringify({ ...claims, authorities: ['USER', 'USER', '<script>'] })).toString('base64url')}.b`;
    expect(summarizeHaciendaToken(withApi, nit)).toMatchObject({ autoridades: ['USER', 'USER_API', 'Usuario'], usuarioApi: true });
    const summary = summarizeHaciendaToken(withoutApi, nit);
    expect(summary).toMatchObject({ autoridades: ['USER', 'USER'], usuarioApi: false });
    expect(JSON.stringify(summary)).not.toContain('DUI-PRIVADO');
  });

  it('separa las trazas concurrentes y no continúa registrando al salir del contexto', async () => {
    const first: HaciendaDiagnosticEvent[] = [];
    const second: HaciendaDiagnosticEvent[] = [];
    await Promise.all([
      withHaciendaDiagnostics(e => first.push(e), async () => { await Promise.resolve(); recordHaciendaDiagnostic('primera', {}); }),
      withHaciendaDiagnostics(e => second.push(e), async () => { await Promise.resolve(); recordHaciendaDiagnostic('segunda', {}); }),
    ]);
    recordHaciendaDiagnostic('fuera', {});
    expect(first.map(e => e.etapa)).toEqual(['inicio', 'primera', 'fin']);
    expect(second.map(e => e.etapa)).toEqual(['inicio', 'segunda', 'fin']);
    expect(first[0].traceId).not.toBe(second[0].traceId);
  });

  it('registra el fallo de red sin copiar el texto potencialmente sensible de la excepción', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('apiPassword=NO-REGISTRAR')));
    const events: HaciendaDiagnosticEvent[] = [];
    await expect(withHaciendaDiagnostics(e => events.push(e), async () => authenticateHaciendaTest('00000000000000', 'NO-REGISTRAR'))).rejects.toThrow();
    expect(JSON.stringify(events)).not.toContain('NO-REGISTRAR');
    expect(events.find(e => e.etapa === 'error_http')?.datos).toMatchObject({ ruta: '/seguridad/auth', tipo: 'Error' });
    expect(events.at(-1)?.datos).toEqual({ errorLocal: true });
  });
});
