import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Building2, X, Plus, Sparkles, CheckCircle2 } from 'lucide-react';
import { Company } from '../../types';

interface NewCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewCompanyModal: React.FC<NewCompanyModalProps> = ({ isOpen, onClose }) => {
  const { addCompany } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    tradeName: '',
    nit: '',
    nrc: '',
    economicActivity: '',
    economicActivityCode: '46510',
    taxpayerType: 'PEQUENO' as Company['taxpayerType'],
    department: 'San Salvador',
    municipality: 'San Salvador Centro',
    address: '',
    phone: '+503 ',
    email: '',
    establishmentCode: 'M001',
    posCode: 'P001',
    mhEnvironment: 'PRUEBAS' as const,
    mhUser: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nit || !formData.nrc) {
      alert('Por favor complete los campos obligatorios: Razón Social, NIT y NRC');
      return;
    }

    setIsSubmitting(true);
    try {
      await addCompany({
        name: formData.name,
        tradeName: formData.tradeName || formData.name,
        nit: formData.nit,
        nrc: formData.nrc,
        economicActivity: formData.economicActivity || 'Comercio General',
        economicActivityCode: formData.economicActivityCode || '46510',
        taxpayerType: formData.taxpayerType,
        department: formData.department,
        municipality: formData.municipality,
        address: formData.address || 'San Salvador, El Salvador',
        phone: formData.phone,
        email: formData.email || 'contacto@empresa.sv',
        establishmentCode: formData.establishmentCode || 'M001',
        posCode: formData.posCode || 'P001',
        mhEnvironment: 'PRUEBAS',
        mhUser: formData.nit.replace(/-/g, '')
      });
      onClose();
    } catch (error) {
      console.error('Error al registrar empresa:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-2xl w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Registrar Nueva Empresa
                </h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Multi-Empresa
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Da de alta a un nuevo cliente del despacho contable para emitir DTEs y llevar sus libros de IVA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Razón Social (Según Tarjeta IVA) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Ferretería El Progreso, S.A. de C.V."
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Nombre Comercial / Marca
              </label>
              <input
                type="text"
                placeholder="Ej. Ferretería El Progreso"
                value={formData.tradeName}
                onChange={e => setFormData(prev => ({ ...prev, tradeName: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Tax Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                NIT Homologado <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="0614-120520-101-1"
                value={formData.nit}
                onChange={e => setFormData(prev => ({ ...prev, nit: e.target.value }))}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                NRC (Registro IVA) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="302918-2"
                value={formData.nrc}
                onChange={e => setFormData(prev => ({ ...prev, nrc: e.target.value }))}
                className="w-full px-3 py-2 text-xs font-mono font-bold text-purple-700 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Clasificación Tributaria
              </label>
              <select
                value={formData.taxpayerType}
                onChange={e => setFormData(prev => ({ ...prev, taxpayerType: e.target.value as any }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="PEQUENO">Pequeño Contribuyente</option>
                <option value="MEDIANO">Mediano Contribuyente</option>
                <option value="GRAN_CONTRIBUYENTE">Gran Contribuyente</option>
              </select>
            </div>
          </div>

          {/* Activity / Giro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Giro / Actividad Económica
              </label>
              <input
                type="text"
                placeholder="Ej. Venta de materiales de construcción y ferretería"
                value={formData.economicActivity}
                onChange={e => setFormData(prev => ({ ...prev, economicActivity: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Código Actividad MH
              </label>
              <input
                type="text"
                placeholder="46510"
                value={formData.economicActivityCode}
                onChange={e => setFormData(prev => ({ ...prev, economicActivityCode: e.target.value }))}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Teléfono de Contacto</label>
              <input
                type="text"
                placeholder="+503 2222-3333"
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Correo de Facturación</label>
              <input
                type="email"
                placeholder="facturacion@empresa.sv"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Dirección Comercial Completa</label>
            <input
              type="text"
              placeholder="Calle Principal #123, Colonia Escalón, San Salvador"
              value={formData.address}
              onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Department & Municipality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Departamento</label>
              <select
                value={formData.department}
                onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="San Salvador">San Salvador</option>
                <option value="La Libertad">La Libertad</option>
                <option value="Santa Ana">Santa Ana</option>
                <option value="San Miguel">San Miguel</option>
                <option value="Sonsonate">Sonsonate</option>
                <option value="Usulután">Usulután</option>
                <option value="Ahuachapán">Ahuachapán</option>
                <option value="La Paz">La Paz</option>
                <option value="Cabañas">Cabañas</option>
                <option value="Cuscatlán">Cuscatlán</option>
                <option value="Chalatenango">Chalatenango</option>
                <option value="Morazán">Morazán</option>
                <option value="San Vicente">San Vicente</option>
                <option value="La Unión">La Unión</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Municipio</label>
              <input
                type="text"
                placeholder="San Salvador Centro"
                value={formData.municipality}
                onChange={e => setFormData(prev => ({ ...prev, municipality: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-brand-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando en la Nube...' : 'Guardar y Activar Empresa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
