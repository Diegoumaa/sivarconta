import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';
import { INITIAL_COMPANIES, INITIAL_CLIENTS, INITIAL_PRODUCTS, INITIAL_PURCHASES, INITIAL_INVOICES } from '../data/mockData';

const cloud = vi.hoisted(() => ({
  configured: true,
  data: {} as Record<string, any[]>,
  readError: '', writeError: '',
  inserts: [] as { table: string; rows: any[] }[],
  delays: {} as Record<string, Promise<void>>,
  rpc: vi.fn(),
  success: vi.fn(), error: vi.fn()
}));

vi.mock('sonner', () => ({ toast: { success: cloud.success, error: cloud.error } }));
vi.mock('../lib/supabase', () => ({
  get isSupabaseConfigured() { return cloud.configured; },
  supabase: {
    rpc: cloud.rpc,
    from: (table: string) => ({
      select: () => {
        let filtered = cloud.data[table] || [];
        let company = '';
        const query = {
          order: () => query,
          eq: (_column: string, id: string) => { company = id; filtered = filtered.filter(row => row.company_id === id); return query; },
          range: async (start: number, end: number) => {
            await cloud.delays[table + ':' + company];
            return { data: filtered.slice(start, end + 1), count: filtered.length, error: cloud.readError === table ? { message: 'permission denied' } : null };
          }
        };
        return query;
      },
      insert: async (rows: any[]) => {
        cloud.inserts.push({ table, rows });
        return { data: null, error: cloud.writeError === table ? { message: 'write denied' } : null };
      }
    })
  }
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <AppProvider>{children}</AppProvider>;
const { id: _clientId, companyId: _clientCompany, ...clientInput } = INITIAL_CLIENTS[0];
const { id: _productId, companyId: _productCompany, ...productInput } = INITIAL_PRODUCTS[0];
const { id: _purchaseId, companyId: _purchaseCompany, ...purchaseInput } = INITIAL_PURCHASES[0];
const company = INITIAL_COMPANIES[0];
const rawCompany = {
  id: company.id, name: company.name, nit: company.nit, nrc: company.nrc,
  economic_activity_code: company.economicActivityCode, economic_activity_desc: company.economicActivity,
  phone: company.phone, email: company.email, address: company.address, mh_environment: 'PRUEBAS'
};
const invoiceInput = { ...INITIAL_INVOICES[0], items: [{
  id: 'local-item', code: 'TEST', description: 'Servicio de prueba', quantity: 2,
  unitPrice: 50, discount: 0, taxType: 'GRAVADO' as const,
  unitOfMeasure: '59', taxAmount: 13, total: 100
}] };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  cloud.configured = true;
  cloud.data = { companies: [rawCompany] };
  cloud.readError = '';
  cloud.writeError = '';
  cloud.inserts = [];
  cloud.delays = {};
  cloud.rpc.mockImplementation(async (name: string, args: any) => {
    if (name === 'create_company') return { data: args.company_data.id, error: null };
    if (cloud.writeError) return { data: null, error: { message: 'write denied' } };
    const draft = args.draft;
    return { data: { ...draft, control_number: 'DTE-03-M001P001-000000000004321',
      status: 'BORRADOR', mh_reception_stamp: null, emission_date: '2026-10-21', emission_time: '10:00:00',
      invoice_items: draft.items.map((item: any, index: number) => ({ ...item, id: 'saved-item-' + index })) }, error: null };
  });
});
afterEach(() => vi.useRealTimers());

async function loaded() {
  const hook = renderHook(() => useApp(), { wrapper });
  await waitFor(() => expect(hook.result.current.isCloudSyncActive).toBe(true));
  return hook;
}

describe('Persistence and truthful confirmations', () => {
  it('restores an authorized company after remounting and does not reuse another account selection', async () => {
    const otherId = INITIAL_COMPANIES[1].id;
    cloud.data.companies = [rawCompany, { ...rawCompany, id: otherId, name: 'Other company' }];
    const ownerWrapper = ({ children }: { children: React.ReactNode }) => <AppProvider userId="account-a">{children}</AppProvider>;
    const first = renderHook(() => useApp(), { wrapper: ownerWrapper });
    await waitFor(() => expect(first.result.current.dataStatus).toBe('ready'));
    act(() => first.result.current.setCurrentCompanyId(otherId));
    await waitFor(() => expect(first.result.current.dataStatus).toBe('ready'));
    first.unmount();
    const second = renderHook(() => useApp(), { wrapper: ownerWrapper });
    await waitFor(() => expect(second.result.current.dataStatus).toBe('ready'));
    expect(second.result.current.currentCompanyId).toBe(otherId);
    second.unmount();
    const differentWrapper = ({ children }: { children: React.ReactNode }) => <AppProvider userId="account-b">{children}</AppProvider>;
    const different = renderHook(() => useApp(), { wrapper: differentWrapper });
    await waitFor(() => expect(different.result.current.dataStatus).toBe('ready'));
    expect(different.result.current.currentCompanyId).toBe(company.id);
  });
  it('creates a company through the atomic ownership RPC', async () => {
    const { result } = await loaded();
    const { id: _id, ...input } = company;
    await act(async () => { await result.current.addCompany(input); });
    expect(cloud.rpc).toHaveBeenCalledWith('create_company', { company_data: expect.objectContaining({ name: company.name, id: expect.any(String) }) });
    expect(cloud.inserts.some(insert => insert.table === 'companies')).toBe(false);
  });
  it('does not replace the active company with a late response from a previous selection', async () => {
    const otherId = INITIAL_COMPANIES[1].id;
    cloud.data.companies = [rawCompany, { ...rawCompany, id: otherId, name: 'Other company' }];
    cloud.data.clients = [{ id: 'alpha', company_id: company.id, name: 'Alpha' }, { id: 'beta', company_id: otherId, name: 'Beta' }];
    const { result } = await loaded();
    let finish!: () => void;
    cloud.delays['clients:' + otherId] = new Promise(resolve => { finish = resolve; });
    act(() => result.current.setCurrentCompanyId(otherId));
    await waitFor(() => expect(result.current.dataStatus).toBe('loading'));
    act(() => result.current.setCurrentCompanyId(company.id));
    await waitFor(() => expect(result.current.clients[0].name).toBe('Alpha'));
    await act(async () => finish());
    expect(result.current.currentCompanyId).toBe(company.id);
    expect(result.current.clients.map(client => client.name)).toEqual(['Alpha']);
  });
  it('recovers a failed company read on an explicit refresh', async () => {
    cloud.readError = 'clients';
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.dataStatus).toBe('error'));
    cloud.readError = '';
    act(() => result.current.refreshData());
    await waitFor(() => expect(result.current.dataStatus).toBe('ready'));
    expect(result.current.isCloudSyncActive).toBe(true);
  });
  it('does not mix cached demo records with an empty cloud database', async () => {
    localStorage.setItem('sivarconta_clients', JSON.stringify(INITIAL_CLIENTS));
    const { result } = await loaded();
    expect(result.current.clients).toEqual([]);
    expect(result.current.products).toEqual([]);
    expect(result.current.invoices).toEqual([]);
    expect(result.current.purchases).toEqual([]);
    expect(result.current.currentCompany.name).toBe(company.name);
  });

  it('rejects resolved Supabase errors without local mutation or a success confirmation', async () => {
    const { result } = await loaded();
    cloud.writeError = 'clients';
    await act(async () => {
      await expect(result.current.addClient(clientInput)).rejects.toMatchObject({ message: 'write denied' });
    });
    expect(result.current.clients).toEqual([]);
    expect(result.current.isCloudSyncActive).toBe(false);
    expect(cloud.success).not.toHaveBeenCalled();
    expect(cloud.error).toHaveBeenCalled();
  });

  it('does not report sync active or publish a partial snapshot when a read is denied', async () => {
    cloud.readError = 'invoices';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(cloud.error).toHaveBeenCalled());
    expect(result.current.isCloudSyncActive).toBe(false);
    expect(result.current.companies).toHaveLength(1);
    expect(result.current.dataStatus).toBe('error');
    expect(result.current.invoices).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('keeps the same UUID in local and cloud client, product and purchase records', async () => {
    const { result } = await loaded();
    await act(async () => { await result.current.addClient(clientInput); });
    await act(async () => { await result.current.addProduct(productInput); });
    await act(async () => { await result.current.addPurchase(purchaseInput); });
    for (const [table, records] of [
      ['clients', result.current.clients], ['products', result.current.products], ['purchases', result.current.purchases]
    ] as const) {
      const sent = cloud.inserts.find(insert => insert.table === table)!.rows[0];
      expect(sent.id).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
      expect(records[0].id).toBe(sent.id);
      expect(sent.company_id).toBe(company.id);
    }
  });

  it('saves invoice line items under the persisted draft ID and does not fabricate an acceptance stamp', async () => {
    const { result } = await loaded();
    await act(async () => { await result.current.createInvoice(invoiceInput); });
    const header = cloud.rpc.mock.calls.find(call => call[0] === 'save_invoice_draft')![1].draft;
    const detail = header.items[0];
    expect(header.id).toMatch(/^[0-9A-F-]{36}$/);
    expect(detail.description).toBe('Servicio de prueba');
    expect(detail.quantity).toBe(2);
    expect(header.status).toBe('BORRADOR');
    expect(header.mh_reception_stamp).toBeNull();
    expect(result.current.invoices[0].mhReceptionStamp).toBeUndefined();
    expect(result.current.invoices[0].mhQrUrl).toBeUndefined();
    expect(result.current.invoices[0].controlNumber).toBe('DTE-03-M001P001-000000000004321');
    expect(cloud.inserts).toEqual([]);
  });

  it('reports detail write failures instead of confirming a complete document', async () => {
    const { result } = await loaded();
    cloud.writeError = 'invoice_items';
    await act(async () => { await expect(result.current.createInvoice(invoiceInput)).rejects.toBeDefined(); });
    expect(result.current.invoices).toEqual([]);
    expect(cloud.success).not.toHaveBeenCalled();
    expect(cloud.inserts).toEqual([]);
  });

  it('reuses the request identity after an ambiguous failure, preventing duplicate retry documents', async () => {
    const { result } = await loaded();
    cloud.writeError = 'invoice_items';
    await act(async () => { await expect(result.current.createInvoice(invoiceInput)).rejects.toBeDefined(); });
    const failed = cloud.rpc.mock.calls.find(call => call[0] === 'save_invoice_draft')![1].draft;
    cloud.writeError = '';
    await act(async () => { await result.current.createInvoice(invoiceInput); });
    const retried = cloud.rpc.mock.calls.filter(call => call[0] === 'save_invoice_draft')[1][1].draft;
    expect(retried).toEqual(failed);
    expect(result.current.invoices).toHaveLength(1);
  });

  it('restores every new client, product and purchase field after remounting the cloud provider', async () => {
    const first = await loaded();
    const client = { ...clientInput, commercialName: 'Nombre comercial conservado', taxpayerType: 'MEDIANO' as const };
    const product = { ...productInput, category: 'Categoría conservada' };
    const purchase = { ...purchaseInput, concept: 'Servicio conservado', paymentMethod: '04', retencionRenta10: 35.5 };
    await act(async () => { await first.result.current.addClient(client); await first.result.current.addProduct(product); await first.result.current.addPurchase(purchase); });
    for (const insert of cloud.inserts) cloud.data[insert.table] = insert.rows;
    first.unmount();
    const second = await loaded();
    expect(second.result.current.clients[0]).toMatchObject(client);
    expect(second.result.current.products[0]).toMatchObject(product);
    expect(second.result.current.purchases[0]).toMatchObject(purchase);
  });

  it('preserves rejected status and line items when loading invoices', async () => {
    cloud.data.invoices = [{
      id: 'stored-invoice', company_id: company.id, dte_type: '03', status: 'RECHAZADO',
      invoice_items: [{ id: 'stored-item', num_item: 1, description: 'Partida guardada', quantity: '2',
        unit_price: '50', discount: '0', tax_type: 'GRAVADO', unit_of_measure: '59', total: '100' }]
    }];
    const { result } = await loaded();
    expect(result.current.invoices[0].status).toBe('RECHAZADO_MH');
    expect(result.current.invoices[0].items[0]).toMatchObject({ description: 'Partida guardada', quantity: 2, total: 100 });
  });

  it('retains subject-excluded and credit-note purchase types after cloud loading', async () => {
    cloud.data.purchases = [
      { id: 'a', company_id: company.id, dte_type: '14' },
      { id: 'b', company_id: company.id, dte_type: '05' }
    ];
    const { result } = await loaded();
    expect(result.current.purchases.map(purchase => purchase.docType)).toEqual(['SUJETO_EXCLUIDO', 'NOTA_CREDITO']);
  });

  it('uses El Salvador date and time consistently near midnight UTC', async () => {
    cloud.configured = false;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T02:15:30Z'));
    const { result } = renderHook(() => useApp(), { wrapper });
    let invoice: any;
    await act(async () => { invoice = await result.current.createInvoice(invoiceInput); });
    expect(invoice.emissionDate).toBe('2026-10-20');
    expect(invoice.emissionTime).toBe('20:15:30');
  });

  it('reserves different correlatives for simultaneous creates from one browser', async () => {
    cloud.configured = false;
    const { result } = renderHook(() => useApp(), { wrapper });
    let created: any[] = [];
    await act(async () => {
      created = await Promise.all([result.current.createInvoice(invoiceInput), result.current.createInvoice(invoiceInput)]);
    });
    expect(new Set(created.map(invoice => invoice.controlNumber)).size).toBe(2);
  });

  it('clears a previous company preview when switching and ignores unknown companies', () => {
    cloud.configured = false;
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => result.current.setActiveDtePreview(INITIAL_INVOICES[0]));
    act(() => result.current.setCurrentCompanyId(INITIAL_COMPANIES[1].id));
    expect(result.current.activeDtePreview).toBeNull();
    expect(result.current.filteredInvoices.every(invoice => invoice.companyId === INITIAL_COMPANIES[1].id)).toBe(true);
    act(() => result.current.setCurrentCompanyId('nonexistent'));
    expect(result.current.currentCompanyId).toBe(INITIAL_COMPANIES[1].id);
  });
});

describe('Local demo cache resilience', () => {
  it('does not confirm or add a record when browser storage is full', async () => {
    cloud.configured = false;
    const { result } = renderHook(() => useApp(), { wrapper });
    const previousCount = result.current.clients.length;
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    await act(async () => { await expect(result.current.addClient(clientInput)).rejects.toThrow('copia local'); });
    expect(result.current.clients).toHaveLength(previousCount);
    expect(cloud.success).not.toHaveBeenCalled();
    set.mockRestore();
  });

  it.each(['sivarconta_companies', 'sivarconta_clients', 'sivarconta_products', 'sivarconta_invoices', 'sivarconta_purchases'])(
    'survives malformed JSON in %s', key => {
      cloud.configured = false;
      localStorage.setItem(key, '{broken json');
      expect(() => renderHook(() => useApp(), { wrapper })).not.toThrow();
    });

  it('survives storage that throws on reads and writes', () => {
    cloud.configured = false;
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    expect(() => renderHook(() => useApp(), { wrapper })).not.toThrow();
    get.mockRestore(); set.mockRestore();
  });
});
