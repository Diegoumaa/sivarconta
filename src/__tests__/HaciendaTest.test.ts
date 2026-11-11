// @vitest-environment node
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateHaciendaTest, consultTestInvoice, haciendaTokenProfile, signTestInvoice, transmitTestInvoice, validateTestInvoice } from '../../server/mhTest.js';
import { prepareTestFactura } from '../../server/mhTestFactura.js';

const generationCode = '1832894F-E87E-4452-991C-E67655DC5965';
const issuer = {
  establecimientoControl: 'M001', puntoVentaControl: 'P001', correlativo: '5',
  emisor: {
    nit: '00000000000000', nrc: '1234567', nombre: 'Emisor ficticio', codActividad: '62010',
    descActividad: 'Programación informática', nombreComercial: null,
    direccion: { departamento: '06', municipio: '23', distrito: '14', complemento: 'Dirección de prueba' },
    telefono: '00000000', correo: 'qa@example.invalid', codEstable: null, codPuntoVenta: null,
  },
};
const draft = {
  generationCode, totalPagar: 1.13, totalLetras: 'UN DÓLAR CON 13/100 USD',
  items: [{ description: 'Servicio ficticio', unitOfMeasure: '99', quantity: 1, unitPrice: 1.13 }],
};
const now = new Date('2026-11-09T23:35:17Z');
const sample = () => prepareTestFactura(draft, issuer, now);
const missing = () => Response.json({ ambiente: '00', codigoMsg: '999', descripcionMsg: 'No se encontro ningun registro que coincida' }, { status: 400 });
// Tokens ficticios con la forma de los reales: el del manual oficial trae USER_API; el observado el 10/11/2026 no.
const fakeToken = (authorities: string[]) => `eyJhbGciOiJIUzUxMiJ9.${Buffer.from(JSON.stringify({
  sub: issuer.emisor.nit, authorities, c_nit: issuer.emisor.nit, exp: 4102444800,
})).toString('base64url')}.firmaFicticia`;
const apiToken = `Bearer ${fakeToken(['USER', 'USER_API', 'Usuario'])}`;
const nonApiToken = `Bearer ${fakeToken(['USER', 'USER'])}`;
const rejection094 = () => Response.json({
  version: 2, ambiente: '00', versionApp: 2, estado: 'RECHAZADO', codigoGeneracion: null, selloRecibido: null,
  clasificaMsg: '99', codigoMsg: '094', descripcionMsg: 'ESTIMADO CONTRIBUYENTE VERIFIQUE SU TIPO DE SOLICITUD DTE',
  observaciones: ['Faltan datos en peticion para procesar informacion'],
}, { status: 400 });

afterEach(() => vi.unstubAllGlobals());

describe('Hacienda ambiente de pruebas', () => {
  it('construye y valida una factura v2 con IVA incluido y hora de El Salvador', () => {
    const invoice = sample();
    expect(invoice.identificacion).toMatchObject({
      ambiente: '00', version: 2, fecEmi: '2026-11-09', horEmi: '17:35:17',
      numeroControl: 'DTE-01-M001P001-000000000000005',
    });
    expect(invoice.cuerpoDocumento[0].ivaItem).toBe(0.13);
    expect(invoice.resumen).toMatchObject({ totalIva: 0.13, totalPagar: 1.13 });
    expect(invoice.receptor).toBeNull();
  });

  it('rechaza producción, campos ajenos al esquema y montos inconsistentes del borrador', () => {
    const invoice = sample();
    expect(() => validateTestInvoice({ ...invoice, identificacion: { ...invoice.identificacion, ambiente: '01' } }))
      .toThrow('ambiente del documento debe ser 00');
    expect(() => validateTestInvoice({ ...invoice, selloRecibido: 'prueba' })).toThrow('no cumple el esquema');
    expect(() => prepareTestFactura({ ...draft, totalPagar: 5 }, issuer, now)).toThrow('no coinciden');
  });

  it('verifica NIT y contraseña del XML y genera una firma RS512 verificable', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const password = 'clave-ficticia';
    const hash = createHash('sha512').update(password).digest('hex');
    const xml = `<CertificadoMH><nit>${issuer.emisor.nit}</nit><activo>true</activo>
      <publicKey><encodied>${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}</encodied></publicKey>
      <privateKey><encodied>${privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')}</encodied><clave>${hash}</clave></privateKey>
      </CertificadoMH>`;
    const invoice = validateTestInvoice(sample());
    expect(() => signTestInvoice(invoice, xml, 'incorrecta')).toThrow('contraseña de firma');
    expect(() => signTestInvoice(invoice, xml.replace(issuer.emisor.nit, '11111111111111'), password)).toThrow('NIT no coincide');
    const [header, payload, signature] = signTestInvoice(invoice, xml, password).split('.');
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'RS512' });
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual(invoice);
    expect(verify('RSA-SHA512', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
  });

  it('autentica y transmite exclusivamente al host de pruebas y comprueba la respuesta', async () => {
    const token = fakeToken(['USER', 'USER_API', 'Usuario']);
    const stamp = 'A'.repeat(40);
    const receipt = { estado: 'PROCESADO', ambiente: '00', codigoGeneracion: generationCode, selloRecibido: stamp };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ status: 'OK', body: { token } }))
      .mockResolvedValueOnce(missing())
      .mockResolvedValueOnce(Response.json(receipt))
      .mockResolvedValueOnce(Response.json({ ...receipt, codigoGeneracion: 'otra-factura' }));
    vi.stubGlobal('fetch', fetchMock);
    const auth = await authenticateHaciendaTest(issuer.emisor.nit, 'api-ficticia');
    const invoice = validateTestInvoice(sample());
    expect(await transmitTestInvoice(invoice, 'jws-de-prueba', auth, { ahora: now })).toMatchObject({
      estado: 'PROCESADO', selloRecibido: stamp,
    });
    expect(await consultTestInvoice(invoice, auth)).toMatchObject({ estado: 'SIN_CONFIRMAR', selloRecibido: null });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://apitest.dtes.mh.gob.sv/seguridad/auth',
      'https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadte',
      'https://apitest.dtes.mh.gob.sv/fesv/recepciondte',
      'https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadte',
    ]);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${token}`);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      ambiente: '00', idEnvio: 5, version: 2, codigoGeneracion: generationCode,
    });
  });

  it('recupera el sello existente sin volver a transmitir el mismo documento', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({
      estado: 'PROCESADO', ambiente: '00', codigoGeneracion: generationCode, selloRecibido: 'B'.repeat(40),
    }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await transmitTestInvoice(validateTestInvoice(sample()), 'jws', 'Bearer token')).toMatchObject({
      estado: 'PROCESADO', reenvioEvitado: true, selloRecibido: 'B'.repeat(40),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/recepcion/consultadte');
  });

  it('reconoce la consulta real de un DTE aceptado (HTTP 202, 11/11/2026) y no lo reenvía', async () => {
    // Forma real devuelta por /fesv/recepcion/consultadte para la factura piloto aceptada en ambiente 00.
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({
      version: 2, ambiente: '00', versionApp: 2, estado: 'PROCESADO', codigoGeneracion: generationCode,
      selloRecibido: '2026AF011A796B2541AC881BD2281F92385BZ8XH', fhProcesamiento: '',
      clasificaMsg: '10', codigoMsg: '001', descripcionMsg: 'RECIBIDO', observaciones: [],
    }, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await transmitTestInvoice(validateTestInvoice(sample()), 'jws', apiToken, { ahora: now })).toMatchObject({
      http: 202, estado: 'PROCESADO', reenvioEvitado: true, selloRecibido: '2026AF011A796B2541AC881BD2281F92385BZ8XH',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 503, body: { codigoMsg: '999', descripcionMsg: 'Servicio no disponible' } },
    { status: 400, body: { ambiente: '00', codigoMsg: '999', descripcionMsg: 'Otro error' } },
    { status: 200, body: { ambiente: '01', estado: 'PROCESADO', codigoGeneracion: generationCode, selloRecibido: 'C'.repeat(40) } },
  ])('no transmite cuando la consulta previa es ambigua: $status / $body.descripcionMsg', async ({ status, body }) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(body, { status }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(transmitTestInvoice(validateTestInvoice(sample()), 'jws', 'Bearer token')).rejects.toThrow('No se reenvió');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('conserva el rechazo 094 sin atribuirlo a una factura ni inventar un sello, con pista accionable', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(missing()).mockResolvedValueOnce(rejection094());
    vi.stubGlobal('fetch', fetchMock);
    const result = await transmitTestInvoice(validateTestInvoice(sample()), 'jws', apiToken, { ahora: now });
    expect(result).toMatchObject({
      estado: 'SIN_CONFIRMAR', estadoReportado: 'RECHAZADO', codigoGeneracionReportado: null,
      selloRecibido: null, codigoMsg: '094', clasificaMsg: '99', respuestaJson: true,
    });
    expect(result.pista).toContain('PARAMETROS NO SON VALIDOS');
    expect(result.pista).toContain('USER_API');
  });

  it('distingue el token del usuario API (USER_API) del token observado que provoca 094', () => {
    expect(haciendaTokenProfile(apiToken)).toEqual({ decodificable: true, autoridades: ['USER', 'USER_API', 'Usuario'], usuarioApi: true });
    expect(haciendaTokenProfile(nonApiToken)).toEqual({ decodificable: true, autoridades: ['USER', 'USER'], usuarioApi: false });
    expect(haciendaTokenProfile('Bearer no-es-un-jwt')).toEqual({ decodificable: false, autoridades: [], usuarioApi: false });
    // Un nombre de autoridad parecido no basta: debe ser exactamente USER_API.
    expect(haciendaTokenProfile(`Bearer ${fakeToken(['USER', 'NOT_USER_API_LIKE'])}`).usuarioApi).toBe(false);
  });

  it('no transmite con un token sin USER_API: consulta antes, explica la causa y no llama a recepción', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(missing());
    vi.stubGlobal('fetch', fetchMock);
    await expect(transmitTestInvoice(validateTestInvoice(sample()), 'jws', nonApiToken, { ahora: now }))
      .rejects.toThrow('no incluye la autoridad USER_API (autoridades recibidas: USER, USER)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://apitest.dtes.mh.gob.sv/fesv/recepcion/consultadte');
  });

  it('solo transmite sin USER_API cuando el experimento lo pide explícitamente', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(missing()).mockResolvedValueOnce(rejection094());
    vi.stubGlobal('fetch', fetchMock);
    const result = await transmitTestInvoice(validateTestInvoice(sample()), 'jws', nonApiToken, { ahora: now, permitirSinUsuarioApi: true });
    expect(result).toMatchObject({ estado: 'SIN_CONFIRMAR', codigoMsg: '094', selloRecibido: null });
    expect(fetchMock.mock.calls[1][0]).toBe('https://apitest.dtes.mh.gob.sv/fesv/recepciondte');
  });

  it.each([
    { label: '40 minutos después', offset: 40 },
    { label: '26 minutos después', offset: 26 },
    { label: '30 minutos antes (reloj adelantado)', offset: -30 },
  ])('no transmite una factura cuya hora de emisión está fuera de la ventana: $label', async ({ offset }) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(missing());
    vi.stubGlobal('fetch', fetchMock);
    await expect(transmitTestInvoice(validateTestInvoice(sample()), 'jws', apiToken, { ahora: new Date(now.getTime() + offset * 60_000) }))
      .rejects.toThrow('Vuelva a preparar la factura');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('acepta transmitir dentro de la ventana de 25 minutos', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(missing()).mockResolvedValueOnce(rejection094());
    vi.stubGlobal('fetch', fetchMock);
    await transmitTestInvoice(validateTestInvoice(sample()), 'jws', apiToken, { ahora: new Date(now.getTime() + 24 * 60_000) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('detiene el envío si falla la red al consultar y conserva respuestas sin JSON', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Tiempo agotado'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(transmitTestInvoice(validateTestInvoice(sample()), 'jws', 'Bearer token')).rejects.toThrow('Tiempo agotado');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect(await consultTestInvoice(validateTestInvoice(sample()), 'Bearer token')).toMatchObject({
      http: 401, respuestaJson: false, estado: 'SIN_CONFIRMAR', selloRecibido: null,
    });
  });
});
