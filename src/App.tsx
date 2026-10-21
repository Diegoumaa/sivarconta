import React, { lazy, Suspense, useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { CommandMenu } from './components/layout/CommandMenu';
import { NewCompanyModal } from './components/companies/NewCompanyModal';
import { Toaster } from 'sonner';
import { AuthGate } from './components/auth/AuthGate';
import { RouteBoundary, ViewLoading } from './components/layout/RouteBoundary';
import { RefreshCw, Cloud, Monitor } from 'lucide-react';

const DashboardView = lazy(() => import('./components/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const InvoiceList = lazy(() => import('./components/billing/InvoiceList').then(m => ({ default: m.InvoiceList })));
const InvoiceBuilder = lazy(() => import('./components/billing/InvoiceBuilder').then(m => ({ default: m.InvoiceBuilder })));
const InvoicePreview = lazy(() => import('./components/billing/InvoicePreview').then(m => ({ default: m.InvoicePreview })));
const CatalogView = lazy(() => import('./components/catalog/CatalogView').then(m => ({ default: m.CatalogView })));
const ClientsView = lazy(() => import('./components/clients/ClientsView').then(m => ({ default: m.ClientsView })));
const PurchasesView = lazy(() => import('./components/purchases/PurchasesView').then(m => ({ default: m.PurchasesView })));
const IvaBooksView = lazy(() => import('./components/books/IvaBooksView').then(m => ({ default: m.IvaBooksView })));
const SettingsView = lazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));

const MainLayout: React.FC = () => {
  const { currentView, currentCompanyId, activeDtePreview, setActiveDtePreview, dataMode, dataStatus, refreshData } = useApp();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  // Global keyboard shortcut for Command Palette (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const labels: Record<string, string> = { dashboard: 'Inicio', invoices: 'Facturas', 'new-invoice': 'Nueva factura', catalog: 'Productos', clients: 'Clientes', purchases: 'Compras', books: 'Libros de IVA', settings: 'Configuración' };
    document.title = `${labels[currentView]} · SIVARCONTA`;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [currentView, currentCompanyId]);

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'invoices':
        return <InvoiceList />;
      case 'new-invoice':
        return <InvoiceBuilder />;
      case 'catalog':
        return <CatalogView />;
      case 'clients':
        return <ClientsView />;
      case 'purchases':
        return <PurchasesView />;
      case 'books':
        return <IvaBooksView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col font-sans ${activeDtePreview ? 'has-active-modal' : ''}`}>
      <a href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }} className="sr-only focus:not-sr-only focus:p-3 focus:bg-white focus:text-brand-700">Saltar al contenido</a>
      {/* Main App Layout (Completely hidden during invoice printing) */}
      <div className={`flex flex-col min-h-screen flex-1 ${activeDtePreview ? 'print:hidden' : ''}`}>
        <Header 
          onOpenCommand={() => setIsCommandOpen(true)}
          onOpenNewCompany={() => setIsCompanyModalOpen(true)}
        />
        
        <div className="flex-1 flex">
          <Sidebar />
          <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
              <span className="flex items-center gap-2">{dataMode === 'cloud' ? <Cloud className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}{dataMode === 'cloud' ? 'Cuenta de empresa · datos en Supabase' : 'Demostración · datos de ejemplo'}</span>
              {dataMode === 'cloud' && <button disabled={dataStatus === 'loading'} onClick={refreshData} className="min-h-11 flex items-center gap-2 rounded-xl px-3 font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${dataStatus === 'loading' ? 'animate-spin' : ''}`} />Actualizar datos</button>}
            </div>
            {currentView !== 'new-invoice' && <div role="note" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Versión de evaluación.</strong> Borradores sin validez fiscal. Firma y envío a Hacienda pendientes.</div>}
            {dataStatus === 'error' ? <section role="alert" className="rounded-2xl border border-red-200 bg-white p-8"><h1 className="text-xl font-bold text-slate-900">No pudimos cargar tus datos</h1><p className="mt-3 text-slate-600">Revisa la conexión y los permisos de tu cuenta. No podemos mostrar totales hasta recuperar la información completa.</p><button onClick={refreshData} className="mt-5 min-h-11 rounded-xl bg-brand-600 px-5 font-semibold text-white">Volver a intentar</button></section> : dataStatus === 'loading' ? <ViewLoading /> :
              dataMode === 'cloud' && !currentCompanyId ? <section className="rounded-2xl border border-slate-200 bg-white p-8"><h1 className="text-2xl font-bold">Bienvenido a SIVARCONTA</h1><p className="mt-3 max-w-xl text-slate-600">Tu cuenta todavía no tiene empresas asignadas. Registra tu empresa para empezar o pide al propietario que te agregue a su equipo.</p><button onClick={() => setIsCompanyModalOpen(true)} className="mt-5 min-h-12 rounded-xl bg-brand-600 px-5 font-semibold text-white">Registrar mi empresa</button></section> :
              <RouteBoundary key={`${currentCompanyId}:${currentView}`}><Suspense fallback={<ViewLoading />}><div key={currentCompanyId}>{renderContent()}</div></Suspense></RouteBoundary>}
          </main>
        </div>

        <MobileNav />
      </div>

      {/* Global Command Palette (⌘K / Ctrl+K) */}
      <CommandMenu
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onOpenNewCompany={() => setIsCompanyModalOpen(true)}
      />

      {/* Global New Company Registration Modal */}
      <NewCompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
      />

      {/* Global Invoice Preview Modal */}
      {activeDtePreview && (
        <RouteBoundary><Suspense fallback={<ViewLoading />}><InvoicePreview
          invoice={activeDtePreview}
          onClose={() => setActiveDtePreview(null)}
        /></Suspense></RouteBoundary>
      )}

      {/* Toast notifications container */}
      <Toaster 
        position="top-right" 
        richColors 
        closeButton 
        toastOptions={{
          style: {
            borderRadius: '16px',
            fontSize: '13px',
            fontFamily: 'inherit'
          }
        }} 
      />
    </div>
  );
};


export function App() {
  return (
    <AuthGate>{access => (
      <AppProvider key={`${access.mode}:${access.userId || 'demo'}`} demo={access.mode === 'demo'}>
        <MainLayout />
      </AppProvider>
    )}</AuthGate>
  );
}

export default App;
