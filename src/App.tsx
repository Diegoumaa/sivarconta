import React, { lazy, Suspense, useSyncExternalStore } from 'react';
import { SuiteHome, type SuitePage } from './components/suite/SuiteHome';
import { RouteBoundary, ViewLoading } from './components/layout/RouteBoundary';

const BillingApp = lazy(() => import('./BillingApp'));

export function suitePageFromLocation(hash: string, search = ''): SuitePage | null {
  // Auth callbacks must reach Supabase even when they return to the site root.
  const params = new URLSearchParams(search);
  if (params.has('code') || params.has('token_hash') || /access_token=|refresh_token=|type=recovery|error_description=/.test(hash)) return null;
  const path = hash.replace(/^#/, '').split('?')[0].replace(/\/$/, '');
  if (!path || path === '/suite') return 'home';
  if (path === '/modulos') return 'modules';
  if (path === '/ayuda') return 'help';
  return null;
}

function subscribeLocation(callback: () => void) {
  window.addEventListener('hashchange', callback);
  window.addEventListener('popstate', callback);
  return () => {
    window.removeEventListener('hashchange', callback);
    window.removeEventListener('popstate', callback);
  };
}
const locationSnapshot = () => window.location.hash + '\n' + window.location.search;

export function App() {
  useSyncExternalStore(subscribeLocation, locationSnapshot);
  const page = suitePageFromLocation(window.location.hash, window.location.search);
  return page ? <SuiteHome page={page} /> : (
    <RouteBoundary><Suspense fallback={<ViewLoading />}><BillingApp /></Suspense></RouteBoundary>
  );
}

export default App;
