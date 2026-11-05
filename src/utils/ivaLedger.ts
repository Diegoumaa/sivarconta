import type { CompanySettings, InvoiceDocument, PurchaseDocument } from '../types';
import type { IvaAnnexRecord, SpecialAnnex } from '../types/ivaAnnex';
import { annexSign } from './specialF07';

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);
const sign = (type: string) => type === '05' || type === 'NOTA_CREDITO' ? -1 : 1;

/** Calculate chronologically. Payments due in a previous month never become a credit. */
export function calculateIvaLedger(invoices: InvoiceDocument[], purchases: PurchaseDocument[], period: string, settings: CompanySettings = {}, annexRecords: IvaAnnexRecord[] = []) {
  const accepted = invoices.filter(i => i.status === 'PROCESADO_MH' && i.dteType !== '14');
  const records = annexRecords.filter(r => !r.voided);
  const linkedInvoices = (annex: SpecialAnnex) => new Set(records.filter(r => r.annex === annex).flatMap(r => r.relatedInvoiceIds));
  const linkedPurchases = (annex: SpecialAnnex) => new Set(records.filter(r => r.annex === annex).flatMap(r => r.relatedPurchaseIds));
  const retainedIds = linkedInvoices('162'), perceivedIds = linkedPurchases('163'), perceptionIssued = linkedInvoices('169'), retentionIssued = linkedPurchases('170'), retention13Issued = linkedPurchases('172');
  const start = settings.ivaOpeningPeriod && settings.ivaOpeningPeriod <= period ? settings.ivaOpeningPeriod : undefined;
  const periods = new Set([period, ...accepted.map(i => i.emissionDate.slice(0, 7)), ...purchases.map(p => p.emissionDate.slice(0, 7)), ...records.map(r => r.emissionDate.slice(0,7))]);
  let carry = start && start <= period ? cents(settings.ivaOpeningBalance || 0) : 0;
  let paymentCarry = start ? cents(settings.ivaPaymentOpeningBalance || 0) : 0;
  let result = { debit: 0, credit: 0, retained: 0, perceived: 0, advance: 0, opening: 0, creditOpening: 0, paymentOpening: 0, payable: 0, carry: 0, creditCarry: 0, paymentCarry: 0, withholdingToPay: 0, perceptionToPay: 0, advanceToPay: 0, withholding13ToPay: 0 };
  for (const month of [...periods].filter(p => p <= period && (!start || p >= start)).sort()) {
    const sales = accepted.filter(i => i.emissionDate.startsWith(month + '-'));
    const bought = purchases.filter(p => p.emissionDate.startsWith(month + '-'));
    const sumAnnex = (annex: SpecialAnnex) => records.filter(r => r.annex === annex && r.emissionDate.startsWith(month + '-')).reduce((s,r) => s + annexSign(r) * cents(Number(r.data.taxAmount)),0);
    const debit = sales.reduce((s, i) => s + sign(i.dteType) * cents(i.iva13), 0);
    const credit = bought.reduce((s, p) => s + sign(p.docType) * cents(p.creditoFiscal), 0);
    const retained = sumAnnex('162') + sales.filter(i => !retainedIds.has(i.id)).reduce((s,i) => s + sign(i.dteType) * cents(i.retencion1),0);
    const perceived = sumAnnex('163') + bought.filter(p => !perceivedIds.has(p.id)).reduce((s,p) => s + sign(p.docType) * cents(p.percepcion1 || 0),0);
    const advance = sumAnnex('161');
    const vat = debit - credit - carry, onAccount = paymentCarry + retained + perceived + advance;
    result = { debit: debit/100, credit: credit/100, retained: retained/100, perceived: perceived/100, advance: advance/100,
      opening: (carry + paymentCarry)/100, creditOpening: carry/100, paymentOpening: paymentCarry/100,
      payable: Math.max(0,Math.max(0,vat) - onAccount)/100, creditCarry: Math.max(0,-vat)/100, paymentCarry: Math.max(0,onAccount - Math.max(0,vat))/100,
      carry: (Math.max(0,-vat) + Math.max(0,onAccount - Math.max(0,vat)))/100,
      withholdingToPay: (sumAnnex('170') + bought.filter(p => !retentionIssued.has(p.id)).reduce((s,p) => s + sign(p.docType)*cents(p.retencion1),0))/100,
      perceptionToPay: (sumAnnex('169') + sales.filter(i => !perceptionIssued.has(i.id)).reduce((s,i) => s + sign(i.dteType)*cents(i.percepcion1 || 0),0))/100,
      advanceToPay: sumAnnex('171')/100,
      withholding13ToPay: (sumAnnex('172') + bought.filter(p => !retention13Issued.has(p.id)).reduce((s,p) => s + sign(p.docType)*cents(p.retencionIva13 || 0),0))/100 };
    carry = cents(result.creditCarry); paymentCarry = cents(result.paymentCarry);
  }
  return result;
}
