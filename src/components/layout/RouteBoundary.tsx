import React from 'react';

export function ViewLoading() {
  return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-700">
    <span className="mb-4 block h-2 w-28 rounded-full bg-brand-100 motion-safe:animate-pulse" aria-hidden="true" />
    Cargando tu espacio de trabajo…
  </div>;
}

export class RouteBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="rounded-2xl border border-slate-200 bg-white p-8">
      <h1 className="text-xl font-bold">No pudimos abrir esta sección</h1>
      <p className="mt-3 text-slate-600">Puede haberse publicado una nueva versión o interrumpido la conexión. Recarga la página para intentarlo de nuevo.</p>
      <button onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-xl bg-brand-600 px-5 font-semibold text-white">Recargar página</button>
    </section>;
  }
}
