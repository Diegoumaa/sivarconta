import type { CompanySettings, InvoiceDocument, PurchaseDocument } from '../types';

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);
const sign = (type: string) => type === '05' || type === 'NOTA_CREDITO' ? -1 : 1;

/** Calculate chronologically. Payments due in a previous month never become a credit. */
export function calculateIvaLedger(invoices: InvoiceDocument[], purchases: PurchaseDocument[], period: string, settings: CompanySettings = {}) {
  const accepted = invoices.filter(i => i.status === 'PROCESADO_MH' && i.dteType !== '14');
  const start = settings.ivaOpeningPeriod && settings.ivaOpeningPeriod <= period ? settings.ivaOpeningPeriod : undefined;
  const periods = new Set([period, ...accepted.map(i => i.emissionDate.slice(0, 7)), ...purchases.map(p => p.emissionDate.slice(0, 7))]);
  let carry = start && start <= period ? cents(settings.ivaOpeningBalance || 0) : 0;
  let result = { debit: 0, credit: 0, retained: 0, opening: 0, payable: 0, carry: 0, withholdingToPay: 0, perceptionToPay: 0 };
  for (const month of [...periods].filter(p => p <= period && (!start || p >= start)).sort()) {
    const sales = accepted.filter(i => i.emissionDate.startsWith(month + '-'));
    const bought = purchases.filter(p => p.emissionDate.startsWith(month + '-'));
    const debit = sales.reduce((s, i) => s + sign(i.dteType) * cents(i.iva13), 0);
    const credit = bought.reduce((s, p) => s + sign(p.docType) * cents(p.creditoFiscal), 0);
    const retained = sales.reduce((s, i) => s + sign(i.dteType) * cents(i.retencion1), 0);
    const balance = debit - credit - retained - carry;
    result = { debit: debit / 100, credit: credit / 100, retained: retained / 100, opening: carry / 100,
      payable: Math.max(0, balance) / 100, carry: Math.max(0, -balance) / 100,
      withholdingToPay: bought.reduce((s, p) => s + sign(p.docType) * cents(p.retencion1), 0) / 100,
      perceptionToPay: sales.reduce((s, i) => s + sign(i.dteType) * cents(i.percepcion1 || 0), 0) / 100 };
    carry = Math.max(0, -balance);
  }
  return result;
}
