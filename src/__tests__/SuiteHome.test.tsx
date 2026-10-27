import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SuiteHome, SUITE_MODULES } from '../components/suite/SuiteHome';

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => vi.unstubAllGlobals());

describe('SIVAR SUITE module selector', () => {
  it('shows four named modules and only permits entry to invoicing', () => {
    render(<SuiteHome page="home" />);
    const cards = within(screen.getByRole('region', { name: 'Módulos de SIVAR SUITE' }));
    expect(cards.getAllByRole('article')).toHaveLength(4);
    expect(cards.getByRole('link', { name: 'Entrar a SIVAR FACT' })).toHaveAttribute('href', '#/inicio');
    for (const name of ['CONTA', 'STOCK', 'ADMIN']) {
      expect(cards.getByRole('heading', { name: `SIVAR ${name}` })).toBeInTheDocument();
      expect(cards.getByRole('button', { name: `SIVAR ${name} · Próximamente` })).toBeDisabled();
    }
    expect(SUITE_MODULES.filter(module => module.available).map(module => module.id)).toEqual(['fact']);
  });

  it('keeps unavailable modules disabled after searching their names', () => {
    render(<SuiteHome page="home" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar módulos' }), { target: { value: 'INVENTARIOS' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'SIVAR STOCK · Próximamente' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Entrar a SIVAR FACT' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 módulo encontrado');
  });

  it('searches accented descriptions without requiring accents', () => {
    render(<SuiteHome page="home" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar módulos' }), { target: { value: '  facturacion  ' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Entrar a SIVAR FACT' })).toBeInTheDocument();
  });

  it('recovers all modules from an empty search', () => {
    render(<SuiteHome page="home" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar módulos' }), { target: { value: 'no-existe' } });
    expect(screen.getByRole('heading', { name: 'No encontramos ese módulo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todos los módulos' }));
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.getByRole('textbox', { name: 'Buscar módulos' })).toHaveValue('');
  });

  it('shows truthful news and dismisses the panel with Escape', () => {
    render(<SuiteHome page="home" />);
    const trigger = screen.getByRole('button', { name: 'Novedades de la suite' });
    fireEvent.click(trigger);
    expect(screen.getByRole('region', { name: 'Novedades' })).toHaveTextContent('SIVAR FACT ya está disponible.');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Novedades' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('offers account entry through the existing authentication flow', () => {
    render(<SuiteHome page="home" />);
    fireEvent.click(screen.getByRole('button', { name: 'Acceso a mi cuenta' }));
    expect(within(screen.getByRole('region', { name: 'Mi cuenta' })).getByRole('link', { name: 'Ir a SIVAR FACT' })).toHaveAttribute('href', '#/inicio');
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('region', { name: 'Mi cuenta' })).not.toBeInTheDocument();
  });

  it('uses real billing destinations for reports and settings', () => {
    render(<SuiteHome page="modules" />);
    const nav = within(screen.getByRole('navigation', { name: 'Navegación de la suite' }));
    expect(nav.getByRole('link', { name: 'Módulos' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Reportes' })).toHaveAttribute('href', '#/libros-iva');
    expect(nav.getByRole('link', { name: 'Configuración' })).toHaveAttribute('href', '#/configuracion');
  });

  it('keeps the skip link on the current route and focuses the main content', () => {
    window.history.replaceState(null, '', '#/modulos');
    render(<SuiteHome page="modules" />);
    fireEvent.click(screen.getByRole('link', { name: 'Saltar al contenido' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#/modulos');
  });

  it('explains the available module and fiscal limits in help', () => {
    render(<SuiteHome page="help" />);
    expect(screen.getByRole('heading', { name: '¿Por dónde empiezo?' })).toBeInTheDocument();
    expect(screen.getByText(/firma y el envío oficial a Hacienda siguen pendientes/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar a SIVAR FACT' })).toHaveAttribute('href', '#/inicio');
  });

  it('opens and closes the mobile drawer without leaving its backdrop active', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<SuiteHome page="home" />);
    const trigger = screen.getByRole('button', { name: 'Abrir menú de la suite' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú de la suite' }));
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Cerrar menú de la suite' })).not.toBeInTheDocument();
  });
});
