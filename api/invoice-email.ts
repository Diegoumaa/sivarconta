import { createClient } from '@supabase/supabase-js';
import { COMPANY_COLUMNS, mapCompanies, mapInvoices } from '../src/services/companyRepository.js';
import { isRecipientEmail } from '../src/types/invoiceEmail.js';
import { handleInvoiceEmail, InvoiceEmailError, sendInvoiceViaBrevo, type InvoiceEmailDependencies } from '../server/invoiceEmail.js';

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const roles = ['owner', 'admin', 'accountant', 'billing'];

function dependencies(env: NodeJS.ProcessEnv): InvoiceEmailDependencies {
  const url = env.VITE_SUPABASE_URL?.trim() || '';
  const publicKey = env.VITE_SUPABASE_ANON_KEY?.trim() || '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const apiKey = env.BREVO_API_KEY?.trim() || '';
  const senderEmail = env.BREVO_SENDER_EMAIL?.trim() || '';
  const senderName = env.BREVO_SENDER_NAME?.trim().slice(0, 70) || 'SIVAR FACT';
  const available = (!env.VERCEL_ENV || env.VERCEL_ENV === 'production') &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) &&
    Boolean(publicKey && serviceKey && apiKey && isRecipientEmail(senderEmail));
  const server = () => createClient(url, serviceKey, clientOptions);
  return {
    available,
    async authenticate(token) {
      const auth = createClient(url, publicKey, clientOptions);
      const { data, error } = await auth.auth.getUser(token);
      return error ? null : data.user?.id || null;
    },
    async load(companyId, userId, token, ids) {
      const reader = createClient(url, publicKey, {
        ...clientOptions, global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const membership = await reader.from('company_members').select('role').eq('company_id', companyId).eq('user_id', userId).maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data || !roles.includes(membership.data.role)) {
        throw new InvoiceEmailError(403, 'Tu cuenta no tiene permisos para enviar documentos de esta empresa.');
      }
      const [company, documents] = await Promise.all([
        reader.from('companies').select(COMPANY_COLUMNS).eq('id', companyId).maybeSingle(),
        reader.from('invoices').select('*, invoice_items(*)').eq('company_id', companyId).in('id', ids),
      ]);
      if (company.error || documents.error) throw company.error || documents.error;
      if (!company.data) throw new InvoiceEmailError(403, 'No se encontró una empresa autorizada.');
      return { company: mapCompanies([company.data])[0], invoices: mapInvoices(documents.data || []) };
    },
    async claim(companyId, userId, documents) {
      const { data, error } = await server().rpc('claim_invoice_email_jobs', {
        company: companyId, actor: userId, documents,
      });
      if (error?.message === 'invoice_email_daily_limit') {
        throw new InvoiceEmailError(429, 'Este lote supera el cupo de 300 intentos en 24 horas. Selecciona menos documentos o inténtalo más tarde.');
      }
      if (error?.code === '42501') throw new InvoiceEmailError(403, 'La empresa o el rol ya no está autorizado.');
      if (error?.code === '22023') throw new InvoiceEmailError(409, 'Cambió un documento del lote. Actualiza la lista y vuelve a revisarlo.');
      if (error || !Array.isArray(data)) throw error || new Error('Invalid email reservation response');
      return data.map(row => ({ invoiceId: row.invoice_id, jobId: row.job_id, previousState: row.previous_state }));
    },
    send(jobId, company, invoice, attachment) {
      return sendInvoiceViaBrevo({ apiKey, senderEmail, senderName }, jobId, company, invoice, attachment);
    },
    async finish(jobId, result) {
      const { data, error } = await server().from('invoice_email_jobs').update({
        state: result.status, provider_message_id: result.messageId || null, completed_at: new Date().toISOString(),
      }).eq('id', jobId).eq('state', 'sending').select('id').single();
      if (error || !data) throw error || new Error('Email attempt not finalized');
    },
  };
}

export default {
  fetch(request: Request) {
    return handleInvoiceEmail(request, dependencies(process.env));
  },
};
