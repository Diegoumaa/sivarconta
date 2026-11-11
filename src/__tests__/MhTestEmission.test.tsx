import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MhTestEmission } from '../components/billing/MhTestEmission';
import { HaciendaQr } from '../components/billing/HaciendaQr';
import { requestMhEmission } from '../services/mhEmission';
import { INITIAL_INVOICES } from '../data/mockData';
vi.mock('../services/mhEmission', () => ({ requestMhEmission: vi.fn() }));
const draft = { ...INITIAL_INVOICES.find(i => i.dteType === '01')!, status: 'BORRADOR' as const };
beforeEach(() => vi.resetAllMocks());

describe('Interfaz de transmisión MH 00', () => {
  it('no ofrece emisión real dentro de la demostración local; en la nube admite 01, 03, 05, 06 y 14', () => {
    const { rerender } = render(<MhTestEmission invoice={draft} cloud={false} onSaved={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    for (const dteType of ['03', '05', '06', '14'] as const) {
      rerender(<MhTestEmission invoice={{ ...draft, dteType }} cloud onSaved={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Transmitir a Hacienda (pruebas)' })).toBeVisible();
    }
  });
  it('si falta el distrito lo pide con el catálogo del departamento y reenvía solo ese dato', async () => {
    const ccf = { ...draft, dteType: '03' as const, clientDepartment: 'San Salvador' };
    vi.mocked(requestMhEmission).mockResolvedValueOnce({ invoice: ccf, error: 'Selecciona el distrito del cliente.', campo: 'distrito' })
      .mockResolvedValueOnce({ invoice: { ...ccf, status: 'PROCESADO_MH' }, confirmed: true });
    render(<MhTestEmission invoice={ccf} cloud onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Transmitir a Hacienda (pruebas)' }));
    const select = await screen.findByRole('combobox', { name: /Distrito del cliente/ });
    expect(screen.getByRole('alert')).toHaveTextContent('distrito');
    expect(screen.getByRole('option', { name: 'SAN SALVADOR' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y transmitir' }));
    await waitFor(() => expect(requestMhEmission).toHaveBeenLastCalledWith(ccf.companyId, ccf.id, 'transmitir', { distrito: '14' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Sello confirmado');
  });
  it('la invalidación de un documento aceptado pide confirmación y motivo antes de enviar el evento', async () => {
    const aceptado = { ...draft, dteType: '03' as const, status: 'PROCESADO_MH' as const, mhEnvironment: '00' as const, mhReceptionStamp: 'A'.repeat(40) };
    vi.mocked(requestMhEmission).mockResolvedValue({ invoice: { ...aceptado, status: 'INVALIDADO' }, confirmed: true });
    render(<MhTestEmission invoice={aceptado} cloud onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Invalidar en Hacienda (pruebas)' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar invalidación' });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /Motivo/ }), { target: { value: 'Operación rescindida' } });
    fireEvent.click(screen.getByRole('radio', { name: /1 · Error/ }));
    expect(screen.getByRole('button', { name: 'Confirmar invalidación' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /2 · Rescindir/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar invalidación' }));
    await waitFor(() => expect(requestMhEmission).toHaveBeenCalledWith(aceptado.companyId, aceptado.id, 'invalidar', { motivo: 'Operación rescindida', tipoAnulacion: 2 }));
    expect(await screen.findByRole('status')).toHaveTextContent('Invalidación aceptada');
  });
  it('un documento invalidado muestra el sello del evento y no ofrece reenviar', () => {
    render(<MhTestEmission invoice={{ ...draft, status: 'INVALIDADO', mhEnvironment: '00', mhInvalidationStamp: 'B'.repeat(40) }} cloud onSaved={vi.fn()} />);
    expect(screen.getByText(/Sello del evento: B{40}/)).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('bloquea doble clic mientras espera y muestra el resultado confirmado', async () => {
    let finish!: (value: any) => void;
    vi.mocked(requestMhEmission).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const saved = vi.fn(); render(<MhTestEmission invoice={draft} cloud onSaved={saved} />);
    const button = screen.getByRole('button', { name: 'Transmitir a Hacienda (pruebas)' });
    fireEvent.click(button); fireEvent.click(button);
    expect(screen.getByRole('button')).toBeDisabled(); expect(requestMhEmission).toHaveBeenCalledTimes(1);
    finish({ invoice: { ...draft, status: 'PROCESADO_MH', mhEnvironment: '00' }, confirmed: true });
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent('Sello confirmado por consulta');
  });
  it('una emisión incierta ofrece consulta del mismo UUID y nunca el botón de transmitir', async () => {
    vi.mocked(requestMhEmission).mockResolvedValue({ invoice: draft, confirmed: false, message: 'Aún no hay sello confirmado.' });
    render(<MhTestEmission invoice={{ ...draft, status: 'TRANSMITIENDO', mhEmissionState: 'ENVIO_INCIERTO' }} cloud onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Consultar estado en Hacienda' }));
    await waitFor(() => expect(requestMhEmission).toHaveBeenCalledWith(draft.companyId, draft.id, 'consultar'));
    expect(screen.getByRole('status')).toHaveTextContent('Aún no hay sello');
  });
  it('muestra el 094 o un error de red y no inventa aceptación', async () => {
    vi.mocked(requestMhEmission).mockRejectedValue(new Error('Falta USER_API. No se transmitió.'));
    render(<MhTestEmission invoice={draft} cloud onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falta USER_API');
    expect(screen.queryByText(/Sello confirmado/)).not.toBeInTheDocument();
  });
  it('muestra el rechazo con su código y cada observación', () => {
    render(<MhTestEmission invoice={{ ...draft, status: 'RECHAZADO_MH', mhEmissionState: 'RECHAZADO',
      mhMessageCode: '098', mhMessage: 'DATOS INVALIDOS', mhObservations: ['Campo receptor incompleto'] }} cloud onSaved={vi.fn()} />);
    expect(screen.getByText('Código 098 · DATOS INVALIDOS')).toBeVisible();
    expect(screen.getByText('Campo receptor incompleto')).toBeVisible();
    expect(screen.getByRole('button')).toHaveTextContent('Consultar');
  });
  it('genera el QR localmente con destino exacto a la consulta de pruebas', () => {
    const url = `https://admin.factura.gob.sv/consultaPublica?ambiente=00&codGen=${draft.generationCode}&fechaEmi=2026-11-11`;
    render(<HaciendaQr url={url} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', url);
    expect(screen.getByRole('img', { name: 'QR de consulta pública de Hacienda' }).querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(100);
    expect(document.querySelectorAll('img[src^="http"]')).toHaveLength(0);
  });
});
