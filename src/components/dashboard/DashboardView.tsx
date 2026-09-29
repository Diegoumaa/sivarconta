import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  FileText, 
  PlusCircle, 
  Clock, 
  Eye, 
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Copy,
  Building2,
  ChevronRight,
  Info
} from 'lucide-react';
import { DTE_NAMES, DteType } from '../../types';
import { toast } from 'sonner';

export const DashboardView: React.FC = () => {
  const { 
    currentCompany, 
    filteredInvoices, 
    filteredPurchases, 
    filteredProducts, 
    filteredClients, 
    setCurrentView, 
    setActiveDtePreview,
    startNewInvoiceWithDte 
  } = useApp();
  
  const [period, setPeriod] = useState<'mes' | 'semana' | 'hoy'>('mes');
  const [dismissOnboarding, setDismissOnboarding] = useState(false);

  // Calculations: DTE-05 (Nota de Crédito) subtracts from sales & Débito Fiscal per El Salvador Tax Code
  const totalVentas = filteredInvoices.reduce(
    (acc, inv) => acc + (inv.dteType === '05' ? -inv.totalPagar : inv.totalPagar),
    0
  );
  const debitoFiscalTotal = filteredInvoices.reduce(
    (acc, inv) => acc + (inv.dteType === '05' ? -inv.iva13 : inv.iva13),
    0
  );
  
  const totalCompras = filteredPurchases.reduce(
    (acc, pur) => acc + (pur.docType === 'NOTA_CREDITO' ? -pur.totalPagar : pur.totalPagar),
    0
  );
  const creditoFiscalTotal = filteredPurchases.reduce(
    (acc, pur) => acc + (pur.docType === 'NOTA_CREDITO' ? -pur.creditoFiscal : pur.creditoFiscal),
    0
  );

  // F07 IVA Balance (El Salvador)
  const balanceIva = debitoFiscalTotal - creditoFiscalTotal;
  const saldoAPagar = balanceIva > 0 ? balanceIva : 0;
  const remanenteCredito = balanceIva < 0 ? Math.abs(balanceIva) : 0;

  // Group by DTE type
  const countByType: Record<string, number> = {};
  filteredInvoices.forEach(inv => {
    countByType[inv.dteType] = (countByType[inv.dteType] || 0) + 1;
  });

  // Onboarding Steps computation
  const step1Complete = Boolean(currentCompany?.name && currentCompany?.nrc);
  const step2Complete = filteredProducts.length > 0;
  const step3Complete = filteredInvoices.length > 0;
  const completedStepsCount = [step1Complete, step2Complete, step3Complete].filter(Boolean).length;
  const progressPercent = Math.round((completedStepsCount / 3) * 100);

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Top Banner & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Dashboard Financiero & Tributario
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Activo
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Empresa: <strong className="text-slate-800">{currentCompany?.name || 'Empresa No Configurada'}</strong> • NRC: <span className="font-mono text-slate-700 font-semibold">{currentCompany?.nrc || '---'}</span>
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl self-start sm:self-auto border border-slate-200">
          {(['hoy', 'semana', 'mes'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-150 active:scale-95 cursor-pointer ${
                period === p
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {p === 'mes' ? 'Este Mes' : p === 'semana' ? 'Esta Semana' : 'Hoy'}
            </button>
          ))}
        </div>
      </div>

      {/* Onboarding Widget: "Camino al Éxito Fiscal" (Linear Style) */}
      {!dismissOnboarding && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                  Guía de Inicio Rápido para Emprendedores
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Emite tus facturas electrónicas en 3 sencillos pasos
              </h2>
              <p className="text-xs text-slate-300 max-w-xl">
                Hemos preparado esta guía interactiva para acompañarte paso a paso sin complicaciones tributarias.
              </p>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3 bg-slate-800/90 p-2.5 px-3.5 rounded-xl border border-slate-700/80 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-medium">Progreso</span>
                <span className="text-sm font-extrabold font-mono text-cyan-300">{progressPercent}%</span>
              </div>
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 3 Step Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800/80 relative z-10">
            {/* Step 1 */}
            <div className="bg-slate-850 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between hover:border-slate-600 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step1Complete ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {step1Complete ? <Check className="w-3 h-3 stroke-[3]" /> : '1'}
                  </span>
                  <span className="text-xs font-bold text-slate-100">Datos de Empresa</span>
                </div>
                <p className="text-[11px] text-slate-400">NRC y giro configurados</p>
              </div>
              <button 
                onClick={() => setCurrentView('settings')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold active:scale-95 transition-transform"
              >
                Revisar
              </button>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-850 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between hover:border-slate-600 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step2Complete ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {step2Complete ? <Check className="w-3 h-3 stroke-[3]" /> : '2'}
                  </span>
                  <span className="text-xs font-bold text-slate-100">Catálogo Inicial</span>
                </div>
                <p className="text-[11px] text-slate-400">{filteredProducts.length} productos listos</p>
              </div>
              <button 
                onClick={() => setCurrentView('catalog')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold active:scale-95 transition-transform"
              >
                Catálogo
              </button>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-850 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between hover:border-slate-600 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step3Complete ? 'bg-emerald-500 text-white' : 'bg-brand-500 text-white animate-pulse'
                  }`}>
                    {step3Complete ? <Check className="w-3 h-3 stroke-[3]" /> : '3'}
                  </span>
                  <span className="text-xs font-bold text-slate-100">Emitir Primer DTE</span>
                </div>
                <p className="text-[11px] text-slate-400">Prueba en Sandbox</p>
              </div>
              <button 
                onClick={() => startNewInvoiceWithDte('01')}
                className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <span>Emitir</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main KPI Cards (Tremor Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ventas Facturadas</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
              ${totalVentas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                {filteredInvoices.length} DTEs
              </span>
              <span>documentos DTE emitidos</span>
            </div>
          </div>
        </div>

        {/* Compras Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Compras Registradas</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
              ${totalCompras.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
                {filteredPurchases.length} docs
              </span>
              <span>comprobantes recibidos</span>
            </div>
          </div>
        </div>

        {/* Débito Fiscal Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Débito Fiscal (IVA 13%)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 font-mono tabular-nums tracking-tight">
              ${debitoFiscalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-2">IVA generado en tus ventas</p>
          </div>
        </div>

        {/* Crédito Fiscal Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Crédito Fiscal (Compras)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono tabular-nums tracking-tight">
              ${creditoFiscalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-2">IVA deducible de tus compras</p>
          </div>
        </div>
      </div>

      {/* Special Tax Alert: F07 Liquidación de IVA Estimada (Tremor Executive Card) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 text-white shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
              FORMULARIO F07 MINISTERIO DE HACIENDA
            </span>
            <span className="text-xs text-slate-400 font-medium">Liquidación Proyectada</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Liquidación de IVA del Mes</h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            Débito Fiscal (${debitoFiscalTotal.toFixed(2)}) − Crédito Fiscal (${creditoFiscalTotal.toFixed(2)}) =
            {saldoAPagar > 0 ? (
              <span className="text-amber-400 font-bold ml-1">Impuesto a Pagar a Hacienda: ${saldoAPagar.toFixed(2)}</span>
            ) : (
              <span className="text-emerald-400 font-bold ml-1">Remanente de Crédito Fiscal a Favor: ${remanenteCredito.toFixed(2)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setCurrentView('books')}
            className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            Ver Libros Oficiales F07
          </button>
        </div>
      </div>

      {/* Quick Launchpad & Documents by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launch DTEs */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-brand-600" />
              Emisión Rápida de DTEs
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Haz clic en el documento que necesitas emitir:
            </p>
          </div>
          <div className="space-y-2">
            {(['01', '03', '14', '05', '06'] as DteType[]).map(type => {
              const meta = DTE_NAMES[type];
              return (
                <button
                  key={type}
                  onClick={() => startNewInvoiceWithDte(type)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/20 transition-all text-left group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      {type}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{meta.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {countByType[type] || 0} emitidos este mes
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-brand-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                    Emitir →
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent DTE Transactions */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Últimos Documentos Transmitidos a Hacienda
              </h3>
              <button
                onClick={() => setCurrentView('invoices')}
                className="text-xs text-brand-600 font-bold hover:underline cursor-pointer active:scale-95 transition-transform"
              >
                Ver todos ({filteredInvoices.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="pb-2.5">DTE / Control</th>
                    <th className="pb-2.5">Cliente</th>
                    <th className="pb-2.5">Fecha</th>
                    <th className="pb-2.5 text-right">Total</th>
                    <th className="pb-2.5 text-center">Estado MH</th>
                    <th className="pb-2.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No hay documentos emitidos todavía en esta empresa.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.slice(0, 5).map(inv => {
                      const meta = DTE_NAMES[inv.dteType];
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 font-medium text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.badgeColor}`}>
                                {inv.dteType}
                              </span>
                              <span className="font-mono text-[11px] text-slate-700 font-semibold">{inv.controlNumber.split('-').slice(2).join('-')}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(inv.generationCode);
                                  toast.success('UUID copiado al portapapeles', { description: inv.generationCode });
                                }}
                                className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                                title="Copiar UUID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 max-w-[150px] truncate text-slate-700 font-medium">
                            {inv.clientName}
                          </td>
                          <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                            {inv.emissionDate}
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                            ${inv.totalPagar.toFixed(2)}
                          </td>
                          <td className="py-2.5 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Aprobado
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            <button
                              onClick={() => setActiveDtePreview(inv)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100 transition-colors active:scale-90 cursor-pointer"
                              title="Ver DTE Oficial"
                            >
                              <Eye className="w-4 h-4" />
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

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Validación en tiempo real con servidor DGII de El Salvador</span>
            <span className="font-mono font-medium text-slate-600">Ambiente: {currentCompany?.mhEnvironment || 'PRUEBAS'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

