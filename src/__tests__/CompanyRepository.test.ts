import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COMPANY_COLUMNS, loadCompanies, loadCompanySnapshot, readPages } from '../services/companyRepository';

function api(rowsByTable: Record<string, any[]>, options: { cap?: number; failOffset?: number } = {}) {
  const calls: { table: string; columns: string; company?: string; offset?: number }[] = [];
  const client = { from(table: string) { return { select(columns: string) {
    const call = { table, columns } as typeof calls[number]; calls.push(call);
    let rows = rowsByTable[table] || [];
    const query = {
      order() { return query; },
      eq(_key: string, company: string) { call.company = company; rows = rows.filter(row => row.company_id === company); return query; },
      async range(start: number, end: number) {
        call.offset = start;
        return { data: rows.slice(start, Math.min(end + 1, start + (options.cap || 500))), count: rows.length,
          error: start === options.failOffset ? { message: 'page unavailable' } : null };
      }
    }; return query;
  } }; } } as unknown as SupabaseClient;
  return { client, calls };
}

describe('Company repository', () => {
  it('loads more than 1,000 rows rather than silently truncating accounting totals', async () => {
    const rows = Array.from({ length: 1203 }, (_, id) => ({ id }));
    const { client, calls } = api({ invoices: rows });
    expect(await readPages(client, 'invoices', 'company-a')).toHaveLength(0);
    const complete = api({ invoices: rows.map(row => ({ ...row, company_id: 'company-a' })) });
    expect(await readPages(complete.client, 'invoices', 'company-a')).toHaveLength(1203);
    expect(complete.calls.map(call => call.offset)).toEqual([0, 500, 1000]);
    expect(calls[0].company).toBe('company-a');
  });
  it('continues when the project REST row limit is smaller than the requested page', async () => {
    const { client } = api({ clients: Array.from({ length: 12 }, (_, id) => ({ id })) }, { cap: 5 });
    expect(await readPages(client, 'clients')).toHaveLength(12);
  });
  it('rejects the whole result when a later page is denied', async () => {
    const { client } = api({ invoices: Array.from({ length: 800 }, (_, id) => ({ id })) }, { failOffset: 500 });
    await expect(readPages(client, 'invoices')).rejects.toMatchObject({ message: 'page unavailable' });
  });
  it('scopes every company query on the server and keeps invoice items', async () => {
    const { client, calls } = api({
      clients: [{ id: 'a', company_id: 'a', name: 'Visible' }, { id: 'b', company_id: 'b', name: 'Other company' }],
      invoices: [{ id: 'draft', company_id: 'a', status: 'BORRADOR', invoice_items: [{ id: 'item', num_item: 1, quantity: 2, unit_price: 10, total: 20, tax_type: 'GRAVADO' }] }]
    });
    const result = await loadCompanySnapshot(client, 'a');
    expect(result.clients.map(client => client.id)).toEqual(['a']);
    expect(result.invoices[0].items[0].quantity).toBe(2);
    expect(calls).toHaveLength(4);
    expect(calls.every(call => call.company === 'a')).toBe(true);
    expect(calls.find(call => call.table === 'invoices')?.columns).toContain('invoice_items');
  });
  it('never requests the backend fiscal credential when listing companies', async () => {
    const { client, calls } = api({ companies: [] });
    await loadCompanies(client);
    expect(calls[0].columns).toBe(COMPANY_COLUMNS);
    expect(calls[0].columns).not.toContain('mh_api_key');
    expect(calls[0].columns).not.toContain('*');
  });
});
