import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Building2, Check, ChevronDown, Plus, Search, Receipt, LayoutGrid } from 'lucide-react';
import { NewCompanyModal } from '../companies/NewCompanyModal';

interface HeaderProps { onOpenCommand?: () => void; onOpenNewCompany?: () => void; }
export const Header: React.FC<HeaderProps> = ({ onOpenCommand, onOpenNewCompany }) => {
  const { companies, currentCompany, currentCompanyId, setCurrentCompanyId, setCurrentView } = useApp();
  const [internalCompanyModalOpen, setInternalCompanyModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isDropdownOpen) return;
    const outside = (event: MouseEvent) => { if (!dropdownRef.current?.contains(event.target as Node)) setIsDropdownOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setIsDropdownOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', key); };
  }, [isDropdownOpen]);
  return <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
      <button type="button" onClick={() => setCurrentView('dashboard')} aria-label="SIVAR FACT · Inicio" className="mr-auto flex min-h-11 items-center gap-2.5 rounded-xl text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><Receipt className="h-5 w-5" /></span>
        <span className="text-lg font-extrabold tracking-tight text-slate-900">SIVAR<span className="text-brand-600">FACT</span><span className="block text-xs font-medium tracking-normal text-slate-600">Tu negocio, en orden</span></span>
      </button>
      <a href="#/suite" aria-label="Volver a SIVAR SUITE" className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100"><LayoutGrid className="h-4 w-4" /><span className="hidden lg:inline">Suite</span></a>
      <button type="button" onClick={onOpenCommand} aria-label="Abrir buscador" title="Buscar (Ctrl+K)" className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
        <Search className="h-4 w-4" /><span className="hidden xl:inline">Buscar</span><kbd className="hidden xl:inline text-xs">Ctrl K</kbd>
      </button>
      <div ref={dropdownRef} className="relative order-last w-full sm:order-none sm:w-auto">
        <button ref={triggerRef} type="button" onClick={() => setIsDropdownOpen(value => !value)} aria-expanded={isDropdownOpen} aria-controls="company-choices" className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm sm:w-auto">
          <Building2 className="h-4 w-4 shrink-0 text-brand-700" /><span className="max-w-[240px] truncate font-semibold text-slate-800 sm:max-w-[180px]">{currentCompany.tradeName || currentCompany.name || 'Seleccionar empresa'}</span><ChevronDown className="ml-auto h-4 w-4 text-slate-600" />
        </button>
        {isDropdownOpen && <div id="company-choices" className="absolute right-0 z-50 mt-2 w-full min-w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl sm:w-80">
          <p className="border-b border-slate-100 px-3 py-3 text-sm font-semibold text-slate-600">Cambiar de Empresa / Cliente</p>
          <div className="max-h-64 overflow-y-auto">{companies.map(company => <button key={company.id} type="button" onClick={() => { setCurrentCompanyId(company.id); setIsDropdownOpen(false); triggerRef.current?.focus(); }} aria-pressed={company.id === currentCompanyId} className="flex min-h-14 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-800 hover:bg-brand-50">
            <span className="min-w-0"><span className="block truncate font-semibold">{company.tradeName || company.name}</span><span className="text-xs text-slate-600">NRC: {company.nrc}</span></span>{company.id === currentCompanyId && <Check className="h-4 w-4 shrink-0 text-brand-700" />}
          </button>)}</div>
          <button type="button" onClick={() => { setIsDropdownOpen(false); if (onOpenNewCompany) onOpenNewCompany(); else setInternalCompanyModalOpen(true); }} className="mt-2 min-h-11 w-full rounded-xl bg-brand-50 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100">+ Registrar Nueva Empresa</button>
        </div>}
      </div>
      <button type="button" onClick={() => setCurrentView('new-invoice')} className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 font-semibold text-white hover:bg-brand-700 sm:px-4"><Plus className="h-5 w-5" /><span className="sr-only sm:not-sr-only text-sm">Nueva factura</span></button>
    </div>
    {!onOpenNewCompany && <NewCompanyModal isOpen={internalCompanyModalOpen} onClose={() => setInternalCompanyModalOpen(false)} />}
  </header>;
};
