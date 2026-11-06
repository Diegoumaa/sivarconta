// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { handleInvoiceEmail, InvoiceEmailError, sendInvoiceViaBrevo, type InvoiceEmailDependencies } from '../../server/invoiceEmail';
import { INITIAL_COMPANIES, INITIAL_INVOICES } from '../data/mockData';
import type { InvoiceDocument } from '../types';

const company = { ...INITIAL_COMPANIES[0], mhEnvironment: 'PRODUCCION' as const };
const invoiceA: InvoiceDocument = { ...INITIAL_INVOICES[0], id: '10000000-0000-4000-8000-000000000001',
  companyId: company.id, clientName: 'Cliente A', clientEmail: 'cliente-a@example.invalid', mhReceptionStamp: 'A'.repeat(40), mhProductionReception: true };
const invoiceB: InvoiceDocument = { ...invoiceA, id: '10000000-0000-4000-8000-000000000002',
  controlNumber: 'DTE-03-M001P001-000000000000002', clientName: 'Cliente B', clientEmail: 'cliente-b@example.invalid' };
const selection = [invoiceA, invoiceB].map(i => ({ invoiceId: i.id, email: i.clientEmail }));
const jobA = '20000000-0000-4000-8000-000000000001';
const jobB = '20000000-0000-4000-8000-000000000002';
const brevo = { apiKey: 'fixture', senderEmail: 'emisor@example.invalid', senderName: 'SIVAR FACT' };

function post(body: unknown = { companyId: company.id, documents: selection }, token = 'test-token') {
  return new Request('https://example.invalid/api/invoice-email', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
  });
}
function fakeDependencies() {
  return {
    available: true,
    authenticate: vi.fn<InvoiceEmailDependencies['authenticate']>().mockResolvedValue('actor'),
    load: vi.fn<InvoiceEmailDependencies['load']>().mockResolvedValue({ company, invoices: [invoiceB, invoiceA] }),
    claim: vi.fn<InvoiceEmailDependencies['claim']>().mockResolvedValue([
      { invoiceId: invoiceA.id, jobId: jobA, previousState: null },
      { invoiceId: invoiceB.id, jobId: jobB, previousState: null },
    ]),
    send: vi.fn<InvoiceEmailDependencies['send']>().mockResolvedValue({ status: 'accepted', messageId: 'provider-id' }),
    finish: vi.fn<InvoiceEmailDependencies['finish']>().mockResolvedValue(undefined),
  };
}

describe('bulk invoice email endpoint', () => {
  it('sends exactly one PDF to the stored recipient for each selected invoice, even when the lookup order differs', async () => {
    const deps = fakeDependencies();
    const provider = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ messageId: 'test-message' }, { status: 201 }));
    deps.send.mockImplementation((id, issuer, invoice, pdf) => sendInvoiceViaBrevo(brevo, id, issuer, invoice, pdf, provider));
    const response = await handleInvoiceEmail(post(), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: selection.map(row => ({ invoiceId: row.invoiceId, state: 'accepted' })) });
    expect(provider).toHaveBeenCalledTimes(2);
    for (const [index, call] of provider.mock.calls.entries()) {
      expect(call[0]).toBe('https://api.brevo.com/v3/smtp/email');
      const payload = JSON.parse(String(call[1]?.body));
      const original = [invoiceA, invoiceB][index];
      expect(payload.to).toEqual([{ email: original.clientEmail, name: original.clientName }]);
      expect(payload).not.toHaveProperty('cc');
      expect(payload).not.toHaveProperty('bcc');
      expect(payload.attachment).toHaveLength(1);
      expect(payload.attachment[0].name).toBe(`${original.controlNumber}.pdf`);
      expect(Buffer.from(payload.attachment[0].content, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
      expect(payload.headers.idempotencyKey).toBe([jobA, jobB][index]);
    }
    expect(deps.finish).toHaveBeenCalledTimes(2);
  });
  it('leaves a disabled installation read-only and rejects requests without a bearer token', async () => {
    const deps = fakeDependencies();
    deps.available = false;
    expect(await (await handleInvoiceEmail(new Request('https://example.invalid/api/invoice-email'), deps)).json()).toEqual({ available: false });
    expect((await handleInvoiceEmail(post(undefined, ''), deps)).status).toBe(401);
    expect((await handleInvoiceEmail(post(), deps)).status).toBe(503);
    expect(deps.authenticate).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });
  it('rejects a forged recipient before reserving or sending any email', async () => {
    const deps = fakeDependencies();
    const response = await handleInvoiceEmail(post({ companyId: company.id, documents: [selection[0], { ...selection[1], email: 'other@example.invalid' }] }), deps);
    expect(response.status).toBe(409);
    expect(deps.claim).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'BORRADOR' },
    { mhReceptionStamp: undefined },
    { mhProductionReception: false },
    { items: [] },
  ] as Partial<InvoiceDocument>[])('rejects an ineligible invoice before contacting Brevo (%o)', async (changes) => {
    const deps = fakeDependencies();
    deps.load.mockResolvedValue({ company, invoices: [invoiceA, { ...invoiceB, ...changes }] });
    expect((await handleInvoiceEmail(post(), deps)).status).toBe(409);
    expect(deps.send).not.toHaveBeenCalled();
  });
  it('rejects both a foreign invoice and a user without membership', async () => {
    const deps = fakeDependencies();
    deps.load.mockResolvedValueOnce({ company, invoices: [invoiceA, { ...invoiceB, companyId: 'another-company' }] });
    expect((await handleInvoiceEmail(post(), deps)).status).toBe(403);
    deps.load.mockRejectedValueOnce(new InvoiceEmailError(403, 'No autorizado'));
    expect((await handleInvoiceEmail(post(), deps)).status).toBe(403);
    expect(deps.claim).not.toHaveBeenCalled();
  });
  it('rejects duplicate selections before loading invoices', async () => {
    const deps = fakeDependencies();
    expect((await handleInvoiceEmail(post({ companyId: company.id, documents: [selection[0], selection[0]] }), deps)).status).toBe(400);
    expect(deps.load).not.toHaveBeenCalled();
  });
  it('does not resend accepted or uncertain attempts', async () => {
    const deps = fakeDependencies();
    deps.claim.mockResolvedValue([
      { invoiceId: invoiceA.id, jobId: null, previousState: 'accepted' },
      { invoiceId: invoiceB.id, jobId: null, previousState: 'uncertain' },
    ]);
    const response = await handleInvoiceEmail(post(), deps);
    expect((await response.json()).results.map((r: { state: string }) => r.state)).toEqual(['already_accepted', 'review']);
    expect(deps.send).not.toHaveBeenCalled();
  });
  it('records individual outcomes and preserves ambiguity after a network timeout', async () => {
    const deps = fakeDependencies();
    deps.send.mockResolvedValueOnce({ status: 'rejected' }).mockRejectedValueOnce(new Error('timeout'));
    const response = await handleInvoiceEmail(post(), deps);
    expect((await response.json()).results.map((r: { state: string }) => r.state)).toEqual(['rejected', 'review']);
    expect(deps.finish).toHaveBeenCalledWith(jobB, { status: 'uncertain' });
  });
  it('treats a Brevo duplicate response as potentially already sent', async () => {
    const provider = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: 'duplicate_parameter' }, { status: 400 }));
    expect(await sendInvoiceViaBrevo(brevo, jobA, company, invoiceA, 'pdf', provider)).toEqual({ status: 'uncertain' });
  });
  it('does not start a batch when the database quota is exhausted', async () => {
    const deps = fakeDependencies();
    deps.claim.mockRejectedValue(new InvoiceEmailError(429, 'Sin cupo'));
    expect((await handleInvoiceEmail(post(), deps)).status).toBe(429);
    expect(deps.send).not.toHaveBeenCalled();
  });
});
