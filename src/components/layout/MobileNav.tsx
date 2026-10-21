import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { LayoutDashboard, Receipt, Package, Users, BookOpen, ShoppingBag, Settings, Menu } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { currentView, setCurrentView } = useNavigation();
  const [showMore, setShowMore] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const extras = [
    { id: 'catalog', label: 'Catálogo', icon: Package },
    { id: 'purchases', label: 'Compras', icon: ShoppingBag },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];
  useEffect(() => {
    if (!showMore) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setShowMore(false); moreRef.current?.focus(); } };
    const outside = (event: MouseEvent) => { if (!navRef.current?.contains(event.target as Node)) setShowMore(false); };
    document.addEventListener('keydown', key);
    document.addEventListener('mousedown', outside);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', outside); };
  }, [showMore]);

  const items = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'invoices', label: 'Facturas', icon: Receipt },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'books', label: 'Libros IVA', icon: BookOpen }
  ];

  return (
    <nav ref={navRef} aria-label="Navegación móvil" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around shadow-lg safe-area-pb">
      {items.map(item => {
        const Icon = item.icon;
        const isActive = currentView === item.id || (item.id === 'invoices' && currentView === 'new-invoice');
        return (
          <button
            key={item.id}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => { setShowMore(false); setCurrentView(item.id); }}
            className={`min-h-12 min-w-12 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
              isActive ? 'text-brand-700 font-bold' : 'text-slate-600 hover:text-slate-700'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px] scale-110' : ''}`} />
            <span className="text-[11px] mt-0.5">{item.label}</span>
          </button>
        );
      })}
      <button ref={moreRef} aria-label="Más módulos" aria-expanded={showMore} aria-controls="mobile-more" onClick={() => setShowMore(value => !value)} className={`min-h-12 min-w-12 flex flex-col items-center justify-center rounded-xl ${extras.some(item => item.id === currentView) ? 'text-brand-700 font-bold' : 'text-slate-600'}`}><Menu className="w-5 h-5" /><span className="text-[11px] mt-0.5">Más</span></button>
      {showMore && <div id="mobile-more" className="absolute bottom-full right-3 mb-2 w-64 p-2 rounded-2xl border border-slate-200 bg-white shadow-xl">
        {extras.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => { setShowMore(false); setCurrentView(item.id); }} className="w-full min-h-12 flex items-center gap-3 px-3 rounded-xl text-sm text-slate-700 hover:bg-slate-100"><Icon className="w-5 h-5" />{item.label}</button>; })}
      </div>}
    </nav>
  );
};
