import type { SupabaseClient } from '@supabase/supabase-js';
import type { Company, Client, Product, InvoiceDocument, PurchaseDocument } from '../types';

// The REST boundary is mapped here; components receive domain objects only.
type CloudRow = Record<string, any>;
export const PAGE_SIZE = 500;
export const COMPANY_COLUMNS = 'id,name,trade_name,nit,nrc,economic_activity_code,economic_activity_desc,phone,email,address,department_code,municipality_code,establishment_code,pos_code,is_gran_contribuyente,mh_environment,created_at,updated_at';
export interface CompanySnapshot {
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
  const [clients, products, invoices, purchases] = await Promise.all([
    readPages(client, 'clients', companyId), readPages(client, 'products', companyId),
    readPages(client, 'invoices', companyId, '*, invoice_items(*)'), readPages(client, 'purchases', companyId)
  ]);
  return {
    clients: mapClients(clients), products: mapProducts(products),
    invoices: mapInvoices(invoices).sort((a, b) => `${b.emissionDate || ''}${b.emissionTime || ''}`.localeCompare(`${a.emissionDate || ''}${a.emissionTime || ''}`)),
    purchases: mapPurchases(purchases).sort((a, b) => String(b.emissionDate || '').localeCompare(String(a.emissionDate || '')))
  };
}

export function mapCompanies(rows: CloudRow[]): Company[] {
  return rows.map(c => ({
            id: c.id,
            name: c.name,
            tradeName: c.trade_name || c.name,
            nit: c.nit,
            nrc: c.nrc,
            economicActivityCode: c.economic_activity_code,
            economicActivity: c.economic_activity_desc,
            taxpayerType: c.is_gran_contribuyente ? 'GRAN_CONTRIBUYENTE' : 'PEQUENO',
            phone: c.phone,
            email: c.email,
            address: c.address,
            department: 'San Salvador',
            municipality: 'San Salvador Centro',
            establishmentCode: c.establishment_code || 'M001',
            posCode: c.pos_code || 'P001',
            mhEnvironment: c.mh_environment,
            mhUser: c.nit.replace(/-/g, '')
          }));
}

export function mapClients(rows: CloudRow[]): Client[] {
  return rows.map(c => ({
            id: c.id,
            companyId: c.company_id,
            name: c.name,
            docType: c.doc_type === 'NIT' ? 'NIT' : 'DUI',
            docNumber: c.doc_number,
            nrc: c.nrc || undefined,
            economicActivity: c.economic_activity || undefined,
            taxpayerType: c.is_gran_contribuyente ? 'GRAN_CONTRIBUYENTE' : 'PEQUENO',
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
            category: 'General',
            stock: Number(p.stock)
          }));
}

export function mapInvoices(rows: CloudRow[]): InvoiceDocument[] {
  return rows.map(inv => ({
            id: inv.id,
            companyId: inv.company_id,
            dteType: inv.dte_type as any,
            generationCode: inv.generation_code,
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
              taxAmount: item.tax_type !== 'GRAVADO' || inv.dte_type === '14' ? 0
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
            mhReceptionStamp: inv.mh_reception_stamp || undefined,
            mhResponseDate: inv.mh_reception_stamp ? inv.created_at : undefined
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
            supplierNit: pur.supplier_nit,
            supplierNrc: pur.supplier_nrc || '',
            concept: 'Compra de inventario / servicios',
            purchasesGravadas: Number(pur.subtotal_gravado || 0),
            purchasesExentas: Number(pur.subtotal_exento || 0),
            creditoFiscal: Number(pur.iva13 || 0),
            retencion1: Number(pur.retencion1 || 0),
            totalPagar: Number(pur.total || 0),
            paymentMethod: '01'
          }));
}
