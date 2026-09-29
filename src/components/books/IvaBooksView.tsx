import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BookOpen, Download, Printer, Filter, Calendar, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

export const IvaBooksView: React.FC = () => {
  const { currentCompany, filteredInvoices, filteredPurchases } = useApp();
  const [activeTab, setActiveTab] = useState<'ventas_contribuyente' | 'ventas_consumidor' | 'compras'>('ventas_contribuyente');
  const [selectedMonth, setSelectedMonth] = useState('09');
  const [selectedYear, setSelectedYear] = useState('2026');

  // Filter invoices for DTE-03 (Ventas a Contribuyente)
  const ventasContribuyente = filteredInvoices.filter(i => i.dteType === '03' || i.dteType === '05' || i.dteType === '06');
  
  // Filter invoices for DTE-01 (Ventas a Consumidor Final)
  const ventasConsumidor = filteredInvoices.filter(i => i.dteType === '01');

  // Totals Ventas Contribuyente (Nota de Crédito DTE-05 subtracts from sales & fiscal debit per El Salvador Tax Code)
  const totalGravadasContrib = ventasContribuyente.reduce((a, b) => a + (b.dteType === '05' ? -b.subtotalGravado : b.subtotalGravado), 0);
  const totalDebitoContrib = ventasContribuyente.reduce((a, b) => a + (b.dteType === '05' ? -b.iva13 : b.iva13), 0);
  const totalRetenidoContrib = ventasContribuyente.reduce((a, b) => a + (b.dteType === '05' ? -b.retencion1 : b.retencion1), 0);
  const totalVentasContrib = ventasContribuyente.reduce((a, b) => a + (b.dteType === '05' ? -b.totalPagar : b.totalPagar), 0);

  // Totals Ventas Consumidor
  const totalGravadasConsum = ventasConsumidor.reduce((a, b) => a + b.subtotalGravado, 0);
  const totalIvaConsum = ventasConsumidor.reduce((a, b) => a + b.iva13, 0);
  const totalVentasConsum = ventasConsumidor.reduce((a, b) => a + b.totalPagar, 0);

  // Totals Compras (NOTA_CREDITO from suppliers subtracts from purchases and Crédito Fiscal)
  const totalComprasGravadas = filteredPurchases.reduce((a, b) => a + (b.docType === 'NOTA_CREDITO' ? -b.purchasesGravadas : b.purchasesGravadas), 0);
  const totalCreditoFiscal = filteredPurchases.reduce((a, b) => a + (b.docType === 'NOTA_CREDITO' ? -b.creditoFiscal : b.creditoFiscal), 0);
  const totalComprasPagar = filteredPurchases.reduce((a, b) => a + (b.docType === 'NOTA_CREDITO' ? -b.totalPagar : b.totalPagar), 0);

  // Overall IVA Balance for F07
  const debitoTotalPeriodo = totalDebitoContrib + totalIvaConsum;
  const creditoTotalPeriodo = totalCreditoFiscal;
  const saldoF07 = debitoTotalPeriodo - creditoTotalPeriodo;

  const exportCsv = () => {
    let csvContent = "";
    
    if (activeTab === 'ventas_contribuyente') {
      csvContent += "Fecha,Tipo_DTE,Numero_Control,Codigo_Generacion,Cliente,NRC,Venta_Gravada,Debito_Fiscal_13,IVA_Retenido_1,Total\n";
      ventasContribuyente.forEach(v => {
        const sign = v.dteType === '05' ? -1 : 1;
        csvContent += `"${v.emissionDate}","${v.dteType}","${v.controlNumber}","${v.generationCode}","${v.clientName}","${v.clientNrc || ''}",${(v.subtotalGravado * sign).toFixed(2)},${(v.iva13 * sign).toFixed(2)},${(v.retencion1 * sign).toFixed(2)},${(v.totalPagar * sign).toFixed(2)}\n`;
      });
    } else if (activeTab === 'ventas_consumidor') {
      csvContent += "Fecha,Numero_Control,Cliente,Venta_Gravada_Con_IVA,IVA_Implicito,Total\n";
      ventasConsumidor.forEach(v => {
        csvContent += `"${v.emissionDate}","${v.controlNumber}","${v.clientName}",${v.subtotalGravado.toFixed(2)},${v.iva13.toFixed(2)},${v.totalPagar.toFixed(2)}\n`;
      });
    } else {
      csvContent += "Fecha,Tipo_Doc,Numero_Documento,Proveedor,NRC,Compra_Gravada,Credito_Fiscal_13,Total\n";
      filteredPurchases.forEach(p => {
        const sign = p.docType === 'NOTA_CREDITO' ? -1 : 1;
        csvContent += `"${p.emissionDate}","${p.docType}","${p.docNumber}","${p.supplierName}","${p.supplierNrc || ''}",${(p.purchasesGravadas * sign).toFixed(2)},${(p.creditoFiscal * sign).toFixed(2)},${(p.totalPagar * sign).toFixed(2)}\n`;
      });
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `Libro_IVA_${activeTab}_${selectedMonth}_${selectedYear}.csv`;
    const link = document.createElement("a");
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Libro de IVA exportado a CSV exitosamente', { description: filename });
  };

  const handlePrint = () => {
    toast.info('Abriendo vista de impresión de libros oficiales...');
    window.print();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Libros de IVA Oficiales (F07)
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
              Formato DGII El Salvador
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Empresa: <strong>{currentCompany?.name || 'Empresa No Configurada'}</strong> • NRC: <span className="font-mono text-slate-700">{currentCompany?.nrc || '---'}</span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Exportar CSV (Excel)</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-sm transition-colors active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Libro</span>
          </button>
        </div>
      </div>


      {/* F07 Liquidación Summary Card */}
      <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 block mb-1">
              Resumen para Declaración de Impuestos F07 (IVA Mensual)
            </span>
            <div className="flex flex-wrap items-center gap-6 mt-2 text-xs">
              <div>
                <span className="text-slate-400 block">Total Débito Fiscal (Ventas):</span>
                <span className="text-lg font-mono font-bold text-amber-400">${debitoTotalPeriodo.toFixed(2)}</span>
              </div>
              <div className="text-slate-600 font-bold text-xl">−</div>
              <div>
                <span className="text-slate-400 block">Total Crédito Fiscal (Compras):</span>
                <span className="text-lg font-mono font-bold text-emerald-400">${creditoTotalPeriodo.toFixed(2)}</span>
              </div>
              <div className="text-slate-600 font-bold text-xl">=</div>
              <div>
                <span className="text-slate-400 block">Resultado F07 a Declarar:</span>
                <span className={`text-xl font-mono font-extrabold ${saldoF07 > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {saldoF07 > 0 ? `A Pagar: $${saldoF07.toFixed(2)}` : `Remanente a Favor: $${Math.abs(saldoF07).toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-800/80 p-2 rounded-xl border border-slate-700 text-xs">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-200">Período: Septiembre 2026</span>
          </div>
        </div>
      </div>

      {/* Tabs for the 3 Books */}
      <div className="flex border-b border-slate-200 gap-2 no-print overflow-x-auto">
        <button
          onClick={() => setActiveTab('ventas_contribuyente')}
          className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all shrink-0 ${
            activeTab === 'ventas_contribuyente'
              ? 'bg-white border-t border-x border-slate-200 text-purple-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          1. Libro de Ventas a Contribuyentes (DTE-03 CCF)
        </button>
        <button
          onClick={() => setActiveTab('ventas_consumidor')}
          className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all shrink-0 ${
            activeTab === 'ventas_consumidor'
              ? 'bg-white border-t border-x border-slate-200 text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          2. Libro de Ventas a Consumidor Final (DTE-01)
        </button>
        <button
          onClick={() => setActiveTab('compras')}
          className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all shrink-0 ${
            activeTab === 'compras'
              ? 'bg-white border-t border-x border-slate-200 text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          3. Libro de Compras (Crédito Fiscal)
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-4 sm:p-6 print:p-0 print:border-none print:shadow-none">
        {/* Printable Official Header */}
        <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-slate-900">
          <h2 className="font-black text-lg uppercase tracking-tight text-slate-900">{currentCompany?.name || 'Empresa No Configurada'}</h2>
          <p className="text-xs font-mono">NIT: {currentCompany?.nit || '---'} • NRC: {currentCompany?.nrc || '---'}</p>
          <h3 className="font-extrabold text-sm uppercase text-slate-800 mt-2">
            {activeTab === 'ventas_contribuyente' && 'LIBRO DE VENTAS A CONTRIBUYENTES (CRÉDITO FISCAL)'}
            {activeTab === 'ventas_consumidor' && 'LIBRO DE VENTAS A CONSUMIDOR FINAL (FACTURAS)'}
            {activeTab === 'compras' && 'LIBRO DE COMPRAS'}
          </h3>
          <p className="text-xs text-slate-600">Mes: Septiembre | Año: 2026 (Valores expresados en USD)</p>
        </div>

        {/* Tab 1: Ventas a Contribuyentes */}
        {activeTab === 'ventas_contribuyente' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-purple-50/60 border-b border-purple-200 text-purple-900 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Número de Control DTE</th>
                  <th className="py-2.5 px-3">Nombre del Cliente</th>
                  <th className="py-2.5 px-3">NRC Cliente</th>
                  <th className="py-2.5 px-3 text-right">Venta Gravada</th>
                  <th className="py-2.5 px-3 text-right">Débito Fiscal (13%)</th>
                  <th className="py-2.5 px-3 text-right">Retención (1%)</th>
                  <th className="py-2.5 px-3 text-right">Total Facturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ventasContribuyente.map(v => {
                  const isNC = v.dteType === '05';
                  return (
                    <tr key={v.id} className={`hover:bg-slate-50 font-mono text-[11px] ${isNC ? 'bg-amber-50/40 text-amber-900' : ''}`}>
                      <td className="py-2.5 px-3 text-slate-600">{v.emissionDate}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {v.controlNumber}
                        {isNC && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">NC</span>}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-800 max-w-[180px] truncate">{v.clientName}</td>
                      <td className="py-2.5 px-3 text-purple-700">{v.clientNrc || '---'}</td>
                      <td className={`py-2.5 px-3 text-right ${isNC ? 'text-amber-700 font-bold' : 'text-slate-700'}`}>
                        {isNC ? `-$${v.subtotalGravado.toFixed(2)}` : `$${v.subtotalGravado.toFixed(2)}`}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isNC ? 'text-rose-600' : 'text-purple-700'}`}>
                        {isNC ? `-$${v.iva13.toFixed(2)}` : `+$${v.iva13.toFixed(2)}`}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-700">
                        {v.retencion1 > 0 ? (isNC ? `+$${v.retencion1.toFixed(2)}` : `-$${v.retencion1.toFixed(2)}`) : '$0.00'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isNC ? 'text-amber-800' : 'text-slate-900'}`}>
                        {isNC ? `-$${v.totalPagar.toFixed(2)}` : `$${v.totalPagar.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-purple-50/80 font-mono font-bold text-xs border-t-2 border-purple-300">
                  <td colSpan={4} className="py-3 px-3 uppercase text-purple-900 font-sans">
                    TOTALES DEL PERÍODO (VENTAS CONTRIBUYENTE):
                  </td>
                  <td className="py-3 px-3 text-right">${totalGravadasContrib.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-purple-800">${totalDebitoContrib.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-amber-800">${totalRetenidoContrib.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-slate-900 text-sm">${totalVentasContrib.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Tab 2: Ventas a Consumidor Final */}
        {activeTab === 'ventas_consumidor' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-blue-50/60 border-b border-blue-200 text-blue-900 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Número de Control DTE</th>
                  <th className="py-2.5 px-3">Cliente / Consumidor</th>
                  <th className="py-2.5 px-3 text-right">Ventas Gravadas Locales</th>
                  <th className="py-2.5 px-3 text-right">IVA Implícito (13%)</th>
                  <th className="py-2.5 px-3 text-right">Total Ventas Diarias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ventasConsumidor.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50 font-mono text-[11px]">
                    <td className="py-2.5 px-3 text-slate-600">{v.emissionDate}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{v.controlNumber}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">{v.clientName}</td>
                    <td className="py-2.5 px-3 text-right text-slate-700">${v.subtotalGravado.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-blue-700">${v.iva13.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">${v.totalPagar.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50/80 font-mono font-bold text-xs border-t-2 border-blue-300">
                  <td colSpan={3} className="py-3 px-3 uppercase text-blue-900 font-sans">
                    TOTALES DEL PERÍODO (CONSUMIDOR FINAL):
                  </td>
                  <td className="py-3 px-3 text-right">${totalGravadasConsum.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-blue-800">${totalIvaConsum.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-slate-900 text-sm">${totalVentasConsum.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Tab 3: Libro de Compras */}
        {activeTab === 'compras' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-emerald-50/60 border-b border-emerald-200 text-emerald-900 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Comprobante CCF</th>
                  <th className="py-2.5 px-3">Proveedor</th>
                  <th className="py-2.5 px-3">NRC Proveedor</th>
                  <th className="py-2.5 px-3 text-right">Compras Gravadas</th>
                  <th className="py-2.5 px-3 text-right">Crédito Fiscal (13%)</th>
                  <th className="py-2.5 px-3 text-right">Total Factura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 font-mono text-[11px]">
                    <td className="py-2.5 px-3 text-slate-600">{p.emissionDate}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{p.docNumber}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800 max-w-[200px] truncate">{p.supplierName}</td>
                    <td className="py-2.5 px-3 text-emerald-700">{p.supplierNrc || '---'}</td>
                    <td className="py-2.5 px-3 text-right text-slate-700">${p.purchasesGravadas.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">+${p.creditoFiscal.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">${p.totalPagar.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50/80 font-mono font-bold text-xs border-t-2 border-emerald-300">
                  <td colSpan={4} className="py-3 px-3 uppercase text-emerald-900 font-sans">
                    TOTALES DEL PERÍODO (COMPRAS):
                  </td>
                  <td className="py-3 px-3 text-right">${totalComprasGravadas.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-emerald-800">${totalCreditoFiscal.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-slate-900 text-sm">${totalComprasPagar.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
