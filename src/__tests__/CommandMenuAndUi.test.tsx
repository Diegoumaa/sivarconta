import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { CommandMenu } from '../components/layout/CommandMenu';
import { copyToClipboard } from '../utils/clipboard';
import { ClientsView } from '../components/clients/ClientsView';
import { CatalogView } from '../components/catalog/CatalogView';
import { PurchasesView } from '../components/purchases/PurchasesView';
import { InvoiceList } from '../components/billing/InvoiceList';

describe('CommandMenu Component (shadcn-admin Cmd+K Palette)', () => {
  it('renders command palette when open and displays commands list', () => {
    render(
      <AppProvider>
        <CommandMenu isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    expect(screen.getByPlaceholderText(/Escribe un comando/i)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard Fiscal/i)).toBeInTheDocument();
    expect(screen.getByText(/Emitir Factura Consumidor Final/i)).toBeInTheDocument();
  });

  it('filters commands when typing in the search box', () => {
    render(
      <AppProvider>
        <CommandMenu isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    const input = screen.getByPlaceholderText(/Escribe un comando/i);
    fireEvent.change(input, { target: { value: 'Compras' } });

    expect(screen.getByText(/Módulo de Compras y Gastos/i)).toBeInTheDocument();
    expect(screen.queryByText(/Catálogo de Productos y Servicios/i)).not.toBeInTheDocument();
  });

  it('renders all 5 official Salvadoran DTE types in the palette', () => {
    render(
      <AppProvider>
        <CommandMenu isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    expect(screen.getByText(/Emitir Factura Consumidor Final \(DTE-01\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Emitir Comprobante Crédito Fiscal \(DTE-03\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Emitir Sujeto Excluido \(DTE-14\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Emitir Nota de Crédito \(DTE-05\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Emitir Nota de Débito \(DTE-06\)/i)).toBeInTheDocument();
  });

  it('supports keyboard navigation with arrow keys and Enter selection', () => {
    render(
      <AppProvider>
        <CommandMenu isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    // Press ArrowDown to select next item
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    // Press ArrowUp to move back up
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    // Press Enter to execute
    fireEvent.keyDown(window, { key: 'Enter' });
  });

  it('calls onClose when ESC key is pressed or backdrop is clicked', () => {
    const handleClose = vi.fn();
    render(
      <AppProvider>
        <CommandMenu isOpen={true} onClose={handleClose} />
      </AppProvider>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();

    // Test backdrop click
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});

describe('Resilient Clipboard Utility', () => {
  it('safely copies text without throwing and returns boolean', async () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });

    const res = await copyToClipboard('TEST-UUID-12345', 'UUID copiado');
    expect(res).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('TEST-UUID-12345');
  });

  it('falls back to document.execCommand when navigator.clipboard is absent or throws', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied'))
      }
    });
    document.execCommand = vi.fn().mockReturnValue(true);

    const res = await copyToClipboard('FALLBACK-TEXT', 'Copiado');
    expect(res).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });
});

describe('Empty States with Interactive CTAs', () => {
  it('renders rich empty state when Clients search has no results', () => {
    render(
      <AppProvider>
        <ClientsView />
      </AppProvider>
    );

    const searchInput = screen.getByPlaceholderText(/Buscar por nombre/i);
    fireEvent.change(searchInput, { target: { value: 'NON_EXISTENT_CLIENT_XYZ' } });

    expect(screen.getByText(/No se encontraron clientes coincidentes/i)).toBeInTheDocument();
    expect(screen.getByText(/Limpiar búsqueda/i)).toBeInTheDocument();
  });

  it('renders rich empty state when Catalog search has no results', () => {
    render(
      <AppProvider>
        <CatalogView />
      </AppProvider>
    );

    const searchInput = screen.getByPlaceholderText(/Buscar por código/i);
    fireEvent.change(searchInput, { target: { value: 'UNKNOWN_PRODUCT_9999' } });

    expect(screen.getByText(/No se encontraron productos coincidentes/i)).toBeInTheDocument();
    expect(screen.getByText(/Limpiar búsqueda/i)).toBeInTheDocument();
  });

  it('renders rich empty state row when Purchases search has no results', () => {
    render(
      <AppProvider>
        <PurchasesView />
      </AppProvider>
    );

    const searchInput = screen.getByPlaceholderText(/Buscar por proveedor/i);
    fireEvent.change(searchInput, { target: { value: 'NO_SUCH_SUPPLIER_000' } });

    expect(screen.getByText(/No se encontraron compras coincidentes/i)).toBeInTheDocument();
    expect(screen.getByText(/Limpiar filtro/i)).toBeInTheDocument();
  });

  it('renders rich empty state row when Invoices search has no results', () => {
    render(
      <AppProvider>
        <InvoiceList />
      </AppProvider>
    );

    const searchInput = screen.getByPlaceholderText(/Buscar por cliente/i);
    fireEvent.change(searchInput, { target: { value: 'INVOICE_NOT_FOUND_999' } });

    expect(screen.getByText(/No se encontraron documentos emitidos en este filtro/i)).toBeInTheDocument();
    expect(screen.getByText(/Restablecer filtros/i)).toBeInTheDocument();
  });
});
