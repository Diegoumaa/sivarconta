import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PurchaseDocument } from '../../types';
import { ShoppingBag, Plus, Search, FileText, X } from 'lucide-react';

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

  const filtered = filteredPurchases.filter(p =>
    p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.docNumber.includes(searchTerm) ||
    p.concept.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const creditoFiscal = Number((purchasesGravadas * 0.13).toFixed(2));
  const totalPagar = Number((purchasesGravadas + creditoFiscal).toFixed(2));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName || purchasesGravadas <= 0) return;

    addPurchase({
      docType,
      docNumber,
      emissionDate: new Date().toISOString().split('T')[0],
      supplierName,
      supplierNit,
      supplierNrc: supplierNrc || undefined,
      concept,
      purchasesGravadas,
      purchasesExentas: 0,
      creditoFiscal,
      retencion1: 0,
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
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-600/30 transition-all active:scale-95"
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
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-slate-900 block">{p.docNumber}</span>
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
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                    ${p.purchasesGravadas.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                    +${p.creditoFiscal.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                    ${p.totalPagar.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Sincronizado
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Purchase */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-brand-600" />
                <h3 className="font-extrabold text-slate-900">Registrar Compra / Factura Recibida</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Tipo de Documento</label>
                  <select
                    value={docType}
                    onChange={e => setDocType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                  >
                    <option value="CCF">Comprobante de Crédito Fiscal (CCF)</option>
                    <option value="FACTURA">Factura Consumidor Final</option>
                    <option value="SUJETO_EXCLUIDO">Factura Sujeto Excluido</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Número de Documento</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. CCF-001920"
                    value={docNumber}
                    onChange={e => setDocNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nombre del Proveedor</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. CAESS / Distribuidora de Papel S.A."
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">NIT Proveedor</label>
                  <input
                    type="text"
                    required
                    placeholder="0614-XXXXXX-XXX-X"
                    value={supplierNit}
                    onChange={e => setSupplierNit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">NRC Proveedor</label>
                  <input
                    type="text"
                    placeholder="123456-7"
                    value={supplierNrc}
                    onChange={e => setSupplierNrc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Concepto del Gasto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Compra de suministros de oficina o servicio de internet"
                  value={concept}
                  onChange={e => setConcept(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Monto Gravado ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={purchasesGravadas}
                    onChange={e => setPurchasesGravadas(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Crédito Fiscal 13% ($)</label>
                  <input
                    type="text"
                    disabled
                    value={`$${creditoFiscal.toFixed(2)}`}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-600"
                  />
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
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/30"
                >
                  Guardar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
