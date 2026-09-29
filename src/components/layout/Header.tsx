import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Building2, ChevronDown, ShieldCheck, Plus, Sparkles } from 'lucide-react';
import { NewCompanyModal } from '../companies/NewCompanyModal';

export const Header: React.FC = () => {
  const { companies, currentCompany, currentCompanyId, setCurrentCompanyId, setCurrentView, isCloudSyncActive } = useApp();
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white px-3 sm:px-6 py-2.5 sm:py-3 shadow-md">
      <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        {/* Brand / Logo */}
        <div 
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center font-bold text-base sm:text-xl text-white shadow-md shadow-brand-500/20">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                SIVAR<span className="text-cyan-400">CONTA</span>
              </span>
              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                DTE EL SALVADOR
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Facturación Electrónica MH</p>
          </div>
        </div>

        {/* Right Section: Company Switcher + MH Status + CTA */}
        <div className="flex items-center gap-2">
          {/* Company Switcher (Multi-Tenant Selector) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(prev => !prev)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs cursor-pointer transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            >
              <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="text-left max-w-[110px] sm:max-w-[200px] truncate">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider leading-none hidden sm:block">
                  Empresa Activa
                </span>
                <span className="font-semibold text-slate-100 truncate block text-xs">
                  {safeCompany ? (safeCompany.tradeName || safeCompany.name) : 'Seleccionar Empresa'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 sm:w-72 bg-slate-850 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
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
                          ? 'bg-brand-600/30 text-cyan-300 border border-brand-500/40 font-semibold'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <p className="truncate font-medium">{c.tradeName || c.name}</p>
                        <p className="text-[10px] text-slate-400">NRC: {c.nrc}</p>
                      </div>
                      {c.id === currentCompanyId && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-800 mt-2 pt-2 px-1 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsCompanyModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Registrar Nueva Empresa</span>
                  </button>
                  <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Modo Despacho Multi-Empresa
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Cloud Sync Status Indicator */}
          <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border ${
            isCloudSyncActive 
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300' 
              : 'bg-amber-950/60 border-amber-800/60 text-amber-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isCloudSyncActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span>{isCloudSyncActive ? 'Nube Conectada' : 'Modo Demo / Local'}</span>
          </div>

          {/* MH Status Indicator (Desktop only) */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-800/50 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>MH {safeCompany?.mhEnvironment || 'PRUEBAS'}</span>
          </div>

          {/* Quick Create Invoice CTA (Desktop only - on mobile bottom nav handles it) */}
          <button
            onClick={() => setCurrentView('new-invoice')}
            className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Emitir DTE</span>
          </button>
        </div>
      </div>

      {/* Modal for creating a new company */}
      <NewCompanyModal 
        isOpen={isCompanyModalOpen} 
        onClose={() => setIsCompanyModalOpen(false)} 
      />
    </header>
  );
};
