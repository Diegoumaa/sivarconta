import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DteType, InvoiceDocument } from '../types';

export const VIEW_PATHS = {
  dashboard: '/inicio', invoices: '/facturas', 'new-invoice': '/facturas/nueva',
  catalog: '/productos', clients: '/clientes', purchases: '/compras',
  books: '/libros-iva', settings: '/configuracion'
} as const;
export type AppView = keyof typeof VIEW_PATHS;

export function viewFromHash(hash: string): AppView {
  const path = hash.replace(/^#/, '').split('?')[0].replace(/\/$/, '');
  return (Object.keys(VIEW_PATHS) as AppView[]).find(view => VIEW_PATHS[view] === path) || 'dashboard';
}

interface NavigationState {
  currentView: AppView;
  selectedDteTypeForNew: DteType;
  activeDtePreview: InvoiceDocument | null;
}
interface NavigationActions {
  setCurrentView: (view: string) => void;
  setSelectedDteTypeForNew: (dte: DteType) => void;
  setActiveDtePreview: (doc: InvoiceDocument | null) => void;
  startNewInvoiceWithDte: (dte: DteType) => void;
}
const StateContext = createContext<NavigationState | null>(null);
const ActionsContext = createContext<NavigationActions | null>(null);

/** Hash routes work on static hosts and preserve browser history without server rewrites. */
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setView] = useState<AppView>(() => viewFromHash(window.location.hash));
  const [selectedDteTypeForNew, setSelectedDteTypeForNew] = useState<DteType>('01');
  const [activeDtePreview, setActiveDtePreview] = useState<InvoiceDocument | null>(null);
  const setCurrentView = useCallback((view: string) => {
    const validView: AppView = Object.prototype.hasOwnProperty.call(VIEW_PATHS, view) ? view as AppView : 'dashboard';
    const hash = `#${VIEW_PATHS[validView]}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setView(validView);
    setActiveDtePreview(null);
  }, []);
  useEffect(() => {
    const onHistory = () => { setView(viewFromHash(window.location.hash)); setActiveDtePreview(null); };
    window.addEventListener('popstate', onHistory);
    window.addEventListener('hashchange', onHistory);
    return () => {
      window.removeEventListener('popstate', onHistory);
      window.removeEventListener('hashchange', onHistory);
    };
  }, []);
  const startNewInvoiceWithDte = useCallback((dte: DteType) => {
    setSelectedDteTypeForNew(dte);
    setCurrentView('new-invoice');
  }, [setCurrentView]);
  const actions = useMemo(() => ({ setCurrentView, setSelectedDteTypeForNew, setActiveDtePreview, startNewInvoiceWithDte }), [setCurrentView, startNewInvoiceWithDte]);
  const state = useMemo(() => ({ currentView, selectedDteTypeForNew, activeDtePreview }), [currentView, selectedDteTypeForNew, activeDtePreview]);
  return <ActionsContext.Provider value={actions}><StateContext.Provider value={state}>{children}</StateContext.Provider></ActionsContext.Provider>;
}
export function useNavigationActions() {
  const value = useContext(ActionsContext);
  if (!value) throw new Error('NavigationProvider is required');
  return value;
}
export function useNavigation() {
  const state = useContext(StateContext);
  const actions = useNavigationActions();
  if (!state) throw new Error('NavigationProvider is required');
  return { ...state, ...actions };
}
