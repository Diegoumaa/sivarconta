import { supabase } from '../lib/supabase';
import type { InvoiceDocument } from '../types';

export type MhAction = 'transmitir' | 'consultar' | 'invalidar';
/** Datos que el usuario completa en el panel (se validan otra vez en el servidor con el catálogo oficial). */
export interface MhExtra { distrito?: string; actividad?: string; motivo?: string; tipoAnulacion?: 1 | 2 | 3; reemplazo?: string }
export interface MhEmissionResponse {
  invoice: InvoiceDocument; confirmed?: boolean; error?: string; message?: string;
  campo?: 'distrito' | 'actividad' | 'relacionado' | 'receptor' | 'totales';
}

export async function requestMhEmission(companyId: string, invoiceId: string, action: MhAction, extra?: MhExtra): Promise<MhEmissionResponse> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('Inicia sesión para transmitir.');
  const response = await fetch('/api/mh-test-emission', { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, invoiceId, action, ...extra }),
  });
  const data = await response.json().catch(() => null);
  // Even a preflight response can contain a newly reserved UUID. Always show the saved document.
  if (!data?.invoice && (!response.ok || !data)) throw new Error(data?.error || 'No pudimos confirmar el estado. Consulta este mismo documento antes de reintentar.');
  return data as MhEmissionResponse;
}
