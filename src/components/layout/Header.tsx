import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Building2, ChevronDown, ShieldCheck, Plus, Sparkles, Search, Zap } from 'lucide-react';
import { NewCompanyModal } from '../companies/NewCompanyModal';

interface HeaderProps {
  onOpenCommand?: () => void;
  onOpenNewCompany?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCommand, onOpenNewCompany }) => {
  const { companies, currentCompany, currentCompanyId, setCurrentCompanyId, setCurrentView, isCloudSyncActive } = useApp();
  const [internalCompanyModalOpen, setInternalCompanyModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const openNewCompany = () => {
    if (onOpenNewCompany) {
      onOpenNewCompany();
    } else {
      setInternalCompanyModalOpen(true);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const safeCompany = currentCompany || (companies.length > 0 ? companies[0] : null);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 text-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        {/* Brand / Logo */}
        <div 
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-xl tracking-tight text-slate-900">
                SIVAR<span className="text-brand-600">CONTA</span>
              </span>
              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
                DTE EL SALVADOR
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Facturación Electrónica MH</p>
          </div>
        </div>

        {/* Center/Middle Section: Command Palette Trigger (satnaing/shadcn-admin feature) */}
        <div className="flex-1 max-w-md mx-2 sm:mx-4 hidden md:block">
          <button
            type="button"
            onClick={onOpenCommand}
            className="w-full flex items-center justify-between bg-slate-100/80 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-all cursor-pointer shadow-2xs active:scale-[0.99]"
            title="Buscar comandos o módulos (Ctrl+K / ⌘K)"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Buscar módulo, emitir DTE o comando...</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 font-mono shrink-0 shadow-2xs">
              {typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent || '') ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </button>
        </div>

        {/* Right Section: Company Switcher + MH Status + CTA */}
        <div className="flex items-center gap-2">
          {/* Mobile Search Button */}
          <button
            type="button"
            onClick={onOpenCommand}
            aria-label="Abrir buscador"
            className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 cursor-pointer active:scale-95"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Company Switcher (Multi-Tenant Selector) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(prev => !prev)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs cursor-pointer transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <Building2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <div className="text-left max-w-[110px] sm:max-w-[180px] truncate">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider leading-none hidden sm:block">
                  Empresa Activa
                </span>
                <span className="font-semibold text-slate-800 truncate block text-xs">
                  {safeCompany ? (safeCompany.tradeName || safeCompany.name) : 'Seleccionar Empresa'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 sm:w-72 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                  Cambiar de Empresa / Cliente
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {companies.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCurrentCompanyId(c.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                        c.id === currentCompanyId
                          ? 'bg-brand-50 text-brand-700 border border-brand-200/70 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <p className="truncate font-medium">{c.tradeName || c.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">NRC: {c.nrc}</p>
                      </div>
                      {c.id === currentCompanyId && (
                        <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0"></span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 mt-2 pt-2 px-1 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      openNewCompany();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/80 transition-all shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Registrar Nueva Empresa</span>
                  </button>
                  <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Modo Despacho Multi-Empresa
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Cloud Sync Status Indicator */}
          <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border ${
            isCloudSyncActive 
              ? 'bg-emerald-50 border-emerald-200/70 text-emerald-700' 
              : 'bg-amber-50 border-amber-200/70 text-amber-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isCloudSyncActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span>{isCloudSyncActive ? 'Nube Conectada' : 'Modo Demo / Local'}</span>
          </div>

          {/* MH Status Indicator (Desktop only) */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>MH {safeCompany?.mhEnvironment || 'PRUEBAS'}</span>
          </div>

          {/* Quick Create Invoice CTA */}
          <button
            onClick={() => setCurrentView('new-invoice')}
            className="hidden sm:flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Emitir DTE</span>
          </button>
        </div>
      </div>

      {/* Internal Modal for creating a new company if not controlled externally */}
      {!onOpenNewCompany && (
        <NewCompanyModal 
          isOpen={internalCompanyModalOpen} 
          onClose={() => setInternalCompanyModalOpen(false)} 
        />
      )}
    </header>
  );
};
