import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewCompanyModal } from '../components/companies/NewCompanyModal';
import { AppProvider } from '../context/AppContext';

// Mock confetti and supabase
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

describe('NewCompanyModal Component', () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderModal = (isOpen = true) => {
    return render(
      <AppProvider>
        <NewCompanyModal isOpen={isOpen} onClose={onCloseMock} />
      </AppProvider>
    );
  };

  it('does not render when isOpen is false', () => {
    renderModal(false);
    expect(screen.queryByText(/Registrar Nueva Empresa/i)).not.toBeInTheDocument();
  });

  it('renders modal with all form inputs and header when isOpen is true', () => {
    renderModal(true);

    expect(screen.getByText(/Registrar Nueva Empresa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Razón Social/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre Comercial/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/NIT Homologado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/NRC/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Giro \/ Actividad/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo de Facturación/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Teléfono de Contacto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Dirección Comercial Completa/i)).toBeInTheDocument();
  });

  it('allows user to click and type into all text inputs without blocking', () => {
    renderModal(true);

    const nameInput = screen.getByLabelText(/Razón Social/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Comercializadora Cuscatleca S.A. de C.V.' } });
    expect(nameInput.value).toBe('Comercializadora Cuscatleca S.A. de C.V.');

    const tradeNameInput = screen.getByLabelText(/Nombre Comercial/i) as HTMLInputElement;
    fireEvent.change(tradeNameInput, { target: { value: 'Tienda Cuscatlán' } });
    expect(tradeNameInput.value).toBe('Tienda Cuscatlán');

    const nitInput = screen.getByLabelText(/NIT Homologado/i) as HTMLInputElement;
    fireEvent.change(nitInput, { target: { value: '0614-150890-102-3' } });
    expect(nitInput.value).toBe('0614-150890-102-3');

    const nrcInput = screen.getByLabelText(/NRC/i) as HTMLInputElement;
    fireEvent.change(nrcInput, { target: { value: '345678-9' } });
    expect(nrcInput.value).toBe('345678-9');

    const emailInput = screen.getByLabelText(/Correo de Facturación/i) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'info@cuscatleca.sv' } });
    expect(emailInput.value).toBe('info@cuscatleca.sv');

    const phoneInput = screen.getByLabelText(/Teléfono de Contacto/i) as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: '+503 2222-9999' } });
    expect(phoneInput.value).toBe('+503 2222-9999');

    const addressInput = screen.getByLabelText(/Dirección Comercial Completa/i) as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: 'Avenida España #45, San Salvador' } });
    expect(addressInput.value).toBe('Avenida España #45, San Salvador');
  });

  it('submits form successfully when required fields are filled and calls onClose', async () => {
    renderModal(true);

    const nameInput = screen.getByLabelText(/Razón Social/i);
    const nitInput = screen.getByLabelText(/NIT Homologado/i);
    const nrcInput = screen.getByLabelText(/NRC/i);

    fireEvent.change(nameInput, { target: { value: 'Empresa Test S.A.' } });
    fireEvent.change(nitInput, { target: { value: '0614-010190-001-1' } });
    fireEvent.change(nrcInput, { target: { value: '112233-4' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar y Activar Empresa/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  it('rejects submission and displays error when NIT format is invalid', () => {
    renderModal(true);

    const nameInput = screen.getByLabelText(/Razón Social/i);
    const nitInput = screen.getByLabelText(/NIT Homologado/i);
    const nrcInput = screen.getByLabelText(/NRC/i);

    fireEvent.change(nameInput, { target: { value: 'Empresa Test S.A.' } });
    fireEvent.change(nitInput, { target: { value: 'INVALID_NIT_123' } });
    fireEvent.change(nrcInput, { target: { value: '112233-4' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar y Activar Empresa/i });
    fireEvent.click(submitBtn);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Formato de NIT inválido/i)).toBeInTheDocument();
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('rejects submission and displays error when NRC format is invalid', () => {
    renderModal(true);

    const nameInput = screen.getByLabelText(/Razón Social/i);
    const nitInput = screen.getByLabelText(/NIT Homologado/i);
    const nrcInput = screen.getByLabelText(/NRC/i);

    fireEvent.change(nameInput, { target: { value: 'Empresa Test S.A.' } });
    fireEvent.change(nitInput, { target: { value: '0614-010190-001-1' } });
    fireEvent.change(nrcInput, { target: { value: '123456789' } }); // missing hyphen

    const submitBtn = screen.getByRole('button', { name: /Guardar y Activar Empresa/i });
    fireEvent.click(submitBtn);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Formato de NRC inválido/i)).toBeInTheDocument();
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('closes when clicking close icon button', () => {
    renderModal(true);
    const closeBtn = screen.getByRole('button', { name: /Cerrar modal/i });
    fireEvent.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('closes when pressing Escape key', () => {
    renderModal(true);
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
