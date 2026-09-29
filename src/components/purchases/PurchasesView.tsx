import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { PurchaseDocument } from '../../types';
import { ShoppingBag, Plus, Search, FileText, X, AlertCircle, Copy } from 'lucide-react';
import { validateNit, validateNrc } from '../../utils/svTaxValidators';
import { copyToClipboard } from '../../utils/clipboard';
import { toast } from 'sonner';

export const PurchasesView: React.FC = () => {
  const { filteredPurchases, addPurchase } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [supplierName, setSupplierName] = useState('');
  const [supplierNit, setSupplierNit] = useState('');
  const [supplierNrc, setSupplierNrc] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [docType, setDocType] = useState<'CCF' | 'FACTURA' | 'SUJETO_EXCLUIDO' | 'NOTA_CREDITO'>('CCF');
  const [concept, setConcept] = useState('');
  const [purchasesGravadas, setPurchasesGravadas] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Transferencia 365');
  const [errorMessage, setErrorMessage] = useState('');

  // Lock body scroll and handle ESC key when modal is open
  useEffect(() => {
    if (!showModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal]);

  const filtered = filteredPurchases.filter(p =>
    p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.docNumber.includes(searchTerm) ||
    p.concept.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Tax calculations per El Salvador DGII regulations:
  // - CCF & NOTA_CREDITO: 13% IVA Crédito Fiscal
  // - FACTURA: Consumidor final invoice does not break down tax credit for buyer (0%)
  // - SUJETO_EXCLUIDO: 0% IVA, but 10% Retención de Impuesto sobre la Renta withheld
  const creditoFiscal = docType === 'CCF' || docType === 'NOTA_CREDITO'
    ? Number((purchasesGravadas * 0.13).toFixed(2))
    : 0;

  const retencionRenta10 = docType === 'SUJETO_EXCLUIDO'
    ? Number((purchasesGravadas * 0.10).toFixed(2))
    : 0;

  const totalPagar = docType === 'SUJETO_EXCLUIDO'
    ? Number((purchasesGravadas - retencionRenta10).toFixed(2))
    : docType === 'FACTURA'
    ? Number(purchasesGravadas.toFixed(2))
    : Number((purchasesGravadas + creditoFiscal).toFixed(2));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!supplierName.trim() || purchasesGravadas <= 0) {
      setErrorMessage('Por favor ingrese el nombre del proveedor y un monto gravado mayor a $0.00.');
      return;
    }

    if (supplierNit.trim()) {
      const nitRes = validateNit(supplierNit.trim());
      if (!nitRes.isValid) {
        setErrorMessage(nitRes.error || 'El NIT del proveedor es inválido.');
        return;
      }
    }

    if (supplierNrc.trim()) {
      const nrcRes = validateNrc(supplierNrc.trim());
      if (!nrcRes.isValid) {
        setErrorMessage(nrcRes.error || 'El NRC del proveedor es inválido.');
        return;
      }
    }

    addPurchase({
      docType,
      docNumber: docNumber.trim(),
      emissionDate: new Date().toISOString().split('T')[0],
      supplierName: supplierName.trim(),
      supplierNit: supplierNit.trim(),
      supplierNrc: supplierNrc.trim() || undefined,
      concept: concept.trim() || 'Compra de mercadería / gasto operativo',
      purchasesGravadas,
      purchasesExentas: 0,
      creditoFiscal,
      retencion1: 0,
      retencionRenta10: retencionRenta10 > 0 ? retencionRenta10 : undefined,
      totalPagar,
      paymentMethod
    });

    // Reset & close
    setSupplierName('');
    setSupplierNit('');
    setSupplierNrc('');
    setDocNumber('');
    setConcept('');
    setPurchasesGravadas(0);
    setErrorMessage('');
    setShowModal(false);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Módulo de Compras & Gastos
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor o # documento..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
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
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center animate-in fade-in duration-150 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95 duration-150"
          >
            {/* Executive Dark Header */}
            <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                      Registrar Compra / Factura Recibida
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                      Crédito Fiscal
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Comprobante tributario recibido para deducción en F07
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-slate-900">
              {errorMessage && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

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
                  <label htmlFor="purchase-nit" className="text-xs font-semibold text-slate-700 block mb-1">NIT Proveedor</label>
                  <input
                    id="purchase-nit"
                    type="text"
                    required
                    placeholder="0614-XXXXXX-XXX-X"
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

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800">Total a Pagar al Proveedor:</span>
                <span className="font-mono font-extrabold text-base text-slate-900">${totalPagar.toFixed(2)}</span>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-tactile px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/30"
                >
                  Guardar Compra
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
