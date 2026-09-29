import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DteType, DTE_NAMES } from '../../types';
import { Receipt, Search, Filter, Plus, Eye, CheckCircle2, ShieldAlert, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';
import { toast } from 'sonner';

export const InvoiceList: React.FC = () => {
  const { filteredInvoices, setCurrentView, setActiveDtePreview } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const filtered = filteredInvoices.filter(inv => {
    const matchesSearch = 
      inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.controlNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.generationCode.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedType === 'ALL' || inv.dteType === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Documentos Tributarios Emitidos (DTE)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Registro cronológico y estatus de transmisión ante el Ministerio de Hacienda
          </p>
        </div>
        <button
          onClick={() => setCurrentView('new-invoice')}
          className="btn-tactile flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Emitir Nuevo DTE</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente o # control..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* DTE Type Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Tipo:
          </span>
          {['ALL', '01', '03', '14', '05', '06'].map(t => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                selectedType === t
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'ALL' ? 'Todos' : `DTE-${t}`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Tipo & Número de Control</th>
                <th className="py-3 px-4">Cliente / Receptor</th>
                <th className="py-3 px-4">Fecha Emisión</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">IVA 13%</th>
                <th className="py-3 px-4 text-right">Total Pagar</th>
                <th className="py-3 px-4 text-center">Estado MH</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 mx-auto flex items-center justify-center">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {searchTerm || selectedType !== 'ALL' 
                          ? 'No se encontraron documentos emitidos en este filtro' 
                          : 'Aún no se han emitido facturas en esta empresa'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {searchTerm || selectedType !== 'ALL'
                          ? 'Intenta restablecer la búsqueda o los filtros de tipo para ver todos los comprobantes emitidos.'
                          : 'Comienza generando tu primer documento tributario electrónico certificado por el Ministerio de Hacienda.'}
                      </p>
                      {searchTerm || selectedType !== 'ALL' ? (
                        <button
                          type="button"
                          onClick={() => { setSearchTerm(''); setSelectedType('ALL'); }}
                          className="btn-tactile px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                        >
                          Restablecer filtros
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCurrentView('new-invoice')}
                          className="btn-tactile px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/20 inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Emitir Primer DTE</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(inv => {
                  const meta = DTE_NAMES[inv.dteType];
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.badgeColor}`}>
                            {inv.dteType}
                          </span>
                          <span className="font-mono text-slate-800 font-semibold">{inv.controlNumber}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inv.controlNumber, 'Número de control copiado', inv.controlNumber)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors btn-tactile"
                            title="Copiar número de control"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
                            UUID: {inv.generationCode}
                          </p>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inv.generationCode, 'UUID copiado al portapapeles', inv.generationCode)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors btn-tactile"
                            title="Copiar código de generación"
                          >
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800">{inv.clientName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {inv.clientDocType}: {inv.clientDocNumber} {inv.clientNrc ? `| NRC: ${inv.clientNrc}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {inv.emissionDate} <span className="text-[10px] text-slate-400">{inv.emissionTime}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 tabular-nums">
                        ${inv.subtotalGravado.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-purple-700 tabular-nums">
                        ${inv.iva13.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm tabular-nums">
                        ${inv.totalPagar.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          PROCESADO MH
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setActiveDtePreview(inv)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-600 font-semibold text-xs transition-colors inline-flex items-center gap-1 active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
