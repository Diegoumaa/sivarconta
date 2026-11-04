import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { CompanySettings } from '../../types';

export function DocumentSettings() {
  const { currentCompany, updateCompanySettings } = useApp();
  const [settings, setSettings] = useState<CompanySettings>(currentCompany?.settings || {});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSettings(currentCompany?.settings || {}); setError(''); }, [currentCompany?.id, currentCompany?.settings]);
  const loadLogo = async (file?: File) => {
    setError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 300_000) { setError('Usa una imagen PNG, JPEG o WebP de hasta 300 KB.'); return; }
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    setSettings(s => ({ ...s, logoDataUrl: data }));
  };
  return <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={async e => {
    e.preventDefault(); setError(''); setSaving(true);
    try { await updateCompanySettings(settings); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setSaving(false); }
  }}>
    <h2 className="font-bold text-slate-900">Documentos y saldo inicial de IVA</h2>
    <label className="block text-sm">Logo de la empresa<input aria-label="Logo de la empresa" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void loadLogo(e.target.files?.[0])} className="mt-1 block w-full text-xs" /></label>
    {settings.logoDataUrl && <div className="flex items-center gap-3"><img src={settings.logoDataUrl} alt="Logo de la empresa" className="h-20 max-w-48 object-contain" /><button type="button" onClick={() => setSettings(s => ({ ...s, logoDataUrl: undefined }))}>Quitar logo</button></div>}
    <p className="text-sm text-slate-600">Si ya declarabas antes de usar el sistema, indica el primer período que llevarás aquí y el remanente declarado al cierre del mes anterior. Los registros anteriores a ese período no se vuelven a sumar.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Primer período de cálculo<input aria-label="Primer período de cálculo" type="month" value={settings.ivaOpeningPeriod || ''} required={Boolean(settings.ivaOpeningBalance)} onChange={e => setSettings(s => ({ ...s, ivaOpeningPeriod: e.target.value }))} className="mt-1 block w-full rounded-xl border p-2" /></label>
      <label className="text-sm">Remanente inicial declarado ($)<input aria-label="Remanente inicial declarado ($)" type="number" min="0" step="0.01" value={settings.ivaOpeningBalance || 0} onChange={e => setSettings(s => ({ ...s, ivaOpeningBalance: Number(e.target.value) }))} className="mt-1 block w-full rounded-xl border p-2" /></label>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar configuración de documentos'}</button>
  </form>;
}
