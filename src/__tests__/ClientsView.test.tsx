import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientsView } from '../components/clients/ClientsView';
import { AppProvider } from '../context/AppContext';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('ClientsView Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderClients = () => {
    return render(
      <AppProvider>
        <ClientsView />
      </AppProvider>
    );
  };

  it('renders clients directory title and add button', () => {
    renderClients();
    expect(screen.getByText(/Directorio de Clientes & Receptores/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nuevo Cliente/i })).toBeInTheDocument();
  });

  it('opens modal and allows typing in client fields', () => {
    renderClients();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo Cliente/i }));

    expect(screen.getByText(/Registrar Nuevo Cliente/i)).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Nombre o Razón Social/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Inversiones Cuscatlán S.A.' } });
    expect(nameInput.value).toBe('Inversiones Cuscatlán S.A.');

    const docInput = screen.getByLabelText(/Número de Doc/i) as HTMLInputElement;
    fireEvent.change(docInput, { target: { value: '0614-200590-101-2' } });
    expect(docInput.value).toBe('0614-200590-101-2');

    const nrcInput = screen.getByLabelText(/NRC/i) as HTMLInputElement;
    fireEvent.change(nrcInput, { target: { value: '87654-3' } });
    expect(nrcInput.value).toBe('87654-3');
  });

  it('adds client to the directory upon submitting', () => {
    renderClients();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo Cliente/i }));

    fireEvent.change(screen.getByLabelText(/Nombre o Razón Social/i), { target: { value: 'Tech Solutions S.A.' } });
    fireEvent.change(screen.getByLabelText(/Número de Doc/i), { target: { value: '0614-111111-101-1' } });
    fireEvent.change(screen.getByLabelText(/NRC/i), { target: { value: '99887-1' } });
    fireEvent.change(screen.getByLabelText(/Dirección Completa/i), { target: { value: 'Antiguo Cuscatlán' } });
    fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), { target: { value: 'facturacion@tech.sv' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar Cliente/i }));

    expect(screen.getByText('Tech Solutions S.A.')).toBeInTheDocument();
  });
});
