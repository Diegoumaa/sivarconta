import type { SupabaseClient } from '@supabase/supabase-js';
import type { Company, Client, Product, InvoiceDocument, PurchaseDocument, Supplier } from '../types/index.js';

import type { IvaAnnexRecord } from '../types/ivaAnnex.js';

// The REST boundary is mapped here; components receive domain objects only.
type CloudRow = Record<string, any>;
export const PAGE_SIZE = 500;
export const COMPANY_COLUMNS = 'id,name,trade_name,nit,nrc,economic_activity_code,economic_activity_desc,phone,email,address,department_code,municipality_code,establishment_code,pos_code,is_gran_contribuyente,mh_environment,department,municipality,taxpayer_type,mh_user,settings,created_at,updated_at';
export interface CompanySnapshot {
  annexRecords?: IvaAnnexRecord[];
  suppliers?: Supplier[];
  clients: Client[]; products: Product[]; invoices: InvoiceDocument[]; purchases: PurchaseDocument[];
}

/** Read every page, including on projects whose REST API caps responses at 1,000 rows. */
export async function readPages(client: SupabaseClient, table: string, companyId?: string, columns = '*'): Promise<CloudRow[]> {
  const rows: CloudRow[] = [];
  for (let offset = 0; ; ) {
    let query = client.from(table).select(columns, { count: 'exact' }).order('id', { ascending: true });
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    offset += page.length;
    if (count !== null && count !== undefined && offset >= count) return rows;
    if (page.length === 0) {
      if (count && offset < count) throw new Error('No se pudo recuperar el conjunto completo de registros. Actualiza para reintentar.');
      return rows;
    }
    if ((count === null || count === undefined) && page.length < PAGE_SIZE) return rows;
  }
}

export async function loadCompanies(client: SupabaseClient): Promise<Company[]> {
  return mapCompanies(await readPages(client, 'companies', undefined, COMPANY_COLUMNS));
}

export async function loadCompanySnapshot(client: SupabaseClient, companyId: string): Promise<CompanySnapshot> {
  const [clients, products, invoices, purchases, suppliers, annexRecords] = await Promise.all([
    readPages(client, 'clients', companyId), readPages(client, 'products', companyId),
    readPages(client, 'invoices', companyId, '*, invoice_items(*)'), readPages(client, 'purchases', companyId), readPages(client, 'suppliers', companyId), readPages(client, 'iva_annex_records', companyId)
  ]);
  return {
    annexRecords: annexRecords.map(r => ({ id: r.id, companyId: r.company_id, annex: r.annex_code, emissionDate: r.emission_date, data: r.data, relatedInvoiceIds: r.related_invoice_ids || [], relatedPurchaseIds: r.related_purchase_ids || [], voided: r.voided })),
    suppliers: suppliers.map(s => ({ id: s.id, companyId: s.company_id, name: s.name, docType: s.doc_type, docNumber: s.doc_number, nrc: s.nrc || undefined })),
    clients: mapClients(clients), products: mapProducts(products),
    invoices: mapInvoices(invoices).sort((a, b) => `${b.emissionDate || ''}${b.emissionTime || ''}`.localeCompare(`${a.emissionDate || ''}${a.emissionTime || ''}`)),
    purchases: mapPurchases(purchases).sort((a, b) => String(b.emissionDate || '').localeCompare(String(a.emissionDate || '')))
  };
}

export function mapCompanies(rows: CloudRow[]): Company[] {
  return rows.map(c => ({
            id: c.id,
            settings: c.settings || {},
            name: c.name,
            tradeName: c.trade_name || c.name,
            nit: c.nit,
            nrc: c.nrc,
            economicActivityCode: c.economic_activity_code,
            economicActivity: c.economic_activity_desc,
            taxpayerType: c.is_gran_contribuyente ? 'GRAN_CONTRIBUYENTE' : (c.taxpayer_type || 'PEQUENO'),
            phone: c.phone,
            email: c.email,
            address: c.address,
            department: c.department || 'San Salvador',
            municipality: c.municipality || 'San Salvador Centro',
            establishmentCode: c.establishment_code || 'M001',
            posCode: c.pos_code || 'P001',
            mhEnvironment: c.mh_environment,
            mhUser: c.mh_user ?? (c.nit || '').replace(/-/g, '')
          }));
}

export function mapClients(rows: CloudRow[]): Client[] {
  return rows.map(c => ({
            id: c.id,
            companyId: c.company_id,
            name: c.name,
            commercialName: c.commercial_name || undefined,
            docType: c.doc_type === 'OTRO' && !c.doc_number ? 'OTRO' : c.doc_type === 'NIT' ? 'NIT' : 'DUI',
            docNumber: c.doc_number,
            nrc: c.nrc || undefined,
            economicActivity: c.economic_activity || undefined,
            districtCode: c.district_code || undefined,
            taxpayerType: c.is_gran_contribuyente ? 'GRAN_CONTRIBUYENTE' : (c.taxpayer_type || 'PEQUENO'),
            email: c.email,
            phone: c.phone,
            address: c.address,
            department: c.department || 'San Salvador',
            municipality: c.municipality || 'San Salvador Centro'
          }));
}

export function mapProducts(rows: CloudRow[]): Product[] {
  return rows.map(p => ({
            id: p.id,
            companyId: p.company_id,
            code: p.code,
            name: p.name,
            description: p.description || '',
            unitPrice: Number(p.price),
            taxType: p.tax_type as any,
            unitOfMeasure: p.unit_of_measure,
            category: p.category ?? 'General',
            stock: Number(p.stock)
          }));
}

export function mapInvoices(rows: CloudRow[]): InvoiceDocument[] {
  return rows.map(inv => ({
            id: inv.id,
            companyId: inv.company_id,
            dteType: inv.dte_type as any,
            pricesIncludeIva: Boolean(inv.prices_include_iva),
            generationCode: String(inv.generation_code || '').toUpperCase(),
            controlNumber: inv.control_number,
            emissionDate: inv.emission_date,
            emissionTime: inv.emission_time,
            establishmentCode: inv.establishment_code || 'M001',
            posCode: inv.pos_code || 'P001',
            status: inv.status === 'PROCESADO' ? 'PROCESADO_MH'
              : inv.status === 'RECHAZADO' ? 'RECHAZADO_MH'
              : inv.status === 'ANULADO' ? 'INVALIDADO'
              : inv.status === 'TRANSMITIDO' ? 'TRANSMITIENDO' : 'BORRADOR',
            clientId: inv.client_id || 'cli-generic',
            clientName: inv.client_name,
            clientDocType: inv.client_doc_type,
            clientDocNumber: inv.client_doc_number,
            clientNrc: inv.client_nrc || undefined,
            clientEmail: inv.client_email || '',
            clientPhone: inv.client_phone || undefined,
            clientAddress: inv.client_address || '',
            clientMunicipality: inv.client_municipality || 'San Salvador',
            clientDepartment: inv.client_department || 'San Salvador',
            paymentMethod: inv.payment_method || '01',
            condition: inv.condition as any,
            creditTermDays: inv.credit_term_days || undefined,
            items: (inv.invoice_items || []).sort((a: any, b: any) => a.num_item - b.num_item).map((item: any) => ({
              id: item.id,
              productId: item.product_id || undefined,
              code: item.code || '',
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unit_price),
              discount: Number(item.discount),
              taxType: item.tax_type,
              unitOfMeasure: item.unit_of_measure,
              applyIsrRetention: typeof item.apply_isr_retention === 'boolean' ? item.apply_isr_retention : undefined,
              taxAmount: item.tax_amount != null ? Number(item.tax_amount) : item.tax_type !== 'GRAVADO' || inv.dte_type === '14' ? 0
                : Number((Number(item.total) * (inv.dte_type === '01' ? 13 / 113 : 0.13)).toFixed(2)),
              total: Number(item.total)
            })),
            subtotalGravado: Number(inv.subtotal_gravado || 0),
            subtotalExento: Number(inv.subtotal_exento || 0),
            subtotalNoSujeto: Number(inv.subtotal_no_sujeto || 0),
            descuentoTotal: Number(inv.descuento_total || 0),
            iva13: Number(inv.iva13 || 0),
            retencion1: Number(inv.retencion1 || 0),
            percepcion1: Number(inv.percepcion1 || 0),
            retencionRenta10: Number(inv.retencion_renta10 || 0),
            totalPagar: Number(inv.total_pagar || 0),
            totalLetras: inv.total_letras || '',
            observations: inv.observations || undefined,
            f07Renta: inv.f07_renta || undefined,
            referencedDte: inv.referenced_dte || undefined,
            mhReceptionStamp: inv.mh_reception_stamp || undefined,
            mhProductionReception: inv.mh_response_json?.ambiente === '01' &&
              inv.mh_response_json?.estado === 'PROCESADO' &&
              typeof inv.mh_response_json?.codigoGeneracion === 'string' &&
              inv.mh_response_json.codigoGeneracion.toUpperCase() === String(inv.generation_code).toUpperCase() &&
              inv.mh_response_json?.selloRecibido === inv.mh_reception_stamp,
            mhEnvironment: inv.mh_environment || inv.mh_response_json?.ambienteReportado || inv.mh_response_json?.ambiente || undefined,
            mhEmissionState: inv.mh_emission_state || undefined,
            mhDocument: inv.mh_response_json?.documento || undefined,
            mhMessageCode: inv.mh_message_code || inv.mh_response_json?.codigoMsg || undefined,
            mhMessage: [inv.mh_response_json?.descripcionMsg, inv.mh_response_json?.pista].filter(Boolean).join(' ') || undefined,
            mhObservations: inv.mh_response_json?.observaciones || undefined,
            mhInvalidationStamp: inv.status === 'ANULADO' && typeof inv.mh_response_json?.invalidacion?.selloRecibido === 'string'
              ? inv.mh_response_json.invalidacion.selloRecibido : undefined,
            mhQrUrl: inv.mh_environment ? `https://admin.factura.gob.sv/consultaPublica?ambiente=${inv.mh_environment}&codGen=${String(inv.generation_code).toUpperCase()}&fechaEmi=${inv.emission_date}` : undefined,
            mhResponseDate: inv.mh_processed_at || undefined
          }));
}

export function mapPurchases(rows: CloudRow[]): PurchaseDocument[] {
  return rows.map(pur => ({
            id: pur.id,
            companyId: pur.company_id,
            docType: pur.dte_type === '03' ? 'CCF' : pur.dte_type === '14' ? 'SUJETO_EXCLUIDO'
              : pur.dte_type === '05' ? 'NOTA_CREDITO' : 'FACTURA',
            docNumber: pur.control_number,
            generationCode: pur.generation_code,
            emissionDate: pur.date,
            supplierName: pur.supplier_name,
            documentClass: pur.document_class || undefined,
            f07Renta: pur.f07_renta || undefined,
            supplierNit: pur.supplier_nit,
            supplierNrc: pur.supplier_nrc || '',
            concept: pur.concept ?? 'Compra de inventario / servicios',
            purchasesGravadas: Number(pur.subtotal_gravado || 0),
            purchasesExentas: Number(pur.subtotal_exento || 0),
            creditoFiscal: Number(pur.iva13 || 0),
            retencion1: Number(pur.retencion1 || 0),
            percepcion1: Number(pur.percepcion1 || 0),
            retencionIva13: Number(pur.retencion_iva13 || 0),
            perceptionBase: pur.perception_base == null ? undefined : Number(pur.perception_base),
            documentSeries: pur.document_series || undefined,
            retencionRenta10: Number(pur.retencion_renta10 || 0),
            totalPagar: Number(pur.total || 0),
            paymentMethod: pur.payment_method || '01'
          }));
}
