import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';

export interface HaciendaDiagnosticEvent {
  logVersion: 1;
  traceId: string;
  secuencia: number;
  fechaUtc: string;
  etapa: string;
  datos: Record<string, unknown>;
}

const storage = new AsyncLocalStorage<{
  traceId: string;
  sequence: number;
  write: (event: HaciendaDiagnosticEvent) => void;
}>();

export async function withHaciendaDiagnostics<T>(write: (event: HaciendaDiagnosticEvent) => void, operation: () => Promise<T>) {
  return storage.run({ traceId: randomUUID(), sequence: 0, write }, async () => {
    recordHaciendaDiagnostic('inicio', { ambiente: '00' });
    try {
      const result = await operation();
      recordHaciendaDiagnostic('fin', { errorLocal: false });
      return result;
    } catch (error) {
      recordHaciendaDiagnostic('fin', { errorLocal: true });
      throw error;
    }
  });
}

// Callers supply only explicit metadata. Never pass bodies, errors, tokens or certificates here.
export function recordHaciendaDiagnostic(etapa: string, datos: Record<string, unknown>) {
  const context = storage.getStore();
  if (!context) return;
  context.write({ logVersion: 1, traceId: context.traceId, secuencia: ++context.sequence, fechaUtc: new Date().toISOString(), etapa, datos });
}

export const diagnosticHash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const masked = (value: unknown) => typeof value === 'string' && /^\d{14}$/.test(value) ? `**********${value.slice(-4)}` : null;
const code = (value: unknown) => typeof value === 'string' && /^\d{1,4}$/.test(value) ? value : null;
const generationCode = (value: unknown) => typeof value === 'string' && /^[A-F0-9-]{36}$/.test(value) ? value : null;

export function summarizeHaciendaRequest(body: URLSearchParams | string) {
  if (typeof body !== 'string') {
    return { campos: [...body.keys()].sort(), nitEnmascarado: masked(body.get('user')), clavePresente: Boolean(body.get('pwd')) };
  }
  const data = JSON.parse(body);
  const summary: Record<string, unknown> = {
    campos: Object.keys(data).sort(),
    tipos: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === null ? 'null' : typeof value])),
    bytesUtf8: Buffer.byteLength(body), sha256: diagnosticHash(body),
    ambiente: ['00', '01'].includes(data.ambiente) ? data.ambiente : null,
    version: Number.isInteger(data.version) ? data.version : null,
    tipoDte: code(data.tipoDte || data.tdte),
    codigoGeneracion: generationCode(data.codigoGeneracion),
    idEnvio: Number.isSafeInteger(data.idEnvio) ? data.idEnvio : null,
    nitEnmascarado: masked(data.nitEmisor),
  };
  if (typeof data.documento === 'string') {
    const parts = data.documento.split('.');
    summary.jws = { segmentos: parts.length, caracteres: data.documento.length, sha256: diagnosticHash(data.documento) };
    if (parts.length === 3) {
      try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        const document = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        summary.jws = {
          ...summary.jws as object, algoritmo: header.alg === 'RS512' ? 'RS512' : 'otro',
          payloadSha256: diagnosticHash(Buffer.from(parts[1], 'base64url')),
          firmaBytes: Buffer.from(parts[2], 'base64url').length,
          version: Number.isInteger(document.identificacion?.version) ? document.identificacion.version : null,
          tipoDte: code(document.identificacion?.tipoDte),
          codigoGeneracion: generationCode(document.identificacion?.codigoGeneracion),
          nitEnmascarado: masked(document.emisor?.nit),
        };
      } catch { summary.jwsDecodificable = false; }
    }
  }
  return summary;
}

export function summarizeHaciendaResponse(json: unknown, response: Response, durationMs: number) {
  const data = json as Record<string, unknown> | null;
  const responseHeaders: Record<string, string> = {};
  for (const name of ['server', 'date', 'content-type', 'x-request-id', 'x-correlation-id', 'request-id', 'traceparent', 'via']) {
    const value = response.headers.get(name);
    if (value && /^[\x20-\x7e]{1,180}$/.test(value)) responseHeaders[name] = value;
  }
  return {
    http: response.status, duracionMs: durationMs, respuestaJson: json !== null, cabeceras: responseHeaders,
    campos: data && typeof data === 'object' ? Object.keys(data).sort() : [],
    codigoMsg: code(data?.codigoMsg), clasificaMsg: code(data?.clasificaMsg),
    estado: ['PROCESADO', 'RECHAZADO', 'RECIBIDO'].includes(String(data?.estado)) ? data?.estado : null,
    codigoGeneracion: generationCode(data?.codigoGeneracion),
    selloPresente: typeof data?.selloRecibido === 'string' && data.selloRecibido.length > 0,
    observacionesCantidad: Array.isArray(data?.observaciones) ? data.observaciones.length : 0,
  };
}

function decodeTokenClaims(token: string) {
  return JSON.parse(Buffer.from(token.replace(/^Bearer /, '').split('.')[1], 'base64url').toString('utf8'));
}

// Las autoridades son nombres de rol (p. ej. USER, USER_API), no secretos. El token oficial de ejemplo del
// Manual Tecnológico V2.0 trae ["USER","USER_API","Usuario"]; una credencial que no es del usuario API no trae USER_API.
export function haciendaTokenAuthorities(token: string): string[] | null {
  try {
    const authorities = decodeTokenClaims(token).authorities;
    if (!Array.isArray(authorities)) return [];
    return authorities.filter((value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value));
  } catch { return null; }
}

export function summarizeHaciendaToken(token: string, nit: string) {
  try {
    const claims = decodeTokenClaims(token);
    const sameNit = (value: unknown) => typeof value === 'string' ? value.replace(/-/g, '') === nit : null;
    const autoridades = haciendaTokenAuthorities(token) || [];
    return {
      nitClaimPresente: typeof claims.c_nit === 'string', nitClaimCoincide: sameNit(claims.c_nit),
      sujetoCoincide: sameNit(claims.sub),
      expiracionFutura: typeof claims.exp === 'number' ? claims.exp * 1000 > Date.now() : null,
      autoridades, usuarioApi: autoridades.includes('USER_API'),
    };
  } catch { return { claimsDecodificables: false }; }
}
