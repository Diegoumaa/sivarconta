import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { CommandMenu } from './components/layout/CommandMenu';
import { NewCompanyModal } from './components/companies/NewCompanyModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { InvoiceList } from './components/billing/InvoiceList';
import { InvoiceBuilder } from './components/billing/InvoiceBuilder';
import { InvoicePreview } from './components/billing/InvoicePreview';
import { CatalogView } from './components/catalog/CatalogView';
import { ClientsView } from './components/clients/ClientsView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { IvaBooksView } from './components/books/IvaBooksView';
import { SettingsView } from './components/settings/SettingsView';
import { Toaster } from 'sonner';

const MainLayout: React.FC = () => {
  const { currentView, activeDtePreview, setActiveDtePreview } = useApp();
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
      {/* Main App Layout (Completely hidden during invoice printing) */}
      <div className={`flex flex-col min-h-screen flex-1 ${activeDtePreview ? 'print:hidden' : ''}`}>
        <Header 
          onOpenCommand={() => setIsCommandOpen(true)}
          onOpenNewCompany={() => setIsCompanyModalOpen(true)}
        />
        
        <div className="flex-1 flex">
          <Sidebar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {renderContent()}
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
        <InvoicePreview
          invoice={activeDtePreview}
          onClose={() => setActiveDtePreview(null)}
        />
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
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}

export default App;
