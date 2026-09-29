import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('App Root Component & Multi-View Navigation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders application with sidebar and initial Dashboard view', () => {
    render(<App />);

    expect(screen.getByText(/SIVAR/i)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard Fiscal/i)).toBeInTheDocument();
    expect(screen.getByText(/Facturación DTE/i)).toBeInTheDocument();
    expect(screen.getByText(/Catálogo Productos/i)).toBeInTheDocument();
    expect(screen.getByText(/Directorio Clientes/i)).toBeInTheDocument();
    expect(screen.getByText(/Módulo Compras/i)).toBeInTheDocument();
    expect(screen.getByText(/Libros de IVA \(F07\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Configuración MH/i)).toBeInTheDocument();
  });

  it('navigates to Facturación DTE when clicking sidebar button', () => {
    render(<App />);

    const invoicesNav = screen.getByRole('button', { name: /Facturación DTE/i });
    fireEvent.click(invoicesNav);

    expect(screen.getByText(/Documentos Tributarios Emitidos \(DTE\)/i)).toBeInTheDocument();
  });

  it('navigates to Catálogo Productos when clicking sidebar button', () => {
    render(<App />);

    const catalogNav = screen.getByRole('button', { name: /Catálogo Productos/i });
    fireEvent.click(catalogNav);

    expect(screen.getByText(/Catálogo de Productos & Servicios/i)).toBeInTheDocument();
  });

  it('navigates to Directorio Clientes when clicking sidebar button', () => {
    render(<App />);

    const clientsNav = screen.getByRole('button', { name: /Directorio Clientes/i });
    fireEvent.click(clientsNav);

    expect(screen.getByText(/Directorio de Clientes & Receptores/i)).toBeInTheDocument();
  });

  it('navigates to Módulo Compras when clicking sidebar button', () => {
    render(<App />);

    const purchasesNav = screen.getByRole('button', { name: /Módulo Compras/i });
    fireEvent.click(purchasesNav);

    expect(screen.getByText(/Módulo de Compras & Gastos/i)).toBeInTheDocument();
  });

  it('navigates to Libros de IVA when clicking sidebar button', () => {
    render(<App />);

    const booksNav = screen.getByRole('button', { name: /Libros de IVA \(F07\)/i });
    fireEvent.click(booksNav);

    expect(screen.getByText(/Libros de IVA Oficiales \(F07\)/i)).toBeInTheDocument();
  });

  it('navigates to Configuración MH when clicking sidebar button', () => {
    render(<App />);

    const settingsNav = screen.getByRole('button', { name: /Configuración MH/i });
    fireEvent.click(settingsNav);

    expect(screen.getByText(/Configuración Fiscal & Ministerio de Hacienda/i)).toBeInTheDocument();
  });
});
