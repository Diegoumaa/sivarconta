import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App, { suitePageFromLocation } from '../App';
vi.mock('../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

describe('Public suite entry and existing billing routes', () => {
  it('opens the module selector at the site root without mounting company data', async () => {
    localStorage.clear();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'SIVAR SUITE', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Demostración · datos de ejemplo')).not.toBeInTheDocument();
    expect(localStorage.getItem('sivarconta_demo_v2_companies')).toBeNull();
    expect(document.title).toBe('Inicio · SIVAR SUITE');
  });

  it('enters the existing billing app and returns through the suite link', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Entrar a SIVAR FACT' }));
    expect(await screen.findByRole('heading', { name: 'Así va tu negocio' }, { timeout: 3000 })).toBeInTheDocument();
    expect(document.title).toBe('Inicio · SIVAR FACT');
    fireEvent.click(screen.getByRole('link', { name: 'Volver a SIVAR SUITE' }));
    expect(await screen.findByRole('heading', { name: 'SIVAR SUITE', level: 1 })).toBeInTheDocument();
  });

  it('respects browser Back and Forward between the suite and help', async () => {
    window.history.replaceState(null, '', '#/suite');
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Ayuda' }));
    await screen.findByRole('heading', { name: '¿Por dónde empiezo?' });
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('heading', { name: '¿Por dónde empiezo?' })).not.toBeInTheDocument());
    act(() => window.history.forward());
    await screen.findByRole('heading', { name: '¿Por dónde empiezo?' });
  });

  it.each(['#/inicio', '#/facturas', '#/facturas/nueva', '#/clientes', '#/productos', '#/compras', '#/libros-iva', '#/configuracion'])(
    'preserves the existing protected billing route %s', hash => expect(suitePageFromLocation(hash)).toBeNull()
  );

  it.each([['#/suite', 'home'], ['#/', 'home'], ['', 'home'], ['#/modulos/', 'modules'], ['#/ayuda?from=home', 'help']])(
    'resolves the suite URL %s', (hash, page) => expect(suitePageFromLocation(hash)).toBe(page)
  );

  it.each([['', '?code=confirmation'], ['', '?token_hash=confirmation'], ['#access_token=token&type=recovery', ''], ['#error_description=expired', '']])(
    'keeps authentication callbacks out of the public landing page', (hash, search) => expect(suitePageFromLocation(hash, search)).toBeNull()
  );
});
