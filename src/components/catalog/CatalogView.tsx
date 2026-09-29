import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { Package, Plus, Search, Tag, DollarSign, X } from 'lucide-react';

export const CatalogView: React.FC = () => {
  const { filteredProducts, addProduct } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // New product form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [taxType, setTaxType] = useState<'GRAVADO' | 'EXENTO' | 'NO_SUJETO'>('GRAVADO');
  const [unitOfMeasure, setUnitOfMeasure] = useState('59');
  const [category, setCategory] = useState('General');

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

  const filtered = filteredProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || unitPrice <= 0) return;

    addProduct({
      code: code || `SKU-${Date.now().toString().slice(-4)}`,
      name,
      description,
      unitPrice,
      taxType,
      unitOfMeasure,
      category
    });

    // Reset & close
    setCode('');
    setName('');
    setDescription('');
    setUnitPrice(0);
    setShowModal(false);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Catálogo de Productos & Servicios
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administra tu inventario, tarifas y tipos de gravamen según catálogos del MH
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-tactile flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Producto / Servicio</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, nombre o categoría..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>

      {/* Empty State vs Grid of Products */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 mx-auto flex items-center justify-center border border-slate-200">
            {searchTerm ? <Search className="w-6 h-6 text-slate-400" /> : <Package className="w-7 h-7 text-cyan-600" />}
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
              {searchTerm ? 'No se encontraron productos coincidentes' : 'Catálogo de Productos Vacío'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {searchTerm 
                ? `No hay ningún producto o servicio que coincida con "${searchTerm}".`
                : 'Define los bienes y servicios que comercializas con sus precios unitarios, gravamen (IVA 13%, Exento o No Sujeto) y unidades de medida.'}
            </p>
          </div>
          {searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="btn-tactile px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
            >
              Limpiar búsqueda
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="btn-tactile px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/20 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar Primer Producto</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div
              key={p.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {p.code}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    p.taxType === 'GRAVADO'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {p.taxType} (IVA 13%)
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  {p.category} • {p.unitOfMeasure === '59' ? 'Unidad' : 'Servicio'}
                </span>
                <span className="text-lg font-extrabold font-mono text-slate-900 tabular-nums">
                  ${p.unitPrice.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal New Product */}
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
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                      Agregar al Catálogo
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                      Ítem DTE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tarifas, gravámenes de IVA y códigos según normativa DGII
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="catalog-code" className="text-xs font-semibold text-slate-700 block mb-1">Código / SKU</label>
                  <input
                    id="catalog-code"
                    type="text"
                    required
                    placeholder="Ej. PROD-001"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="catalog-category" className="text-xs font-semibold text-slate-700 block mb-1">Categoría</label>
                  <input
                    id="catalog-category"
                    type="text"
                    placeholder="Ej. Servicios / Hardware"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="catalog-name" className="text-xs font-semibold text-slate-700 block mb-1">Nombre del Producto / Servicio</label>
                <input
                  id="catalog-name"
                  type="text"
                  required
                  placeholder="Ej. Asesoría Contable Mensual"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label htmlFor="catalog-description" className="text-xs font-semibold text-slate-700 block mb-1">Descripción Detallada</label>
                <textarea
                  id="catalog-description"
                  rows={2}
                  placeholder="Descripción que se reflejará en la factura"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="catalog-price" className="text-xs font-semibold text-slate-700 block mb-1">Precio Unitario ($)</label>
                  <input
                    id="catalog-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={unitPrice}
                    onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="catalog-taxtype" className="text-xs font-semibold text-slate-700 block mb-1">Tipo Gravamen</label>
                  <select
                    id="catalog-taxtype"
                    value={taxType}
                    onChange={e => setTaxType(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value="GRAVADO">Gravado (13%)</option>
                    <option value="EXENTO">Exento</option>
                    <option value="NO_SUJETO">No Sujeto</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="catalog-uom" className="text-xs font-semibold text-slate-700 block mb-1">Unidad (CAT-015)</label>
                  <select
                    id="catalog-uom"
                    value={unitOfMeasure}
                    onChange={e => setUnitOfMeasure(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value="59">59 - Unidad</option>
                    <option value="99">99 - Servicio</option>
                    <option value="23">23 - Metro</option>
                    <option value="42">42 - Kilo</option>
                  </select>
                </div>
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
                  Guardar Producto
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
