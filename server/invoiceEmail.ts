import { DTE_NAMES, type Company, type InvoiceDocument } from '../src/types/index.js';
import { invoiceEmailIssue, isRecipientEmail, MAX_INVOICE_EMAIL_BATCH, type InvoiceEmailSelection, type InvoiceEmailResult } from '../src/types/invoiceEmail.js';
import { invoiceEmailPdf } from './invoiceEmailPdf.js';

const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
type Job = { invoiceId: string; jobId: string | null; previousState: string | null };
export type ProviderResult = { status: 'accepted' | 'rejected' | 'uncertain'; messageId?: string };
export class InvoiceEmailError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export interface InvoiceEmailDependencies {
  available: boolean;
  authenticate(token: string): Promise<string | null>;
  load(companyId: string, userId: string, token: string, ids: string[]): Promise<{ company: Company; invoices: InvoiceDocument[] }>;
  claim(companyId: string, userId: string, documents: InvoiceEmailSelection[]): Promise<Job[]>;
  send(jobId: string, company: Company, invoice: InvoiceDocument, attachment: string): Promise<ProviderResult>;
  finish(jobId: string, result: ProviderResult): Promise<void>;
}

function parseBatch(body: unknown): { companyId: string; documents: InvoiceEmailSelection[] } {
  const input = body as { companyId?: unknown; documents?: unknown } | null;
  if (!input || typeof input.companyId !== 'string' || !uuidPattern.test(input.companyId) ||
      !Array.isArray(input.documents) || !input.documents.length || input.documents.length > MAX_INVOICE_EMAIL_BATCH) {
    throw new InvoiceEmailError(400, `Selecciona entre 1 y ${MAX_INVOICE_EMAIL_BATCH} documentos de una empresa.`);
  }
  const documents: InvoiceEmailSelection[] = [];
  for (const row of input.documents) {
    if (!row || typeof row.invoiceId !== 'string' || !uuidPattern.test(row.invoiceId) || !isRecipientEmail(row.email)) {
      throw new InvoiceEmailError(400, 'Revisa la selección y el correo registrado de cada documento.');
    }
    documents.push({ invoiceId: row.invoiceId.toLowerCase(), email: row.email });
  }
  if (new Set(documents.map(row => row.invoiceId)).size !== documents.length) {
    throw new InvoiceEmailError(400, 'Un documento aparece dos veces en el lote.');
  }
  return { companyId: input.companyId.toLowerCase(), documents };
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleInvoiceEmail(request: Request, deps: InvoiceEmailDependencies): Promise<Response> {
  if (request.method === 'GET') return json({ available: deps.available });
  if (request.method !== 'POST') return json({ error: 'Método no admitido.' }, 405);
  const token = request.headers.get('authorization')?.match(/^Bearer ([\w.-]+)$/i)?.[1];
  if (!token) return json({ error: 'Inicia sesión para enviar documentos.' }, 401);
  if (!deps.available) return json({ error: 'El servicio de correo aún no está configurado.' }, 503);

  try {
    const userId = await deps.authenticate(token);
    if (!userId) throw new InvoiceEmailError(401, 'La sesión venció. Vuelve a iniciar sesión.');
    const raw = await request.text();
    if (raw.length > 14_000) throw new InvoiceEmailError(413, 'El lote supera el tamaño admitido.');
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new InvoiceEmailError(400, 'La solicitud no es válida.'); }
    const { companyId, documents } = parseBatch(input);
    const { company, invoices } = await deps.load(companyId, userId, token, documents.map(row => row.invoiceId));
    if (company.id !== companyId || company.mhEnvironment !== 'PRODUCCION') {
      throw new InvoiceEmailError(409, 'Los envíos reales requieren una empresa en ambiente de producción.');
    }

    const byId = new Map(invoices.map(invoice => [invoice.id, invoice]));
    const prepared = new Map<string, { invoice: InvoiceDocument; attachment: string }>();
    for (const selected of documents) {
      const invoice = byId.get(selected.invoiceId);
      if (!invoice || invoice.companyId !== companyId) throw new InvoiceEmailError(403, 'Hay documentos que no pertenecen a esta empresa.');
      if (invoiceEmailIssue(invoice) || invoice.clientEmail.trim() !== selected.email) {
        throw new InvoiceEmailError(409, 'Un documento o destinatario cambió. Actualiza la lista y revisa el lote nuevamente.');
      }
      prepared.set(invoice.id, { invoice, attachment: invoiceEmailPdf(company, invoice) });
    }

    const jobs = await deps.claim(companyId, userId, documents);
    if (jobs.length !== documents.length || new Set(jobs.map(job => job.invoiceId)).size !== documents.length ||
        jobs.some(job => !prepared.has(job.invoiceId) || (!job.jobId && !job.previousState))) {
      throw new InvoiceEmailError(503, 'No se pudo confirmar la reserva de envío. Consulta el estado antes de reintentar.');
    }
    const results: InvoiceEmailResult[] = [];
    for (let start = 0; start < jobs.length; start += 4) {
      const outcomes = await Promise.all(jobs.slice(start, start + 4).map(async (job): Promise<InvoiceEmailResult> => {
        if (!job.jobId) return { invoiceId: job.invoiceId, state: job.previousState === 'accepted' ? 'already_accepted' : 'review' };
        const { invoice, attachment } = prepared.get(job.invoiceId)!;
        let result: ProviderResult;
        try { result = await deps.send(job.jobId, company, invoice, attachment); } catch { result = { status: 'uncertain' }; }
        try { await deps.finish(job.jobId, result); } catch { return { invoiceId: job.invoiceId, state: 'review' }; }
        return { invoiceId: job.invoiceId, state: result.status === 'uncertain' ? 'review' : result.status };
      }));
      results.push(...outcomes);
    }
    return json({ results });
  } catch (error) {
    if (error instanceof InvoiceEmailError) return json({ error: error.message }, error.status);
    return json({ error: 'No se pudo confirmar el lote. Puedes volver a revisar la selección. Los envíos registrados no se repetirán.' }, 503);
  }
}

export async function sendInvoiceViaBrevo(
  config: { apiKey: string; senderEmail: string; senderName: string },
  jobId: string, company: Company, invoice: InvoiceDocument, content: string,
  request: typeof fetch = fetch,
): Promise<ProviderResult> {
  const documentName = DTE_NAMES[invoice.dteType].name;
  const subject = `${documentName} ${invoice.controlNumber}`.replace(/[\r\n]/g, ' ');
  const response = await request('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    signal: AbortSignal.timeout(6_000),
    headers: { 'api-key': config.apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: config.senderEmail, name: config.senderName },
      to: [{ email: invoice.clientEmail.trim(), name: invoice.clientName }],
      subject,
      textContent: `Hola, ${invoice.clientName}.\n\nAdjuntamos en PDF tu documento ${invoice.controlNumber}, emitido por ${company.name}.\n\n${company.name}`,
      attachment: [{ name: `${invoice.controlNumber.replace(/[^A-Z0-9-]/gi, '_')}.pdf`, content }],
      headers: { idempotencyKey: jobId, 'X-Mailin-custom': jobId },
    }),
  });
  // A timeout, provider error, or duplicate-key response may follow an accepted send.
  if (!response.ok) {
    if (response.status === 400) {
      const error = await response.json().catch(() => null) as { code?: string } | null;
      return { status: error?.code && error.code !== 'duplicate_parameter' ? 'rejected' : 'uncertain' };
    }
    return { status: [401, 402, 403, 404, 413, 422, 429].includes(response.status) ? 'rejected' : 'uncertain' };
  }
  const result = await response.json() as { messageId?: unknown };
  return typeof result.messageId === 'string' && result.messageId
    ? { status: 'accepted', messageId: result.messageId } : { status: 'uncertain' };
}
