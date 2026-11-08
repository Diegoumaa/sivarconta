import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BookOpen, Download, Printer, Filter, Calendar, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { calculateIvaLedger } from '../../utils/ivaLedger';
import { buildBookXlsx, downloadBlob } from '../../utils/reportExport';
import { exportBookPdf } from '../../utils/bookPdfExport';
import { buildIvaBookReport, bookSpreadsheetRows, includeIssuedFse } from '../../utils/ivaBookReport';
import { IvaBookTable } from './IvaBookTable';
import { SpecialAnnexes } from './SpecialAnnexes';
import { AnnexExport } from './AnnexExport';

export const IvaBooksView: React.FC = () => {
  const { currentCompany, filteredInvoices, filteredPurchases, filteredAnnexRecords = [], dataMode } = useApp();
  const [activeTab, setActiveTab] = useState<'ventas_contribuyente' | 'ventas_consumidor' | 'compras'>('ventas_contribuyente');
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit'
    }).formatToParts(new Date());
    return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
  });
  const selectedMonth = selectedPeriod.slice(5, 7);
  const selectedYear = selectedPeriod.slice(0, 4);
  const periodLabel = new Date(`${selectedPeriod}-01T12:00:00Z`).toLocaleDateString('es-SV', {
    timeZone: 'America/El_Salvador', month: 'long', year: 'numeric'
  });
  const periodInvoices = filteredInvoices.filter(invoice =>
    invoice.emissionDate.startsWith(`${selectedPeriod}-`) && invoice.status === 'PROCESADO_MH');
  const periodPurchases = includeIssuedFse(filteredPurchases, periodInvoices)
    .filter(purchase => purchase.emissionDate.startsWith(`${selectedPeriod}-`));

  // Filter invoices for DTE-03 (Ventas a Contribuyente)
  const ventasContribuyente = periodInvoices.filter(i => i.dteType === '03' || i.dteType === '05' || i.dteType === '06');
  
  // Filter invoices for DTE-01 (Ventas a Consumidor Final)
  const ventasConsumidor = periodInvoices.filter(i => i.dteType === '01');

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
  const totalComprasGravadas = periodPurchases.reduce((a, b) => a + (b.docType === 'NOTA_CREDITO' ? -b.purchasesGravadas : b.purchasesGravadas), 0);
  const totalCreditoFiscal = periodPurchases.reduce((a, b) => a + (b.docType === 'NOTA_CREDITO' ? -b.creditoFiscal : b.creditoFiscal), 0);
  const totalComprasPagar = periodPurchases.reduce((a, b) => a + (b.docType === 'NOTA_CREDITO' ? -b.totalPagar : b.totalPagar), 0);

  // Overall IVA Balance for F07
  const debitoTotalPeriodo = totalDebitoContrib + totalIvaConsum;
  const creditoTotalPeriodo = totalCreditoFiscal;
  const ledger = calculateIvaLedger(filteredInvoices, filteredPurchases, selectedPeriod, currentCompany?.settings, filteredAnnexRecords);
  const saldoF07 = ledger.payable > 0 ? ledger.payable : -ledger.carry;
  const report = { ...buildIvaBookReport(activeTab, periodInvoices, periodPurchases), notice: dataMode === 'local-demo' ? 'DATOS DE DEMOSTRACIÓN · SIN VALIDEZ FISCAL' : undefined };
  const exportExcel = () => {
    try {
      const bytes = buildBookXlsx(bookSpreadsheetRows(report, currentCompany, periodLabel), report.widths, report.firstMoney);
      downloadBlob(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Libro_IVA_${activeTab}_${selectedPeriod}.xlsx`);
    } catch { toast.error('No se pudo generar el libro de Excel.'); }
  };

  const exportCsv = () => {
    if (report.rows.length === 0) {
      toast.info('El libro seleccionado no tiene movimientos en este período.');
      return;
    }
    // Quote text, escape embedded quotes, and prevent spreadsheet formula execution.
    // Numeric values remain numeric so credit notes retain their negative amounts.
    const csvCell = (value: string | number) => {
      if (typeof value === 'number') return value.toFixed(2);
      const text = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
      return `"${text.replace(/"/g, '""')}"`;
    };
    let rows: (string | number)[][];
    if (activeTab === 'ventas_contribuyente') {
      rows = [['Fecha', 'Tipo_DTE', 'Numero_Control', 'Codigo_Generacion', 'Cliente', 'NRC', 'Venta_Gravada', 'Venta_Exenta', 'Debito_Fiscal_13', 'IVA_Retenido_1', 'IVA_Percibido_1', 'Total']];
      ventasContribuyente.forEach(v => {
        const sign = v.dteType === '05' ? -1 : 1;
        rows.push([v.emissionDate, v.dteType, v.controlNumber, v.generationCode, v.clientName, v.clientNrc || '', v.subtotalGravado * sign, v.subtotalExento * sign, v.iva13 * sign, v.retencion1 * sign, (v.percepcion1 || 0) * sign, v.totalPagar * sign]);
      });
    } else if (activeTab === 'ventas_consumidor') {
      rows = [['Fecha', 'Numero_Control', 'Cliente', 'Venta_Gravada', 'Venta_Exenta', 'IVA_Implicito', 'Total']];
      ventasConsumidor.forEach(v => {
        rows.push([v.emissionDate, v.controlNumber, v.clientName, v.subtotalGravado, v.subtotalExento, v.iva13, v.totalPagar]);
      });
    } else {
      rows = [['Fecha', 'Tipo_Doc', 'Numero_Documento', 'Proveedor', 'NRC', 'Compra_Gravada', 'Compra_Exenta', 'Credito_Fiscal_13', 'IVA_Retenido_1', 'Renta_Retenida_10', 'Total', 'Sujeto_Excluido']];
      periodPurchases.forEach(p => {
        const sign = p.docType === 'NOTA_CREDITO' ? -1 : 1;
        const fse = p.docType === 'SUJETO_EXCLUIDO';
        rows.push([p.emissionDate, p.docType, p.docNumber, p.supplierName, p.supplierNrc || '', fse ? 0 : p.purchasesGravadas * sign, fse ? 0 : p.purchasesExentas * sign, p.creditoFiscal * sign, p.retencion1 * sign, (p.retencionRenta10 || 0) * sign, p.totalPagar * sign, fse ? p.purchasesGravadas + p.purchasesExentas : 0]);
      });
    }
    const csvContent = rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `Libro_IVA_${activeTab}_${selectedMonth}_${selectedYear}.csv`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      document.body.removeChild(link);
      // Let the browser begin the download before releasing its object URL.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    toast.success('Libro de IVA exportado a CSV exitosamente', { description: filename });
  };

  const handlePrint = () => {
    toast.info('Abriendo vista de impresión del libro...');
    window.print();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <style media="print">{'@page { size: legal landscape; margin: 9mm; }'}</style>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Libros de IVA
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200/70">
              Papel legal horizontal
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Empresa: <strong>{currentCompany?.name || 'Empresa No Configurada'}</strong> • NRC: <span className="font-mono text-slate-700">{currentCompany?.nrc || '---'}</span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportExcel} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Descargar Excel</button>
          <button type="button" onClick={async () => { try { await exportBookPdf(report, currentCompany, periodLabel, `Libro_IVA_${activeTab}_${selectedPeriod}.pdf`); } catch { toast.error('No se pudo generar el PDF.'); } }} className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800">Descargar PDF</button>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors btn-tactile cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Exportar CSV del libro</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-sm transition-colors btn-tactile cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Libro</span>
          </button>
          </div>
          <p className="text-xs text-slate-600">Excel, PDF y CSV del libro son para consulta. Para la declaración de IVA en Hacienda, descarga el archivo fiscal en la sección <strong>Anexo CSV F-07</strong>.</p>
        </div>
      </div>


      {/* F07 Liquidación Summary Card */}
      <div className="p-5 rounded-2xl bg-white text-slate-900 border border-slate-200/80 border-l-4 border-l-brand-600 shadow-sm no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60 inline-block mb-1">
              Resumen para Declaración de Impuestos F07 (IVA Mensual)
            </span>
            <div className="flex flex-wrap items-center gap-6 mt-2 text-xs">
              <div>
                <span className="text-slate-500 block font-medium">Total Débito Fiscal (Ventas):</span>
                <span className="text-lg font-mono font-bold text-amber-600">${debitoTotalPeriodo.toFixed(2)}</span>
              </div>
              <div className="text-slate-400 font-bold text-xl">−</div>
              <div>
                <span className="text-slate-500 block font-medium">Total Crédito Fiscal (Compras):</span>
                <span className="text-lg font-mono font-bold text-emerald-600">${creditoTotalPeriodo.toFixed(2)}</span>
              </div>
              <div className="text-slate-400 font-bold text-xl">=</div>
              <div>
                <span className="text-slate-500 block font-medium">Resultado estimado de IVA:</span>
                <span className={`text-xl font-mono font-extrabold ${saldoF07 > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {saldoF07 > 0 ? `A Pagar: $${saldoF07.toFixed(2)}` : `Remanente a Favor: $${Math.abs(saldoF07).toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
            <Calendar className="w-4 h-4 text-brand-600" />
            <label htmlFor="iva-period" className="font-semibold text-slate-700">Período</label>
            <input id="iva-period" type="month" value={selectedPeriod} onChange={event => {
              if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setSelectedPeriod(event.target.value);
            }} className="min-w-0 rounded-lg border border-slate-300 bg-white p-2 text-slate-800" />
          </div>
        </div>
      </div>

      <div className="no-print rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 space-y-2">
        <p>A favor del período · Anticipo 2 % (161): <strong>${ledger.advance.toFixed(2)}</strong> · Retención 1 % (162): <strong>${ledger.retained.toFixed(2)}</strong> · Percepción 1 % (163): <strong>${ledger.perceived.toFixed(2)}</strong></p>
        <p>Como agente · Percepción 1 % (169): <strong>${ledger.perceptionToPay.toFixed(2)}</strong> · Retención 1 % (170): <strong>${ledger.withholdingToPay.toFixed(2)}</strong> · Anticipo 2 % (171): <strong>${ledger.advanceToPay.toFixed(2)}</strong> · Retención IVA 13 % (172): <strong>${ledger.withholding13ToPay.toFixed(2)}</strong></p>
        <p>Saldos anteriores · Crédito fiscal: <strong>${ledger.creditOpening.toFixed(2)}</strong> · Pagos a cuenta: <strong>${ledger.paymentOpening.toFixed(2)}</strong>. Para el siguiente mes · Crédito fiscal: <strong>${ledger.creditCarry.toFixed(2)}</strong> · Pagos a cuenta: <strong>${ledger.paymentCarry.toFixed(2)}</strong>.</p>
        <p className="text-xs">Estimación a partir de los documentos registrados. Los comprobantes vinculados sustituyen los importes de origen en la casilla correspondiente. La liquidación oficial se completa en Hacienda, incluidos los ajustes que correspondan.</p>
      </div>
      <SpecialAnnexes key={`${currentCompany?.id}:${selectedPeriod}`} period={selectedPeriod} />
      <AnnexExport key={`${activeTab}:${selectedPeriod}:${currentCompany?.id}`} kind={activeTab} invoices={periodInvoices} purchases={periodPurchases} period={selectedPeriod} />
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
          1. Libro de Ventas a Contribuyentes
        </button>
        <button
          onClick={() => setActiveTab('ventas_consumidor')}
          className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all shrink-0 ${
            activeTab === 'ventas_consumidor'
              ? 'bg-white border-t border-x border-slate-200 text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          2. Libro de Ventas a Consumidor Final
        </button>
        <button
          onClick={() => setActiveTab('compras')}
          className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all shrink-0 ${
            activeTab === 'compras'
              ? 'bg-white border-t border-x border-slate-200 text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          3. Libro de Compras
        </button>
      </div>

      {/* Table Container */}
      <div id="printable-iva-book" className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-4 sm:p-6 print:p-0 print:border-none print:shadow-none">
        {/* Printable Official Header */}
        {report.notice && <p className="mb-3 text-center text-xs font-bold text-amber-800">{report.notice}</p>}
        <div className="text-center mb-6 pb-4 border-b-2 border-slate-900">
          <h2 className="font-black text-lg uppercase tracking-tight text-slate-900">{currentCompany?.name || 'Empresa No Configurada'}</h2>
          <p className="text-xs font-mono">NIT: {currentCompany?.nit || '---'} • NRC: {currentCompany?.nrc || '---'}</p>
          <h3 className="font-extrabold text-sm uppercase text-slate-800 mt-2">
            {activeTab === 'ventas_contribuyente' && 'LIBRO DE VENTAS A CONTRIBUYENTES'}
            {activeTab === 'ventas_consumidor' && 'LIBRO DE VENTAS A CONSUMIDOR FINAL'}
            {activeTab === 'compras' && 'LIBRO DE COMPRAS'}
          </h3>
          <p className="text-xs text-slate-600">Período: {periodLabel}</p><p className="text-xs text-slate-600">Valores expresados en USD</p>
        </div>

        <IvaBookTable report={report} />
      </div>
    </div>
  );
};
