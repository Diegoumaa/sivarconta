import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Search, 
  LayoutDashboard, 
  Receipt, 
  Package, 
  Users, 
  ShoppingBag, 
  BookOpen, 
  Settings, 
  PlusCircle, 
  Building2, 
  ArrowRight, 
  X,
  FileText,
  CornerDownLeft
} from 'lucide-react';
import { DteType } from '../../types';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewCompany?: () => void;
}

export const CommandMenu: React.FC<CommandMenuProps> = ({ isOpen, onClose, onOpenNewCompany }) => {
  const { 
    companies, 
    currentCompanyId, 
    setCurrentCompanyId, 
    setCurrentView, 
    startNewInvoiceWithDte 
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Define commands
  const navigationItems = [
    { id: 'nav-dashboard', label: 'Dashboard Fiscal', category: 'Navegación', icon: LayoutDashboard, action: () => { setCurrentView('dashboard'); onClose(); } },
    { id: 'nav-invoices', label: 'Facturación DTE (Listado)', category: 'Navegación', icon: Receipt, action: () => { setCurrentView('invoices'); onClose(); } },
    { id: 'nav-catalog', label: 'Catálogo de Productos y Servicios', category: 'Navegación', icon: Package, action: () => { setCurrentView('catalog'); onClose(); } },
    { id: 'nav-clients', label: 'Directorio de Clientes y Receptores', category: 'Navegación', icon: Users, action: () => { setCurrentView('clients'); onClose(); } },
    { id: 'nav-purchases', label: 'Módulo de Compras y Gastos', category: 'Navegación', icon: ShoppingBag, action: () => { setCurrentView('purchases'); onClose(); } },
    { id: 'nav-books', label: 'Libros de IVA Oficiales (F07)', category: 'Navegación', icon: BookOpen, action: () => { setCurrentView('books'); onClose(); } },
    { id: 'nav-settings', label: 'Configuración Fiscal & MH', category: 'Navegación', icon: Settings, action: () => { setCurrentView('settings'); onClose(); } }
  ];

  const quickActionItems = [
    { id: 'act-dte-01', label: 'Emitir Factura Consumidor Final (DTE-01)', category: 'Acciones DTE', icon: Receipt, action: () => { startNewInvoiceWithDte('01'); onClose(); } },
    { id: 'act-dte-03', label: 'Emitir Comprobante Crédito Fiscal (DTE-03)', category: 'Acciones DTE', icon: FileText, action: () => { startNewInvoiceWithDte('03'); onClose(); } },
    { id: 'act-dte-14', label: 'Emitir Sujeto Excluido (DTE-14)', category: 'Acciones DTE', icon: Receipt, action: () => { startNewInvoiceWithDte('14'); onClose(); } },
    { id: 'act-dte-05', label: 'Emitir Nota de Crédito (DTE-05)', category: 'Acciones DTE', icon: Receipt, action: () => { startNewInvoiceWithDte('05'); onClose(); } },
    { id: 'act-dte-06', label: 'Emitir Nota de Débito (DTE-06)', category: 'Acciones DTE', icon: Receipt, action: () => { startNewInvoiceWithDte('06'); onClose(); } },
    { id: 'act-new-client', label: 'Registrar Nuevo Cliente', category: 'Acciones Rápidas', icon: Users, action: () => { setCurrentView('clients'); onClose(); } },
    { id: 'act-new-product', label: 'Agregar Producto al Catálogo', category: 'Acciones Rápidas', icon: Package, action: () => { setCurrentView('catalog'); onClose(); } },
    { id: 'act-new-purchase', label: 'Registrar Compra / Gasto', category: 'Acciones Rápidas', icon: ShoppingBag, action: () => { setCurrentView('purchases'); onClose(); } },
    { id: 'act-new-company', label: 'Registrar Nueva Empresa (Multi-Tenant)', category: 'Acciones Rápidas', icon: Building2, action: () => { onClose(); if (onOpenNewCompany) onOpenNewCompany(); else setCurrentView('settings'); } }
  ];

  const companyItems = companies.map(c => ({
    id: `comp-${c.id}`,
    label: `Cambiar a: ${c.tradeName || c.name} (NRC: ${c.nrc})`,
    category: 'Empresas',
    icon: Building2,
    action: () => {
      setCurrentCompanyId(c.id);
      onClose();
    }
  }));

  const allItems = [...navigationItems, ...quickActionItems, ...companyItems];

  const filteredItems = query.trim() === ''
    ? allItems
    : allItems.filter(item => 
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      );

  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside menu
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de Comandos"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in duration-150"
    >
      <div 
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[75vh]"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 bg-white gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Escribe un comando, vista o acción (ej. Factura, Cliente, F07)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          {query && (
            <button 
              type="button"
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div role="listbox" aria-label="Lista de comandos" className="overflow-y-auto p-2 divide-y divide-slate-100/50">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              No se encontraron comandos para &ldquo;<span className="text-slate-700 font-semibold">{query}</span>&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  ref={el => { itemRefs.current[idx] = el; }}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    isSelected 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate mr-2">
                    <span className={`p-1.5 rounded-lg ${
                      isSelected ? 'bg-slate-800 text-cyan-300' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="truncate">
                      <p className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {item.label}
                      </p>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${
                        isSelected ? 'text-slate-300' : 'text-slate-400'
                      }`}>
                        {item.category}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="hidden sm:flex items-center gap-1 text-[10px] text-cyan-300 font-mono">
                      <span>Seleccionar</span>
                      <CornerDownLeft className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Command Palette Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[9px] text-slate-600">↑↓</kbd>
              <span>Navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[9px] text-slate-600">↵</kbd>
              <span>Ejecutar</span>
            </span>
          </div>
          <span className="font-semibold text-slate-500">SIVARCONTA v1.0 • Command</span>
        </div>
      </div>
    </div>
  );
};
