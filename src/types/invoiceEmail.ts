import type { InvoiceDocument } from './index.js';

export const MAX_INVOICE_EMAIL_BATCH = 20;
export const INVOICE_EMAIL_ENDPOINT = '/api/invoice-email';

export interface InvoiceEmailSelection {
  invoiceId: string;
  email: string;
}

export type InvoiceEmailState = 'accepted' | 'already_accepted' | 'rejected' | 'review' | 'simulated';
export interface InvoiceEmailResult {
  invoiceId: string;
  state: InvoiceEmailState;
}

export function isRecipientEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 &&
    /^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}

export function invoiceEmailIssue(invoice: InvoiceDocument, demo = false): string | undefined {
  if (invoice.status !== 'PROCESADO_MH' || !/^[A-Z0-9]{40}$/i.test(invoice.mhReceptionStamp || '')) return 'Requiere aceptación y sello de Hacienda';
  if (!demo && !invoice.mhProductionReception) return 'Falta la respuesta de aceptación de Hacienda en producción';
  if (!invoice.items.length) return 'Faltan las partidas originales';
  if (!isRecipientEmail(invoice.clientEmail?.trim())) return 'Falta un correo válido en el documento';
}
