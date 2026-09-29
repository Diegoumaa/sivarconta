import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Settings, ShieldCheck, KeyRound, Building2, Store, CheckCircle2, Copy } from 'lucide-react';
import { NewCompanyModal } from '../companies/NewCompanyModal';
import { copyToClipboard } from '../../utils/clipboard';
import { toast } from 'sonner';

export const SettingsView: React.FC = () => {
  const { currentCompany } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const safeCompany = currentCompany || {
    name: 'Empresa No Configurada',
    tradeName: '',
    nit: '0614-000000-000-0',
    nrc: '000000-0',
    taxpayerType: 'PEQUENO' as const,
    economicActivity: 'Comercio General',
    economicActivityCode: '46510',
    address: 'San Salvador',
    municipality: 'San Salvador Centro',
    department: 'San Salvador',
    mhEnvironment: 'PRUEBAS' as const,
    mhUser: 'DTE_06140000000000',
    establishmentCode: 'M001',
    posCode: 'P001'
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Configuración Fiscal & Ministerio de Hacienda
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Parámetros de conexión DTE, firma digital y sucursales para {safeCompany.tradeName || safeCompany.name}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-tactile flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 shrink-0"
        >
          <Building2 className="w-4 h-4" />
          <span>+ Registrar Otra Empresa</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company Info */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-sm">Datos Fiscales Registrados</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-semibold">Razón Social:</span>
              <p className="font-bold text-slate-800">{safeCompany.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block font-semibold">NIT Homologado:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="font-mono font-medium text-slate-800">{safeCompany.nit}</p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(safeCompany.nit, 'NIT copiado', safeCompany.nit)}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors btn-tactile"
                    title="Copiar NIT"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">NRC:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="font-mono font-bold text-purple-700">{safeCompany.nrc}</p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(safeCompany.nrc, 'NRC copiado', safeCompany.nrc)}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors btn-tactile"
                    title="Copiar NRC"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Clasificación Tributaria:</span>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                {safeCompany.taxpayerType.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Giro / Actividad Económica:</span>
              <p className="text-slate-700">{safeCompany.economicActivity} (Cód: {safeCompany.economicActivityCode})</p>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Dirección Matriz:</span>
              <p className="text-slate-700">{safeCompany.address}, {safeCompany.municipality}, {safeCompany.department}</p>
            </div>
          </div>
        </div>

        {/* MH Connection Settings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Integración DTE (Hacienda DGII)</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-semibold">Ambiente de Transmisión:</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {safeCompany.mhEnvironment} (Sandbox Oficial)
                </span>
                <span className="text-[11px] text-slate-400">api.dtes.mh.gob.sv</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block font-semibold">Usuario API Asignado por Hacienda:</span>
              <div className="flex items-center justify-between bg-slate-100 p-2 rounded-lg mt-0.5">
                <p className="font-mono text-slate-800">{safeCompany.mhUser}</p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(safeCompany.mhUser, 'Usuario API copiado', safeCompany.mhUser)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors btn-tactile"
                  title="Copiar usuario API"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>


            <div>
              <span className="text-slate-400 block font-semibold">Certificado de Firma Electrónica:</span>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 mt-0.5">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-brand-600" />
                  <span className="font-mono text-slate-700">FirmaSV_2026.crt</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Válido
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block font-semibold">Documentos Autorizados:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['DTE-01 (Factura)', 'DTE-03 (CCF)', 'DTE-14 (Sujeto Excluido)', 'DTE-05 (Nota Crédito)', 'DTE-06 (Nota Débito)'].map(d => (
                  <span key={d} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Establishments and POS */}
        <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-brand-600" />
              <h3 className="font-bold text-slate-900 text-sm">Establecimientos y Puntos de Venta (Cajas)</h3>
            </div>
            <button 
              type="button"
              onClick={() => toast.info('Configuración de Sucursales y Cajas', { description: 'Los puntos de venta (M001 / P001) están vinculados a tu ambiente MH ' + safeCompany.mhEnvironment + '.' })}
              className="text-xs text-brand-600 font-semibold cursor-pointer hover:underline btn-tactile"
            >
              + Agregar Sucursal
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="pb-2">Cód. Establecimiento</th>
                  <th className="pb-2">Punto de Venta</th>
                  <th className="pb-2">Nombre / Ubicación</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 font-mono font-bold text-slate-800">{safeCompany.establishmentCode}</td>
                  <td className="py-2.5 font-mono text-slate-700">{safeCompany.posCode}</td>
                  <td className="py-2.5 text-slate-700">Casa Matriz / Oficina Central</td>
                  <td className="py-2.5 text-slate-500">Principal</td>
                  <td className="py-2.5 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Activo
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal to register a new company */}
      <NewCompanyModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
};
