import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, 
  Receipt, 
  Package, 
  Users, 
  ShoppingBag, 
  BookOpen, 
  Settings,
  FileCheck2
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard Fiscal', icon: LayoutDashboard, badge: null },
    { id: 'invoices', label: 'Facturación DTE', icon: Receipt, badge: '5 Tipos' },
    { id: 'catalog', label: 'Catálogo Productos', icon: Package, badge: null },
    { id: 'clients', label: 'Directorio Clientes', icon: Users, badge: null },
    { id: 'purchases', label: 'Módulo Compras', icon: ShoppingBag, badge: null },
    { id: 'books', label: 'Libros de IVA (F07)', icon: BookOpen, badge: 'Oficial' },
    { id: 'settings', label: 'Configuración MH', icon: Settings, badge: null }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-col justify-between hidden md:flex shrink-0 min-h-[calc(100vh-61px)]">
      <div className="p-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Gestión Empresarial
          </div>
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id || (item.id === 'invoices' && currentView === 'new-invoice');
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-cyan-400 border border-slate-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Informative card about MH DTE */}
        <div className="p-3 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-850 border border-slate-700/60 text-slate-300 text-xs">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-1">
            <FileCheck2 className="w-4 h-4" />
            <span>Normativa DGII El Salvador</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Esquema oficial JSON v3 con firmado JWS y timbrado digital. Certificación de documentos tributarios.
          </p>
        </div>
      </div>

      {/* User footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-brand-500 flex items-center justify-center font-bold text-xs text-white">
            DU
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-slate-200 truncate">Diego Umaña</p>
            <p className="text-[10px] text-slate-400 truncate">Administrador Técnico</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
