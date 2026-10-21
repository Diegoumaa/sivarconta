import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
vi.mock('../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

describe('Application routes', () => {
  beforeEach(() => localStorage.clear());
  it('shows a clear first action and all primary sections', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Así va tu negocio' })).toBeInTheDocument();
    const navigation = within(screen.getByRole('navigation', { name: 'Navegación principal' }));
    for (const name of ['Inicio','Facturas','Productos y servicios','Clientes','Compras y gastos','Libros de IVA','Configuración']) {
      expect(navigation.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(screen.getByRole('region', { name: 'Acción principal' })).getByRole('button', { name: 'Nueva factura' })).toBeInTheDocument();
  });
  it.each([
    ['Facturas', '/facturas', 'Documentos Tributarios Emitidos (DTE)'],
    ['Productos y servicios', '/productos', 'Catálogo de Productos & Servicios'],
    ['Clientes', '/clientes', 'Directorio de Clientes & Receptores'],
    ['Compras y gastos', '/compras', 'Módulo de Compras & Gastos'],
    ['Libros de IVA', '/libros-iva', 'Libros de IVA Oficiales (F07)'],
    ['Configuración', '/configuracion', 'Configuración Fiscal & Ministerio de Hacienda']
  ])('opens %s and updates a shareable URL', async (name, path, heading) => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', { name }));
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(window.location.hash).toBe('#' + path);
  });
  it('opens a section directly from its URL', async () => {
    window.history.replaceState(null, '', '#/clientes');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Directorio de Clientes & Receptores' })).toBeInTheDocument();
  });
  it('moves focus to content without replacing the route with a skip-link fragment', async () => {
    window.history.replaceState(null, '', '#/clientes');
    render(<App />);
    await screen.findByRole('heading', { name: 'Directorio de Clientes & Receptores' });
    fireEvent.click(screen.getByRole('link', { name: 'Saltar al contenido' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#/clientes');
  });
});
