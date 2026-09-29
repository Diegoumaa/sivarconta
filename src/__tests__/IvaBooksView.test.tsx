import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IvaBooksView } from '../components/books/IvaBooksView';
import { AppProvider } from '../context/AppContext';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('IvaBooksView Component (F07 Books & Export)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const renderIvaBooks = () => {
    return render(
      <AppProvider>
        <IvaBooksView />
      </AppProvider>
    );
  };

  it('renders VAT books header, company info, and action buttons', () => {
    renderIvaBooks();
    expect(screen.getByText(/Libros de IVA Oficiales \(F07\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Formato DGII El Salvador/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar CSV \(Excel\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimir Libro/i })).toBeInTheDocument();
  });

  it('renders F07 summary liquidation card with Débito, Crédito and result', () => {
    renderIvaBooks();
    expect(screen.getByText(/Resumen para Declaración de Impuestos F07/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Débito Fiscal \(Ventas\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Crédito Fiscal \(Compras\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Resultado F07 a Declarar:/i)).toBeInTheDocument();
  });

  it('switches between all 3 books (Contribuyentes, Consumidor, Compras)', () => {
    renderIvaBooks();

    // Default tab: Ventas Contribuyente
    expect(screen.getByText(/TOTALES DEL PERÍODO \(VENTAS CONTRIBUYENTE\):/i)).toBeInTheDocument();

    // Switch to Ventas Consumidor
    const consumidorTab = screen.getByRole('button', { name: /Libro de Ventas a Consumidor Final/i });
    fireEvent.click(consumidorTab);
    expect(screen.getByText(/TOTALES DEL PERÍODO \(CONSUMIDOR FINAL\):/i)).toBeInTheDocument();

    // Switch to Compras
    const comprasTab = screen.getByRole('button', { name: /Libro de Compras/i });
    fireEvent.click(comprasTab);
    expect(screen.getByText(/TOTALES DEL PERÍODO \(COMPRAS\):/i)).toBeInTheDocument();
  });

  it('triggers CSV export download without throwing errors', () => {
    renderIvaBooks();

    // Mock URL.createObjectURL and URL.revokeObjectURL
    const createObjectUrlMock = vi.fn().mockReturnValue('blob:http://localhost/test-blob');
    const revokeObjectUrlMock = vi.fn();
    window.URL.createObjectURL = createObjectUrlMock;
    window.URL.revokeObjectURL = revokeObjectUrlMock;

    const exportBtn = screen.getByRole('button', { name: /Exportar CSV \(Excel\)/i });
    fireEvent.click(exportBtn);

    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalled();
  });

  it('triggers window.print when clicking print button', () => {
    renderIvaBooks();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    const printBtn = screen.getByRole('button', { name: /Imprimir Libro/i });
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
