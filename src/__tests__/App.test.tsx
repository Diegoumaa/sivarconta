import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../BillingApp';
vi.mock('../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

describe('Application routes', () => {
  beforeEach(() => { localStorage.clear(); window.history.replaceState(null, '', '#/inicio'); });
  it('shows a clear first action and all primary sections', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Así va tu negocio' }, { timeout: 3000 })).toBeInTheDocument();
    const navigation = within(screen.getByRole('navigation', { name: 'Navegación principal' }));
    for (const name of ['Inicio','Facturas','Productos y servicios','Clientes','Compras y gastos','Libros de IVA','Configuración']) {
      expect(navigation.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(screen.getByRole('region', { name: 'Acción principal' })).getByRole('button', { name: 'Nueva factura' })).toBeInTheDocument();
  });
  it.each([
    ['Facturas', '/facturas', 'Facturas y documentos'],
    ['Productos y servicios', '/productos', 'Productos y servicios'],
    ['Clientes', '/clientes', 'Clientes'],
    ['Compras y gastos', '/compras', 'Compras y gastos'],
    ['Libros de IVA', '/libros-iva', 'Libros de IVA'],
    ['Configuración', '/configuracion', 'Configuración de tu empresa']
  ])('opens %s and updates a shareable URL', async (name, path, heading) => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', { name }));
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(window.location.hash).toBe('#' + path);
  });
  it('opens a section directly from its URL', async () => {
    window.history.replaceState(null, '', '#/clientes');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
  });
  it('moves focus to content without replacing the route with a skip-link fragment', async () => {
    window.history.replaceState(null, '', '#/clientes');
    render(<App />);
    await screen.findByRole('heading', { name: 'Clientes' });
    fireEvent.click(screen.getByRole('link', { name: 'Saltar al contenido' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#/clientes');
  });
  it('opens the saved draft preview after navigating to the invoice list and keeps focus in it', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Así va tu negocio' });
    fireEvent.click(within(screen.getByRole('region', { name: 'Acción principal' })).getByRole('button', { name: 'Nueva factura' }));
    await screen.findByRole('heading', { name: 'Nueva factura' });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a Productos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a Pago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar borrador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador de prueba' }));
    const preview = await screen.findByRole('dialog', { name: 'Vista previa del documento' });
    expect(preview).toHaveFocus();
    expect(within(preview).getAllByText(/sin validez fiscal/i).length).toBeGreaterThan(0);
    expect(window.location.hash).toBe('#/facturas');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Vista previa del documento' })).not.toBeInTheDocument();
  });
});
