import React, { lazy, Suspense, useSyncExternalStore } from 'react';
import { SuiteHome, type SuitePage } from './components/suite/SuiteHome';
import { RouteBoundary, ViewLoading } from './components/layout/RouteBoundary';
import { captureRecoveryLink } from './utils/authRecovery';

const BillingApp = lazy(() => import('./BillingApp'));
const TeamInvitationPage = lazy(() => import('./components/auth/TeamInvitationPage'));
const PasswordRecoveryPage = lazy(() => import('./components/auth/PasswordRecoveryPage'));

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
  const changed = () => { captureRecoveryLink(); callback(); };
  window.addEventListener('hashchange', changed);
  window.addEventListener('popstate', changed);
  return () => {
    window.removeEventListener('hashchange', changed);
    window.removeEventListener('popstate', changed);
  };
}
const locationSnapshot = () => window.location.hash + '\n' + window.location.search;

export function App() {
  useSyncExternalStore(subscribeLocation, locationSnapshot);
  if (window.location.hash === '#/recuperar') {
    return <RouteBoundary><Suspense fallback={<ViewLoading />}><PasswordRecoveryPage /></Suspense></RouteBoundary>;
  }
  if (/^#\/invitacion(?:\?|$)/.test(window.location.hash)) {
    const search = window.location.hash.split('?')[1] || '';
    return <RouteBoundary><Suspense fallback={<ViewLoading />}><TeamInvitationPage search={search} /></Suspense></RouteBoundary>;
  }
  const page = suitePageFromLocation(window.location.hash, window.location.search);
  return page ? <SuiteHome page={page} /> : (
    <RouteBoundary><Suspense fallback={<ViewLoading />}><BillingApp /></Suspense></RouteBoundary>
  );
}

export default App;
