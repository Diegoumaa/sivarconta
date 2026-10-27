import React from 'react';
import { useApp } from '../../context/AppContext';
import { AppLink } from './AppLink';
import type { AppView } from '../../context/NavigationContext';
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
  const { currentView, setCurrentView, dataMode } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, badge: null },
    { id: 'invoices', label: 'Facturas', icon: Receipt, badge: null },
    { id: 'catalog', label: 'Productos y servicios', icon: Package, badge: null },
    { id: 'clients', label: 'Clientes', icon: Users, badge: null },
    { id: 'purchases', label: 'Compras y gastos', icon: ShoppingBag, badge: null },
    { id: 'books', label: 'Libros de IVA', icon: BookOpen, badge: null },
    { id: 'settings', label: 'Configuración', icon: Settings, badge: null }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between hidden md:flex shrink-0 min-h-[calc(100vh-61px)] shadow-[1px_0_2px_rgba(0,0,0,0.01)]">
      <div className="p-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
            Gestión Empresarial
          </div>
          <nav aria-label="Navegación principal" className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id || (item.id === 'invoices' && currentView === 'new-invoice');
              return (
                <AppLink
                  key={item.id}
                  view={item.id as AppView}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-3 min-h-11 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.98] cursor-pointer group ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-600 rounded-l-none pl-2.5 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? 'text-brand-600' : 'text-slate-600 group-hover:text-slate-600'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium transition-colors ${
                      isActive ? 'bg-white text-slate-800 border border-slate-200/80 shadow-2xs' : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </AppLink>
              );
            })}
          </nav>
        </div>

        {/* Informative card about MH DTE */}
        <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-slate-600 text-xs">
          <div className="flex items-center gap-2 text-brand-600 font-semibold mb-1">
            <FileCheck2 className="w-[18px] h-[18px]" />
            <span>Normativa DGII El Salvador</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Preparación de documentos de prueba. Firma digital, envío y certificación fiscal pendientes de integración.
          </p>
        </div>
      </div>

      {/* User footer */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-blue-600 flex items-center justify-center font-bold text-xs text-white shadow-xs">
            DE
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-slate-800 truncate">{dataMode === 'cloud' ? 'Cuenta de empresa' : 'Sesión de demostración'}</p>
            <p className="text-xs text-slate-500 truncate">{dataMode === 'cloud' ? 'Permisos sujetos a la base de datos' : 'Datos de ejemplo en este navegador'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
