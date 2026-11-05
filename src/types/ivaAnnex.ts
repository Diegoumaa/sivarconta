export type SpecialAnnex = '108' | '66' | '161' | '162' | '163' | '169' | '170' | '171' | '172' | 'documentos';

/** Supporting documents, not DTE issuance. Values remain traceable to the original voucher. */
export interface IvaAnnexData {
  documentClass: '1' | '2' | '4';
  partyDocType: 'NIT' | 'DUI' | 'NRC' | 'OTRO';
  partyDoc: string;
  partyName: string;
  docType: string;
  series: string;
  resolution: string;
  documentNumber: string;
  generationCode: string;
  amount: string;
  taxAmount: string;
  operation: string;
  classification: string;
  sector: string;
  cost: string;
  settlementClass: '1' | '2' | '4';
  settlementSeries: string;
  settlementResolution: string;
  settlementNumber: string;
  settlementGenerationCode: string;
  settlementDate: string;
  detailType: 'A' | 'X' | 'D';
  preprintedFrom: string;
  preprintedTo: string;
  from: string;
  to: string;
}
export interface IvaAnnexRecord {
  id: string;
  companyId: string;
  annex: SpecialAnnex;
  emissionDate: string;
  data: IvaAnnexData;
  relatedInvoiceIds: string[];
  relatedPurchaseIds: string[];
  voided?: boolean;
}
export type IvaAnnexDraft = Omit<IvaAnnexRecord, 'id' | 'companyId'>;
