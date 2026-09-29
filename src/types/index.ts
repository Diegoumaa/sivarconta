export type DteType = '01' | '03' | '05' | '06' | '14';

export const DTE_NAMES: Record<DteType, { code: DteType; name: string; short: string; description: string; badgeColor: string }> = {
  '01': { 
    code: '01', 
    name: 'Factura de Consumidor Final', 
    short: 'Factura (01)', 
    description: 'Para personas naturales y público en general. El IVA 13% ya está incluido en el precio.',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200' 
  },
  '03': { 
    code: '03', 
    name: 'Comprobante de Crédito Fiscal', 
    short: 'Crédito Fiscal (03)', 
    description: 'Para empresas y comerciantes con NRC. Desglosa IVA 13% y retenciones para crédito tributario.',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200' 
  },
  '05': { 
    code: '05', 
    name: 'Nota de Crédito', 
    short: 'Nota de Crédito (05)', 
    description: 'Para devoluciones de mercadería, anulación o descuentos posteriores a un Crédito Fiscal.',
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200' 
  },
  '06': { 
    code: '06', 
    name: 'Nota de Débito', 
    short: 'Nota de Débito (06)', 
    description: 'Para cobro de intereses moratorios, fletes o recargos referenciados a un Crédito Fiscal.',
    badgeColor: 'bg-orange-100 text-orange-700 border-orange-200' 
  },
  '14': { 
    code: '14', 
    name: 'Factura de Sujeto Excluido', 
    short: 'Sujeto Excluido (14)', 
    description: 'Para compras de servicios a personas no inscritas en IVA (plomeros, albañiles, etc.). Retiene 10% Renta.',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' 
  },
};

export type DocumentStatus = 'BORRADOR' | 'TRANSMITIENDO' | 'PROCESADO_MH' | 'RECHAZADO_MH' | 'CONTINGENCIA' | 'INVALIDADO';

export interface InvoiceItem {
  id: string;
  productId?: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxType: 'GRAVADO' | 'EXENTO' | 'NO_SUJETO';
  unitOfMeasure: string;
  taxAmount: number;
  total: number;
}

export interface InvoiceDocument {
  id: string;
  companyId: string;
  dteType: DteType;
  generationCode: string; // UUID v4
  controlNumber: string; // DTE-01-M001P001-000000000000001
  emissionDate: string; // YYYY-MM-DD
  emissionTime: string; // HH:MM:SS
  establishmentCode: string;
  posCode: string;
  clientId: string;
  clientName: string;
  clientDocType: 'DUI' | 'NIT' | 'PASAPORTE';
  clientDocNumber: string;
  clientNrc?: string;
  clientAddress: string;
  clientDepartment: string;
  clientMunicipality: string;
  clientEmail: string;
  clientPhone?: string;
  items: InvoiceItem[];
  paymentMethod: string;
  condition: 'CONTADO' | 'CREDITO';
  creditTermDays?: number;
  subtotalGravado: number;
  subtotalExento: number;
  subtotalNoSujeto: number;
  descuentoTotal: number;
  iva13: number;
  retencion1: number;
  percepcion1?: number;
  retencionRenta10: number;
  totalPagar: number;
  totalLetras: string;
  observations?: string;
  referencedDte?: string;
  status: DocumentStatus;
  mhReceptionStamp?: string;
  mhResponseDate?: string;
  mhQrUrl?: string;
}

export interface Product {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string;
  unitPrice: number;
  taxType: 'GRAVADO' | 'EXENTO' | 'NO_SUJETO';
  unitOfMeasure: string;
  category: string;
  stock?: number;
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
  commercialName?: string;
  docType: 'DUI' | 'NIT';
  docNumber: string;
  nrc?: string;
  taxpayerType: 'GRAN_CONTRIBUYENTE' | 'MEDIANO' | 'PEQUENO' | 'OTRO';
  economicActivity?: string;
  department: string;
  municipality: string;
  address: string;
  phone: string;
  email: string;
}

export interface PurchaseDocument {
  id: string;
  companyId: string;
  docType: 'CCF' | 'FACTURA' | 'SUJETO_EXCLUIDO' | 'NOTA_CREDITO';
  docNumber: string;
  generationCode?: string;
  emissionDate: string;
  supplierName: string;
  supplierNrc?: string;
  supplierNit: string;
  concept: string;
  purchasesGravadas: number;
  purchasesExentas: number;
  creditoFiscal: number;
  retencion1: number;
  retencionRenta10?: number;
  totalPagar: number;
  paymentMethod: string;
}

export interface Company {
  id: string;
  name: string;
  tradeName: string;
  nit: string;
  nrc: string;
  economicActivity: string;
  economicActivityCode: string;
  taxpayerType: 'GRAN_CONTRIBUYENTE' | 'MEDIANO' | 'PEQUENO' | 'OTRO';
  department: string;
  municipality: string;
  address: string;
  phone: string;
  email: string;
  mhEnvironment: 'PRUEBAS' | 'PRODUCCION';
  mhUser: string;
  establishmentCode: string;
  posCode: string;
}
