import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from '../components/auth/AuthGate';
import { AppProvider, useApp } from '../context/AppContext';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), onAuthStateChange: vi.fn(), signInWithPassword: vi.fn(),
  signOut: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn(),
  unsubscribe: vi.fn(), from: vi.fn(), listener: null as null | ((event: string, session: any) => void)
}));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {
  auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange,
    signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut,
    resetPasswordForEmail: mocks.resetPasswordForEmail, updateUser: mocks.updateUser }, from: mocks.from
} }));
const session = { user: { id: 'user-a' } };
const content = vi.fn((access: { mode: string; userId?: string }) => <section aria-label="Datos de empresa">{access.mode}:{access.userId}</section>);
const showGate = () => render(<AuthGate>{content}</AuthGate>);
const waitForLogin = () => waitFor(() => expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled());

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mocks.listener = null;
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.onAuthStateChange.mockImplementation(listener => { mocks.listener = listener; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; });
  mocks.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
});

describe('Access boundary', () => {
  it('does not mount company data while a session is being checked', () => {
    mocks.getSession.mockReturnValue(new Promise(() => {}));
    showGate();
    expect(content).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Comprobando tu sesión');
  });

  it('keeps an anonymous visitor outside company data', async () => {
    showGate(); await waitForLogin();
    expect(content).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Datos de empresa')).not.toBeInTheDocument();
  });

  it('allows a confirmed session into cloud mode', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    showGate();
    expect(await screen.findByLabelText('Datos de empresa')).toHaveTextContent('cloud:user-a');
  });

  it('logs in with the submitted credentials and clears the password field', async () => {
    showGate(); await waitForLogin();
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'synthetic-test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByLabelText('Datos de empresa')).toHaveTextContent('cloud:user-a');
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.test', password: 'synthetic-test-password' });
  });

  it('retains the email and explains invalid credentials without mounting data', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid login credentials' } });
    showGate(); await waitForLogin();
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'synthetic-wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El correo o la contraseña no coinciden.');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@example.test');
    expect(content).not.toHaveBeenCalled();
  });

  it('allows an explicit demo choice and returns to account access', async () => {
    showGate(); await waitForLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Explorar demostración' }));
    expect(screen.getByLabelText('Datos de empresa')).toHaveTextContent('demo:');
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Volver al acceso' }));
    expect(screen.queryByLabelText('Datos de empresa')).not.toBeInTheDocument();
  });

  it('unmounts company data after successful logout', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    showGate(); await screen.findByLabelText('Datos de empresa');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitForLogin();
    expect(screen.queryByLabelText('Datos de empresa')).not.toBeInTheDocument();
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it('does not falsely confirm logout when the service rejects it', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.signOut.mockResolvedValue({ error: new Error('Network unavailable') });
    showGate(); await screen.findByLabelText('Datos de empresa');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar la sesión');
    expect(screen.getByLabelText('Datos de empresa')).toBeInTheDocument();
  });

  it('offers demo access when session verification fails', async () => {
    mocks.getSession.mockRejectedValue(new Error('Network unavailable'));
    showGate();
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio de cuentas no está disponible');
    fireEvent.click(screen.getByRole('button', { name: 'Explorar demostración' }));
    expect(screen.getByLabelText('Datos de empresa')).toHaveTextContent('demo:');
  });

  it('does not replace a newer auth event with an older pending session result', async () => {
    let finish!: (result: any) => void;
    mocks.getSession.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    showGate();
    act(() => mocks.listener!('SIGNED_IN', session));
    await act(async () => finish({ data: { session: null }, error: null }));
    expect(screen.getByLabelText('Datos de empresa')).toHaveTextContent('cloud:user-a');
  });

  it('requests recovery with a non-enumerating confirmation message', async () => {
    showGate(); await waitForLogin();
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Si existe una cuenta con ese correo');
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('ana@example.test', { redirectTo: window.location.origin });
  });

  it('keeps account recovery outside company data until matching passwords are saved', async () => {
    showGate(); await waitForLogin();
    act(() => mocks.listener!('PASSWORD_RECOVERY', session));
    expect(screen.queryByLabelText('Datos de empresa')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'synthetic-new-password' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'different-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('repite la misma contraseña');
    expect(mocks.updateUser).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'synthetic-new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    expect(await screen.findByLabelText('Datos de empresa')).toHaveTextContent('cloud:user-a');
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'synthetic-new-password' });
  });

  it('unsubscribes when the access boundary unmounts', () => {
    const { unmount } = showGate(); unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it('uses local example data in explicit demo mode even when cloud credentials exist', () => {
    const Example = () => <output aria-label="Clientes de ejemplo">{useApp().filteredClients.length}</output>;
    render(<AppProvider demo><Example /></AppProvider>);
    expect(Number(screen.getByLabelText('Clientes de ejemplo').textContent)).toBeGreaterThan(0);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
