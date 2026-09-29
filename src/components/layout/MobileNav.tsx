import React from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutDashboard, Receipt, Package, Users, BookOpen } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { currentView, setCurrentView } = useApp();

  const items = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'invoices', label: 'Facturas', icon: Receipt },
    { id: 'catalog', label: 'Catálogo', icon: Package },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'books', label: 'Libros IVA', icon: BookOpen }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-pb">
      {items.map(item => {
        const Icon = item.icon;
        const isActive = currentView === item.id || (item.id === 'invoices' && currentView === 'new-invoice');
        return (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
              isActive ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px] scale-110' : ''}`} />
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
