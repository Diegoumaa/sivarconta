import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { Client } from '../../types';
import { SALVADOR_DEPARTMENTS } from '../../data/mockData';
import { Users, Plus, Search, Building, Phone, Mail, MapPin, X, AlertCircle, Copy } from 'lucide-react';
import { validateDui, validateNit, validateNrc } from '../../utils/svTaxValidators';
import { toast } from 'sonner';

export const ClientsView: React.FC = () => {
  const { filteredClients, addClient } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [commercialName, setCommercialName] = useState('');
  const [docType, setDocType] = useState<'DUI' | 'NIT'>('NIT');
  const [docNumber, setDocNumber] = useState('');
  const [nrc, setNrc] = useState('');
  const [taxpayerType, setTaxpayerType] = useState<'GRAN_CONTRIBUYENTE' | 'MEDIANO' | 'PEQUENO' | 'OTRO'>('PEQUENO');
  const [economicActivity, setEconomicActivity] = useState('');
  const [department, setDepartment] = useState('San Salvador');
  const [municipality, setMunicipality] = useState('San Salvador Centro');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Lock body scroll and handle ESC key when modal is open
  useEffect(() => {
    if (!showModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal]);

  const filtered = filteredClients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.docNumber.includes(searchTerm) ||
    (c.nrc && c.nrc.includes(searchTerm))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!name.trim() || !docNumber.trim()) {
      setErrorMessage('Por favor complete el nombre y número de documento.');
      return;
    }

    if (docType === 'DUI') {
      const duiRes = validateDui(docNumber.trim());
      if (!duiRes.isValid) {
        setErrorMessage(duiRes.error || 'DUI inválido.');
        return;
      }
    } else if (docType === 'NIT') {
      const nitRes = validateNit(docNumber.trim());
      if (!nitRes.isValid) {
        setErrorMessage(nitRes.error || 'NIT inválido.');
        return;
      }
    }

    if (nrc.trim()) {
      const nrcRes = validateNrc(nrc.trim());
      if (!nrcRes.isValid) {
        setErrorMessage(nrcRes.error || 'NRC inválido.');
        return;
      }
    }

    addClient({
      name: name.trim(),
      commercialName: commercialName.trim() || undefined,
      docType,
      docNumber: docNumber.trim(),
      nrc: nrc.trim() || undefined,
      taxpayerType,
      economicActivity: economicActivity.trim() || undefined,
      department,
      municipality: municipality.trim() || 'San Salvador Centro',
      address: address.trim() || 'San Salvador, El Salvador',
      phone: phone.trim(),
      email: email.trim()
    });

    // Reset & close
    setName('');
    setCommercialName('');
    setDocNumber('');
    setNrc('');
    setAddress('');
    setPhone('');
    setEmail('');
    setErrorMessage('');
    setShowModal(false);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Directorio de Clientes & Receptores
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Registro de datos fiscales conforme a los lineamientos del Ministerio de Hacienda
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-600/30 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, DUI, NIT o NRC..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div
            key={c.id}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-300 transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <Building className="w-4 h-4" />
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  c.taxpayerType === 'GRAN_CONTRIBUYENTE'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {c.taxpayerType.replace('_', ' ')}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm leading-snug">{c.name}</h3>
                {c.commercialName && (
                  <p className="text-xs text-brand-600 font-medium">{c.commercialName}</p>
                )}
              </div>

              <div className="pt-2 text-xs space-y-1 font-mono text-slate-600">
                <div className="flex items-center justify-between">
                  <p>
                    <span className="text-slate-400 font-sans">{c.docType}:</span> {c.docNumber}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(c.docNumber);
                      toast.success(`${c.docType} copiado`, { description: c.docNumber });
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors active:scale-90"
                    title={`Copiar ${c.docType}`}
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                {c.nrc && (
                  <div className="flex items-center justify-between">
                    <p>
                      <span className="text-slate-400 font-sans">NRC:</span> <span className="text-purple-700 font-bold">{c.nrc}</span>
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(c.nrc || '');
                        toast.success('NRC copiado', { description: c.nrc });
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors active:scale-90"
                      title="Copiar NRC"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>


              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                <p className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{c.address}, {c.municipality}</span>
                </p>
                {c.email && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </p>
                )}
                {c.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{c.phone}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal New Client */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-600" />
                <h3 className="font-extrabold text-slate-900">Registrar Nuevo Cliente</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label htmlFor="client-name" className="text-xs font-semibold text-slate-700 block mb-1">Nombre o Razón Social</label>
                <input
                  id="client-name"
                  type="text"
                  required
                  placeholder="Ej. Comercial Los Ángeles S.A. de C.V."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="client-comm-name" className="text-xs font-semibold text-slate-700 block mb-1">Nombre Comercial (Opcional)</label>
                  <input
                    id="client-comm-name"
                    type="text"
                    placeholder="Ej. Tienda Los Ángeles"
                    value={commercialName}
                    onChange={e => setCommercialName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="client-taxpayer" className="text-xs font-semibold text-slate-700 block mb-1">Tipo de Contribuyente</label>
                  <select
                    id="client-taxpayer"
                    value={taxpayerType}
                    onChange={e => setTaxpayerType(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value="PEQUENO">Pequeño Contribuyente</option>
                    <option value="MEDIANO">Mediano Contribuyente</option>
                    <option value="GRAN_CONTRIBUYENTE">Gran Contribuyente</option>
                    <option value="OTRO">Persona Natural / Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="client-doctype" className="text-xs font-semibold text-slate-700 block mb-1">Tipo Doc.</label>
                  <select
                    id="client-doctype"
                    value={docType}
                    onChange={e => setDocType(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value="NIT">NIT</option>
                    <option value="DUI">DUI</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="client-docnumber" className="text-xs font-semibold text-slate-700 block mb-1">Número de Doc.</label>
                  <input
                    id="client-docnumber"
                    type="text"
                    required
                    placeholder="0614-XXXXXX-XXX-X"
                    value={docNumber}
                    onChange={e => setDocNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="client-nrc" className="text-xs font-semibold text-slate-700 block mb-1">NRC (Si aplica CCF)</label>
                  <input
                    id="client-nrc"
                    type="text"
                    placeholder="Ej. 123456-7"
                    value={nrc}
                    onChange={e => setNrc(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="client-dept" className="text-xs font-semibold text-slate-700 block mb-1">Departamento</label>
                  <select
                    id="client-dept"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    {SALVADOR_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="client-muni" className="text-xs font-semibold text-slate-700 block mb-1">Municipio</label>
                  <input
                    id="client-muni"
                    type="text"
                    required
                    value={municipality}
                    onChange={e => setMunicipality(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="client-address" className="text-xs font-semibold text-slate-700 block mb-1">Dirección Completa</label>
                <input
                  id="client-address"
                  type="text"
                  required
                  placeholder="Calle, avenida, número de local..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="client-phone" className="text-xs font-semibold text-slate-700 block mb-1">Teléfono</label>
                  <input
                    id="client-phone"
                    type="text"
                    placeholder="+503 2222-0000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="client-email" className="text-xs font-semibold text-slate-700 block mb-1">Correo Electrónico (Para DTE)</label>
                  <input
                    id="client-email"
                    type="email"
                    required
                    placeholder="facturacion@cliente.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/30"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
