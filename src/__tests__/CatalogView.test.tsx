import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogView } from '../components/catalog/CatalogView';
import { AppProvider } from '../context/AppContext';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('CatalogView Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderCatalog = () => {
    return render(
      <AppProvider>
        <CatalogView />
      </AppProvider>
    );
  };

  it('renders catalog header and add button', () => {
    renderCatalog();
    expect(screen.getByText(/Catálogo de Productos & Servicios/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nuevo Producto \/ Servicio/i })).toBeInTheDocument();
  });

  it('opens modal and allows typing in product fields', () => {
    renderCatalog();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo Producto \/ Servicio/i }));

    expect(screen.getByText(/Agregar al Catálogo/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Asesoría Contable Mensual/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Auditoría Fiscal Anual' } });
    expect(nameInput.value).toBe('Auditoría Fiscal Anual');

    const priceInput = screen.getByLabelText(/Precio Unitario/i) as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: '750.00' } });
    expect(priceInput.value).toBe('750.00');
  });

  it('adds product to the catalog upon submitting', () => {
    renderCatalog();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo Producto \/ Servicio/i }));

    fireEvent.change(screen.getByPlaceholderText(/PROD-001/i), { target: { value: 'SRV-888' } });
    fireEvent.change(screen.getByPlaceholderText(/Asesoría Contable Mensual/i), { target: { value: 'Servicio Cloud Hosting' } });
    fireEvent.change(screen.getByLabelText(/Precio Unitario/i), { target: { value: '120.00' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar Producto/i }));

    expect(screen.getByText('Servicio Cloud Hosting')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
  });
});
