import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { F07Renta, PurchaseDocument } from '../../types';
import { ShoppingBag, Plus, Search, FileText, X, AlertCircle, Copy } from 'lucide-react';
import { validateNit, validateNrc, validateDui } from '../../utils/svTaxValidators';
import { copyToClipboard } from '../../utils/clipboard';
import { purchaseTaxes } from '../../utils/purchaseTaxes';
import { isF07Purchase, needsF07Renta, validF07Renta } from '../../utils/f07Renta';
import { F07RentaFields } from '../books/F07RentaFields';
import { toast } from 'sonner';

const currentSvDate = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
};

export const PurchasesView: React.FC = () => {
  const { filteredPurchases, addPurchase, filteredSuppliers = [], addSupplier } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Form State
  const [supplierName, setSupplierName] = useState('');
  const [supplierNit, setSupplierNit] = useState('');
  const [supplierNrc, setSupplierNrc] = useState('');
  const [supplierDocType, setSupplierDocType] = useState<'NIT' | 'DUI'>('NIT');
  const [isService, setIsService] = useState(false);
  const [retainRenta, setRetainRenta] = useState(false);
  const [perceiveVat, setPerceiveVat] = useState(false);
  const [perceptionBase, setPerceptionBase] = useState('');
  const [documentSeries, setDocumentSeries] = useState('');
  const [retain13, setRetain13] = useState(false);
  const [retainVat, setRetainVat] = useState(false);
  const [purchasesExentas, setPurchasesExentas] = useState(0);
  const suppliers = [...new Map([...filteredPurchases.filter(p => p.supplierNit), ...filteredSuppliers.map(s => ({ supplierName: s.name, supplierNit: s.docNumber, supplierNrc: s.nrc }))].map(p => [p.supplierNit, p])).values()];
  const [docNumber, setDocNumber] = useState('');
  const [documentClass, setDocumentClass] = useState<'1' | '2' | '4'>('1');
  const [generationCode, setGenerationCode] = useState('');
  const [docType, setDocType] = useState<'CCF' | 'FACTURA' | 'SUJETO_EXCLUIDO' | 'NOTA_CREDITO'>('CCF');
  const [concept, setConcept] = useState('');
  const [purchasesGravadas, setPurchasesGravadas] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Transferencia 365');
  const [errorMessage, setErrorMessage] = useState('');
  const [emissionDate, setEmissionDate] = useState(currentSvDate);
  const [f07Renta, setF07Renta] = useState<F07Renta>({ operation: '' });
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  // Lock body scroll and handle ESC key when modal is open
  useEffect(() => {
    if (!showModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingRef.current) {
        setShowModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal]);

  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const filtered = filteredPurchases.filter(p =>
    !invalidDateRange && (!dateFrom || p.emissionDate >= dateFrom) && (!dateTo || p.emissionDate <= dateTo) && (
    p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.docNumber.includes(searchTerm) ||
    p.concept.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const previewAmount = (value: number) => Number.isFinite(value) && value >= 0 && value <= 9999999.99 ? value : 0;
  const hasFiscalCredit = docType === 'CCF' || docType === 'NOTA_CREDITO';
  const canClassifyF07 = isF07Purchase(docType) && needsF07Renta('purchase', emissionDate);
  const subjectToPerception = perceptionBase === '' ? purchasesGravadas : Number(perceptionBase);
  const taxes = purchaseTaxes(previewAmount(purchasesGravadas), previewAmount(purchasesExentas), docType, {
    renta: retainRenta, retain: retainVat, perceive: perceiveVat && !retainVat,
    perceptionBase: subjectToPerception, retain13, service: isService
  });
  const { creditoFiscal, retencion1, retencionRenta10, percepcion1, retencionIva13, totalPagar } = taxes;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    setErrorMessage('');
    const hasF07Values = canClassifyF07 && Object.values(f07Renta).some(Boolean);
    if (hasF07Values && !validF07Renta('purchase', f07Renta)) {
      setErrorMessage('Completa los cuatro campos de renta del F‑07 o déjalos vacíos para revisar después.');
      return;
    }
    if (!supplierName.trim() || ![purchasesGravadas, purchasesExentas].every(n => Number.isFinite(n) && n >= 0 && n <= 9999999.99) || purchasesGravadas + purchasesExentas <= 0) {
      setErrorMessage('Ingresa el nombre del proveedor y montos de compra válidos, con un total mayor a $0.00.');
      return;
    }

    if (supplierNit.trim()) {
      const nitRes = supplierDocType === 'DUI' ? validateDui(supplierNit.trim()) : validateNit(supplierNit.trim());
      if (!nitRes.isValid) {
        setErrorMessage(nitRes.error || 'El NIT del proveedor es inválido.');
        return;
      }
    }

    if (supplierNrc.trim()) {
      if (docType === 'SUJETO_EXCLUIDO') { setErrorMessage('Una FSE corresponde a un proveedor sin NRC.'); return; }
      const nrcRes = validateNrc(supplierNrc.trim());
      if (!nrcRes.isValid) {
        setErrorMessage(nrcRes.error || 'El NRC del proveedor es inválido.');
        return;
      }
    }

    if (!docNumber.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(emissionDate)) {
      setErrorMessage('Ingresa el número de documento y una fecha válida.');
      return;
    }
    if (hasFiscalCredit && perceiveVat && (!percepcion1 || !supplierNit.trim() || !documentSeries.trim())) {
      setErrorMessage('Para registrar la percepción, ingresa la identificación, la serie o sello y una base de bienes desde $100 que no supere la compra gravada.');
      return;
    }
    if (documentSeries && (/[;"\x00-\x1f]/.test(documentSeries) || /^\s*[=+@-]/.test(documentSeries) || documentSeries.length > 100 || (documentClass === '4' && !/^[A-Z0-9]{40}$/i.test(documentSeries.trim())))) {
      setErrorMessage('Revisa la serie. Si el comprobante es electrónico, ingresa el sello de recepción real de 40 caracteres.');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      await addPurchase({
      documentClass,
      f07Renta: hasF07Values ? f07Renta : undefined,
      documentSeries: documentSeries.trim().toUpperCase() || undefined,
      perceptionBase: percepcion1 > 0 ? subjectToPerception : undefined,
      generationCode: documentClass === '4' ? generationCode.trim().toUpperCase() : undefined,
      docType,
      docNumber: docNumber.trim(),
      emissionDate,
      supplierName: supplierName.trim(),
      supplierNit: supplierNit.trim(),
      supplierNrc: supplierNrc.trim() || undefined,
      concept: concept.trim() || 'Compra de mercadería / gasto operativo',
      purchasesGravadas,
      purchasesExentas,
      creditoFiscal,
      retencion1, percepcion1, retencionIva13,
      retencionRenta10: retencionRenta10 > 0 ? retencionRenta10 : undefined,
      totalPagar,
      paymentMethod
      });

    // Reset & close
    setSupplierName('');
    setSupplierNit('');
    setSupplierNrc('');
    setDocNumber('');
    setDocumentSeries('');
    setPerceptionBase('');
    setConcept('');
    setF07Renta({ operation: '' });
    setPurchasesGravadas(0);
    setPurchasesExentas(0); setIsService(false); setRetainRenta(false); setRetainVat(false); setPerceiveVat(false); setRetain13(false);
    setErrorMessage('');
      setEmissionDate(currentSvDate());
      setShowModal(false);
    } catch {
      setErrorMessage('No se pudo guardar la compra. Revisa tu conexión e inténtalo de nuevo; tus datos siguen aquí.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Compras y gastos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Registro de comprobantes de crédito fiscal recibidos para deducción de IVA
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-tactile flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Compra</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            aria-label="Buscar compras"
            type="text"
            placeholder="Buscar por proveedor o # documento..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <label className="space-y-1">Desde<input aria-label="Compras desde" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="block rounded-lg border border-slate-300 bg-white p-2" /></label>
          <label className="space-y-1">Hasta<input aria-label="Compras hasta" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="block rounded-lg border border-slate-300 bg-white p-2" /></label>
          {(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="rounded-lg bg-slate-100 p-2 font-semibold text-slate-700">Limpiar fechas</button>}
        </div>
        {invalidDateRange && <p role="alert" className="text-xs text-red-700">La fecha inicial debe ser anterior o igual a la fecha final.</p>}
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Fecha & Documento</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">Concepto / Gasto</th>
                <th className="py-3 px-4 text-right">Compra Gravada</th>
                <th className="py-3 px-4 text-right">Crédito Fiscal (13%)</th>
                <th className="py-3 px-4 text-right">Total Pagado</th>
                <th className="py-3 px-4 text-center">Libro IVA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 mx-auto flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {searchTerm ? 'No se encontraron compras coincidentes' : 'No hay compras registradas'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {searchTerm 
                          ? `No hay ningún documento de compra que coincida con "${searchTerm}".`
                          : 'Registra tus comprobantes de Crédito Fiscal y facturas recibidas de proveedores para deducir IVA en el formulario F07.'}
                      </p>
                      {searchTerm ? (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="btn-tactile px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                        >
                          Limpiar filtro
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowModal(true)}
                          className="btn-tactile px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/20 inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Registrar Primera Compra</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900">{p.docNumber}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(p.docNumber, 'Documento copiado', p.docNumber)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors btn-tactile"
                          title="Copiar número de documento"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">{p.emissionDate}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{p.supplierName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        NIT: {p.supplierNit} {p.supplierNrc ? `| NRC: ${p.supplierNrc}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">
                      {p.concept}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 tabular-nums">
                      ${p.purchasesGravadas.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 tabular-nums">
                      +${p.creditoFiscal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm tabular-nums">
                      ${p.totalPagar.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Sincronizado
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Purchase */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingRef.current) setShowModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center animate-in fade-in duration-150 overflow-y-auto"
        >
          <div 
            role="dialog" aria-modal="true" aria-labelledby="purchase-dialog-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="bg-white text-slate-900 p-5 sm:p-6 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="purchase-dialog-title" className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                      Registrar Compra / Factura Recibida
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
                      Crédito Fiscal
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Comprobante tributario recibido para deducción en F07
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar formulario de compra"
                disabled={isSaving}
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} aria-busy={isSaving} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-slate-900">
              <fieldset disabled={isSaving} className="contents">
              {errorMessage && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-2 text-xs">
                <label className="block">Clase del comprobante<select aria-label="Clase del comprobante" value={documentClass} onChange={e => setDocumentClass(e.target.value as '1' | '2' | '4')} className="mt-1 block w-full rounded-xl border p-2"><option value="1">Impreso por imprenta</option><option value="2">Formulario único</option><option value="4">Documento electrónico</option></select></label>
                {documentClass === '4' && <label className="block">Código de generación del proveedor<input aria-label="Código de generación del proveedor" required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" value={generationCode} onChange={e => setGenerationCode(e.target.value)} className="mt-1 block w-full rounded-xl border p-2" /></label>}
                <label className="block">{documentClass === '4' ? 'Sello de recepción de la compra' : 'Serie de la compra'}<input maxLength={documentClass === '4' ? 40 : 100} value={documentSeries} onChange={e => setDocumentSeries(e.target.value)} className="mt-1 block w-full rounded-xl border p-2" /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="purchase-date" className="mb-1 block text-xs font-semibold text-slate-700">Fecha de compra</label>
                  <input id="purchase-date" type="date" required value={emissionDate} onChange={event => setEmissionDate(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs" />
                </div>
                <div>
                  <label htmlFor="purchase-payment" className="mb-1 block text-xs font-semibold text-slate-700">Forma de pago</label>
                  <select id="purchase-payment" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <option>Transferencia 365</option><option>Efectivo</option><option>Tarjeta</option><option>Cheque</option><option>Crédito</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="purchase-doctype" className="text-xs font-semibold text-slate-700 block mb-1">Tipo de Documento</label>
                  <select
                    id="purchase-doctype"
                    value={docType}
                    onChange={e => setDocType(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value="CCF">Comprobante de Crédito Fiscal (CCF)</option>
                    <option value="FACTURA">Factura Consumidor Final</option>
                    <option value="SUJETO_EXCLUIDO">Factura Sujeto Excluido (DTE-14)</option>
                    <option value="NOTA_CREDITO">Nota de Crédito Proveedor (DTE-05)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="purchase-docnumber" className="text-xs font-semibold text-slate-700 block mb-1">Número de Documento</label>
                  <input
                    id="purchase-docnumber"
                    type="text"
                    required
                    placeholder="Ej. CCF-001920"
                    value={docNumber}
                    onChange={e => setDocNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <label className="block text-xs font-semibold">Seleccionar proveedor de compras anteriores<select aria-label="Proveedor guardado" value="" onChange={e => { const p = suppliers.find(p => p.supplierNit === e.target.value); if (p) { setSupplierName(p.supplierName); setSupplierNit(p.supplierNit); setSupplierNrc(p.supplierNrc || ''); setSupplierDocType(p.supplierNit.replace(/\D/g, '').length === 9 ? 'DUI' : 'NIT'); } }} className="mt-1 w-full rounded-xl border p-2"><option value="">Nuevo proveedor o seleccionar guardado</option>{suppliers.map(p => <option key={p.supplierNit} value={p.supplierNit}>{p.supplierName} · {p.supplierNit}</option>)}</select><span className="mt-1 block font-normal text-slate-500">Los proveedores quedan disponibles al guardar su primera compra.</span></label>
              <div>
                <label htmlFor="purchase-supplier" className="text-xs font-semibold text-slate-700 block mb-1">Nombre del Proveedor</label>
                <input
                  id="purchase-supplier"
                  type="text"
                  required
                  placeholder="Ej. CAESS / Distribuidora de Papel S.A."
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="purchase-idtype" className="block text-xs font-semibold">Documento del proveedor<select id="purchase-idtype" aria-label="Documento del proveedor" value={supplierDocType} onChange={e => { setSupplierDocType(e.target.value as 'NIT' | 'DUI'); setSupplierNit(''); }} className="mb-2 block w-full rounded-xl border p-2"><option>NIT</option><option>DUI</option></select></label>
                  <label htmlFor="purchase-nit" className="text-xs font-semibold text-slate-700 block mb-1">{supplierDocType} Proveedor</label>
                  <input
                    id="purchase-nit"
                    type="text"
                    required
                    placeholder={supplierDocType === 'DUI' ? '00000000-0' : '0614-XXXXXX-XXX-X'}
                    value={supplierNit}
                    onChange={e => setSupplierNit(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="purchase-nrc" className="text-xs font-semibold text-slate-700 block mb-1">NRC Proveedor</label>
                  <input
                    id="purchase-nrc"
                    type="text"
                    placeholder="123456-7"
                    value={supplierNrc}
                    onChange={e => setSupplierNrc(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="purchase-concept" className="text-xs font-semibold text-slate-700 block mb-1">Concepto del Gasto</label>
                <input
                  id="purchase-concept"
                  type="text"
                  required
                  placeholder="Ej. Compra de suministros de oficina o servicio de internet"
                  value={concept}
                  onChange={e => setConcept(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {canClassifyF07 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <F07RentaFields kind="purchase" value={f07Renta} onChange={setF07Renta} />
                <p className="mt-2 text-xs text-slate-600">Puedes completarla después en Libros de IVA, antes de descargar el Anexo 3.</p>
              </div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="purchase-gravadas" className="text-xs font-semibold text-slate-700 block mb-1">Monto Gravado ($)</label>
                  <input
                    id="purchase-gravadas"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={purchasesGravadas}
                    onChange={e => setPurchasesGravadas(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  {docType === 'SUJETO_EXCLUIDO' ? (
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Retención Renta 10% ($)</label>
                      <input
                        type="text"
                        disabled
                        value={`-$${retencionRenta10.toFixed(2)}`}
                        className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-700"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Crédito Fiscal 13% ($)</label>
                      <input
                        type="text"
                        disabled
                        value={`$${creditoFiscal.toFixed(2)}`}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-600"
                      />
                    </div>
                  )}
                </div>
              </div>

              <label className="block text-xs">Compras exentas ($)<input aria-label="Compras exentas ($)" type="number" min="0" step="0.01" value={purchasesExentas} onChange={e => setPurchasesExentas(Number(e.target.value))} className="mt-1 w-full rounded-xl border p-2" /></label>
              <div className="space-y-3 rounded-xl border border-slate-200 p-3 text-xs">
                <button type="button" className="rounded-xl bg-brand-50 px-3 py-2 font-semibold text-brand-800" onClick={async () => { setErrorMessage(''); const check = supplierDocType === 'DUI' ? validateDui(supplierNit) : validateNit(supplierNit); if (!supplierName.trim() || !check.isValid || (supplierNrc && !validateNrc(supplierNrc).isValid)) { setErrorMessage('Completa el nombre y una identificación válida para guardar el proveedor.'); return; } try { await addSupplier({ name: supplierName.trim(), docType: supplierDocType, docNumber: supplierNit.trim(), nrc: supplierNrc.trim() || undefined }); } catch (e) { setErrorMessage(e instanceof Error ? e.message : 'No se pudo guardar el proveedor.'); } }}>Guardar proveedor para próximas compras</button>
                <label className="block">Naturaleza de la compra<select aria-label="Naturaleza de la compra" value={isService ? 'SERVICIO' : 'BIEN'} onChange={e => { setIsService(e.target.value === 'SERVICIO'); setRetainRenta(false); }} className="mt-1 block w-full rounded-lg border p-2"><option value="BIEN">Bien tangible</option><option value="SERVICIO">Servicio</option></select></label>
                {isService && ['CCF', 'SUJETO_EXCLUIDO'].includes(docType) && <label className="flex items-start gap-2"><input type="checkbox" checked={retainRenta} onChange={e => setRetainRenta(e.target.checked)} />Proveedor persona natural domiciliada: aplicar retención ISR 10% sobre el servicio, cuando corresponda.</label>}
                {['CCF', 'NOTA_CREDITO'].includes(docType) && <label className="flex items-start gap-2"><input type="checkbox" checked={retainVat} onChange={e => { setRetainVat(e.target.checked); setPerceiveVat(false); }} />Aplicar retención IVA 1% como agente retenedor (base desde $100).</label>}
                {['CCF', 'NOTA_CREDITO'].includes(docType) && <label className="flex items-start gap-2"><input type="checkbox" checked={perceiveVat} onChange={e => { setPerceiveVat(e.target.checked); setRetainVat(false); }} />El proveedor aplicó percepción IVA 1 % en bienes para reventa (base desde $100).</label>}
                {hasFiscalCredit && perceiveVat && <label className="block">Base de bienes sujeta a percepción ($)<input type="number" min="100" max={purchasesGravadas} step=".01" value={perceptionBase} placeholder={String(purchasesGravadas)} onChange={e => setPerceptionBase(e.target.value)} className="mt-1 block w-full rounded-xl border p-2" /><span className="text-slate-500">Si todos los bienes gravados están sujetos, usa el monto gravado completo.</span></label>}
                {docType === 'SUJETO_EXCLUIDO' && <label className="flex items-start gap-2"><input type="checkbox" checked={retain13} onChange={e => setRetain13(e.target.checked)} />Aplicar retención IVA 13 % únicamente si la operación y la designación como agente lo requieren (Art. 162 C.T.).</label>}
                <p>Renta retenida: <strong>${retencionRenta10.toFixed(2)}</strong> · IVA retenido 1 %: <strong>${retencion1.toFixed(2)}</strong> · IVA percibido: <strong>${percepcion1.toFixed(2)}</strong> · IVA retenido 13 %: <strong>${retencionIva13.toFixed(2)}</strong></p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800">Total a Pagar al Proveedor:</span>
                <span className="font-mono font-extrabold text-base text-slate-900">${totalPagar.toFixed(2)}</span>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-tactile px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/30"
                >
                  {isSaving ? 'Guardando compra…' : 'Guardar Compra'}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
