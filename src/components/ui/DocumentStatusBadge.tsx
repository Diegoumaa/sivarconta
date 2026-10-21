import { DocumentStatus } from '../../types';

const statuses: Record<DocumentStatus, { label: string; color: string }> = {
  BORRADOR: { label: 'Borrador · sin transmitir', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  TRANSMITIENDO: { label: 'Transmitiendo', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  PROCESADO_MH: { label: 'Procesado MH', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  RECHAZADO_MH: { label: 'Rechazado MH', color: 'bg-red-50 text-red-800 border-red-200' },
  CONTINGENCIA: { label: 'Contingencia', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  INVALIDADO: { label: 'Invalidado', color: 'bg-red-50 text-red-800 border-red-200' },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const meta = statuses[status] || { label: 'Estado por verificar', color: 'bg-amber-50 text-amber-800 border-amber-200' };
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${meta.color}`}>{meta.label}</span>;
}
