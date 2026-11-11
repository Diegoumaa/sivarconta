import { createClient } from '@supabase/supabase-js';
import { appendFileSync, readFileSync } from 'node:fs';
import { handleMhTestEmission, type MhAppDependencies } from '../server/mhAppEmission.js';
import { actividadEconomica, type AppDteContext } from '../server/mhAppDte.js';
import { consultDte, signJson, transmitDte, transmitInvalidacion, validateDte, validateEvent, type DteDocument, type EventDocument } from '../server/mhDte.js';
import { authenticateHaciendaTest } from '../server/mhTest.js';
import { mapInvoices } from '../src/services/companyRepository.js';
import { isTeamId } from '../src/types/companyTeam.js';
import { withHaciendaDiagnostics } from '../server/mhTestDiagnostics.js';

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

export function mhAppDependencies(env: NodeJS.ProcessEnv): MhAppDependencies {
  const url = env.VITE_SUPABASE_URL || '';
  const publicKey = env.VITE_SUPABASE_ANON_KEY || '';
  const secret = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const nit = env.MH_TEST_NIT || '';
  const companyId = env.MH_TEST_COMPANY_ID || '';
  let issuer: Record<string, any> = {};
  try {
    const value = JSON.parse(env.MH_TEST_ISSUER_JSON || '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) issuer = value;
  } catch { /* Closed until configured. */ }
  const server = () => createClient(url, secret, options);
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await server().rpc(name, args);
    if (error) throw error;
    return data;
  };
  // Certificado y claves solo en el entorno del servidor; nunca se registran ni se devuelven.
  const certificate = () => env.MH_TEST_CERTIFICATE_XML || readFileSync(env.MH_TEST_CERTIFICATE!, 'utf8');
  const signingPassword = () => env.MH_TEST_SIGNING_PASSWORD || '';
  const asDte = (document: unknown) => validateDte(document as DteDocument);
  return {
    available: /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && Boolean(publicKey && secret
      && companyId && /^\d{14}$/.test(nit) && issuer.nit === nit && env.MH_TEST_API_PASSWORD
      && env.MH_TEST_SIGNING_PASSWORD && (env.MH_TEST_CERTIFICATE_XML || env.MH_TEST_CERTIFICATE)),
    companyId, nit, issuer,
    async authenticateUser(token) {
      const { data, error } = await createClient(url, publicKey, options).auth.getUser(token);
      return error ? null : data.user?.id || null;
    },
    async reserve(company, invoice, actor) {
      const data = await rpc('reserve_mh_test_emission', { p_company: company, p_invoice: invoice, p_actor: actor });
      return { ...data, invoice: mapInvoices([data.invoice])[0] };
    },
    async prepare(invoice, lease, document) { await rpc('prepare_mh_test_emission', { p_invoice: invoice, p_lease: lease, p_document: document }); },
    async start(invoice, lease) { await rpc('start_mh_test_emission', { p_invoice: invoice, p_lease: lease }); },
    async finish(invoice, lease, result) {
      const data = await rpc('finish_mh_test_emission', { p_invoice: invoice, p_lease: lease, p_result: result });
      return mapInvoices([data])[0];
    },
    async release(invoice, lease, reason) {
      const data = await rpc('release_mh_test_emission', { p_invoice: invoice, p_lease: lease, p_reason: reason });
      return mapInvoices([data])[0];
    },
    authenticateHacienda: () => authenticateHaciendaTest(nit, env.MH_TEST_API_PASSWORD || ''),
    // Mismo núcleo (mhDte) con el que Hacienda aceptó las pruebas de acreditación de 01, 03, 05, 06 y 14.
    sign: document => signJson(asDte(document), certificate(), signingPassword()),
    consult(document, token) {
      const { identificacion, emisor } = asDte(document);
      return consultDte(identificacion.tipoDte, emisor.nit, identificacion.codigoGeneracion, token);
    },
    // No configurable host, environment or USER_API bypass is exposed by this endpoint.
    transmit: (document, signature, token) => transmitDte(asDte(document), signature, token),
    async loadContext(invoice, overrides) {
      const db = server();
      let client: Record<string, any> | null = null;
      if (isTeamId(invoice.clientId)) {
        const { data, error } = await db.from('clients')
          .select('id,nrc,economic_activity,district_code,department,municipality,address,phone,email')
          .eq('company_id', companyId).eq('id', invoice.clientId).maybeSingle();
        if (error) throw error;
        client = data;
      }
      // Lo que el usuario completa en el panel queda guardado en su cliente para las próximas emisiones.
      const patch: Record<string, string> = {};
      if (overrides.distrito) patch.district_code = overrides.distrito;
      if (overrides.actividad) {
        const actividad = actividadEconomica(overrides.actividad);
        patch.economic_activity = `${actividad.codActividad} - ${actividad.descActividad}`;
      }
      if (client && Object.keys(patch).length) {
        const { error } = await db.from('clients').update(patch).eq('company_id', companyId).eq('id', client.id);
        if (error) throw error;
      }
      const context: AppDteContext = {
        client: {
          id: client?.id, nrc: client?.nrc, economicActivity: patch.economic_activity ?? client?.economic_activity,
          districtCode: patch.district_code ?? client?.district_code, department: client?.department, municipality: client?.municipality,
          address: client?.address, phone: client?.phone, email: client?.email,
        },
      };
      if (invoice.dteType === '05' || invoice.dteType === '06') {
        // El documento relacionado se indica por su código de generación o número de control y debe ser un CCF sellado en 00.
        const ref = (invoice.referencedDte || '').trim().toUpperCase();
        if (ref) {
          const column = UUID.test(ref) ? 'generation_code' : 'control_number';
          const { data, error } = await db.from('invoices')
            .select('generation_code,emission_date,dte_type,status,mh_environment,mh_reception_stamp')
            .eq('company_id', companyId).eq(column, ref).limit(1).maybeSingle();
          if (error) throw error;
          if (data && data.dte_type === '03' && data.status === 'PROCESADO' && data.mh_environment === '00' && data.mh_reception_stamp) {
            context.relacionado = { codigoGeneracion: String(data.generation_code).toUpperCase(), fecEmi: data.emission_date, dteType: '03' };
          }
        }
      }
      return context;
    },
    async reserveInvalidation(company, invoice, actor) {
      const data = await rpc('reserve_mh_test_invalidation', { p_company: company, p_invoice: invoice, p_actor: actor });
      return { ...data, invoice: mapInvoices([data.invoice])[0] };
    },
    async prepareInvalidation(invoice, lease, event) { await rpc('prepare_mh_test_invalidation', { p_invoice: invoice, p_lease: lease, p_document: event }); },
    async startInvalidation(invoice, lease) { await rpc('start_mh_test_invalidation', { p_invoice: invoice, p_lease: lease }); },
    async finishInvalidation(invoice, lease, result) {
      const data = await rpc('finish_mh_test_invalidation', { p_invoice: invoice, p_lease: lease, p_result: result });
      return mapInvoices([data])[0];
    },
    signEvent: event => signJson(validateEvent('invalidacion', event as unknown as EventDocument), certificate(), signingPassword()),
    transmitInvalidation: (event, signature, token) =>
      transmitInvalidacion(event as unknown as EventDocument & { documento: { codigoGeneracion: string } }, signature, token),
  };
}
export default { fetch(request: Request) {
  return withHaciendaDiagnostics(event => {
    // Allowlisted metadata only. No raw credentials, bodies, JWT claims or JWS.
    try {
      if (process.env.MH_TEST_LOG_PATH) appendFileSync(process.env.MH_TEST_LOG_PATH, JSON.stringify(event) + '\n', { mode: 0o600 });
      else console.info(JSON.stringify(event));
    } catch { /* Logging failure must not change the emission state machine. */ }
  }, () => handleMhTestEmission(request, mhAppDependencies(process.env)));
} };
