import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DteType, DTE_NAMES, InvoiceItem } from '../../types';
import { calculateInvoiceTotals } from '../../utils/dteUtils';
import { checkDteRules } from '../../utils/svTaxValidators';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Send, 
  ArrowLeft, 
  ArrowRight,
  ShieldCheck, 
  AlertCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Lightbulb,
  Info,
  Check
} from 'lucide-react';

export const InvoiceBuilder: React.FC = () => {
  const { 
    currentCompany, 
    filteredClients, 
    filteredProducts, 
    selectedDteTypeForNew,
    createInvoice, 
    setActiveDtePreview, 
    setCurrentView 
  } = useApp();

  // Wizard Step: 1 = Receptor & DTE, 2 = Items, 3 = Pago & Plazos, 4 = Pre-Vuelo & Firma
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [selectedDteType, setSelectedDteType] = useState<DteType>(selectedDteTypeForNew || '01');
  const [selectedClientId, setSelectedClientId] = useState<string>(filteredClients[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<string>('01');
  const [condition, setCondition] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [creditDays, setCreditDays] = useState<number>(30);
  const [observations, setObservations] = useState<string>('');
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [transmitStep, setTransmitStep] = useState<string>('');

  // Sync if context selected DTE changed
  useEffect(() => {
    if (selectedDteTypeForNew) {
      setSelectedDteType(selectedDteTypeForNew);
    }
  }, [selectedDteTypeForNew]);

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: 'item-1',
      productId: filteredProducts[0]?.id || '',
      code: filteredProducts[0]?.code || 'PROD-01',
      description: filteredProducts[0]?.name || 'Producto o Servicio',
      quantity: 1,
      unitPrice: filteredProducts[0]?.unitPrice || 50.00,
      discount: 0,
      taxType: filteredProducts[0]?.taxType || 'GRAVADO',
      unitOfMeasure: filteredProducts[0]?.unitOfMeasure || '59',
      taxAmount: 0,
      total: filteredProducts[0]?.unitPrice || 50.00
    }
  ]);

  const currentClient = filteredClients.find(c => c.id === selectedClientId) || filteredClients[0];
  const clientIsGranContribuyente = currentClient?.taxpayerType === 'GRAN_CONTRIBUYENTE';
  const companyIsGranContribuyente = currentCompany.taxpayerType === 'GRAN_CONTRIBUYENTE';

  const totals = calculateInvoiceTotals(
    selectedDteType,
    items,
    clientIsGranContribuyente,
    companyIsGranContribuyente
  );

  // Business Rules validation
  const rules = checkDteRules(
    selectedDteType, 
    totals.totalPagar, 
    currentClient?.docNumber, 
    currentClient?.nrc
  );

  const handleProductSelect = (index: number, productId: string) => {
    const prod = filteredProducts.find(p => p.id === productId);
    if (!prod) return;

    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        productId: prod.id,
        code: prod.code,
        description: prod.name,
        unitPrice: prod.unitPrice,
        taxType: prod.taxType,
        unitOfMeasure: prod.unitOfMeasure,
        total: updated[index].quantity * prod.unitPrice
      };
      return updated;
    });
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const qty = updated[index].quantity || 0;
      const price = updated[index].unitPrice || 0;
      const discount = updated[index].discount || 0;
      updated[index].total = Math.max(0, qty * price - discount);
      return updated;
    });
  };

  const addItem = () => {
    const defaultProd = filteredProducts[0];
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      productId: defaultProd?.id || '',
      code: defaultProd?.code || 'SKU-001',
      description: defaultProd?.name || 'Nuevo Ítem',
      quantity: 1,
      unitPrice: defaultProd?.unitPrice || 10.00,
      discount: 0,
      taxType: defaultProd?.taxType || 'GRAVADO',
      unitOfMeasure: defaultProd?.unitOfMeasure || '59',
      taxAmount: 0,
      total: defaultProd?.unitPrice || 10.00
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rules.isReady) {
      alert(rules.blockers[0]);
      return;
    }

    setIsTransmitting(true);

    setTransmitStep('Estructurando JSON bajo Schema v3 oficial de Hacienda...');
    await new Promise(r => setTimeout(r, 600));

    setTransmitStep('Firmando digitalmente con llave privada (JWS RSA-SHA512)...');
    await new Promise(r => setTimeout(r, 700));

    setTransmitStep('Transmitiendo a los servidores de la DGII del Ministerio de Hacienda...');
    await new Promise(r => setTimeout(r, 800));

    const invoicePayload = {
      dteType: selectedDteType,
      clientId: currentClient.id,
      clientName: currentClient.name,
      clientDocType: currentClient.docType,
      clientDocNumber: currentClient.docNumber,
      clientNrc: currentClient.nrc,
      clientAddress: currentClient.address,
      clientDepartment: currentClient.department,
      clientMunicipality: currentClient.municipality,
      clientEmail: currentClient.email,
      clientPhone: currentClient.phone,
      items,
      paymentMethod,
      condition,
      creditTermDays: condition === 'CREDITO' ? creditDays : undefined,
      subtotalGravado: totals.subtotalGravado,
      subtotalExento: totals.subtotalExento,
      subtotalNoSujeto: totals.subtotalNoSujeto,
      descuentoTotal: totals.descuentoTotal,
      iva13: totals.iva13,
      retencion1: totals.retencion1,
      percepcion1: totals.percepcion1,
      retencionRenta10: totals.retencionRenta10,
      totalPagar: totals.totalPagar,
      totalLetras: totals.totalLetras,
      observations
    };

    const created = await createInvoice(invoicePayload);
    setIsTransmitting(false);
    setActiveDtePreview(created);
    setCurrentView('invoices');
  };

  const stepTitles = {
    1: 'Tipo de DTE & Cliente',
    2: 'Productos & Servicios',
    3: 'Forma de Pago & Plazos',
    4: 'Revisión & Firma MH'
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-28 sm:pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentView('invoices')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Listado</span>
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500">Asistente DTE</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
      </div>

      {/* Stepper Progress Bar (Adaptive: Clean minimal pill on mobile, full grid on desktop) */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm">
        {/* Mobile View: No squished buttons! */}
        <div className="sm:hidden flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-600">
              Paso {currentStep} de 4
            </span>
            <h3 className="font-extrabold text-sm text-slate-900">
              {stepTitles[currentStep]}
            </h3>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setCurrentStep(s as any)}
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === s
                    ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-500/20'
                    : currentStep > s
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {currentStep > s ? '✓' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop View: Full 4-Column Stepper */}
        <div className="hidden sm:grid grid-cols-4 gap-2 text-center">
          {[
            { step: 1, label: '1. Tipo & Cliente', desc: '¿A quién facturas?' },
            { step: 2, label: '2. Productos', desc: 'Ítems y servicios' },
            { step: 3, label: '3. Pago & Plazos', desc: 'Condición y crédito' },
            { step: 4, label: '4. Pre-Vuelo & Firma', desc: 'Revisión final MH' },
          ].map(s => {
            const isCurrent = currentStep === s.step;
            const isPassed = currentStep > s.step;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(s.step as any)}
                className={`p-2.5 rounded-2xl transition-all text-center ${
                  isCurrent 
                    ? 'bg-brand-50 border border-brand-300 ring-2 ring-brand-500/20' 
                    : isPassed 
                    ? 'bg-slate-50 border border-slate-200 hover:bg-slate-100' 
                    : 'opacity-60 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent ? 'bg-brand-600 text-white' : isPassed ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                  }`}>
                    {isPassed ? '✓' : s.step}
                  </span>
                  <span className={`text-xs font-bold ${isCurrent ? 'text-brand-900' : 'text-slate-700'}`}>
                    {s.label}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">{s.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* ==================== FASE 1: TIPO DE DTE Y RECEPTOR ==================== */}
        {currentStep === 1 && (
          <div className="space-y-4 sm:space-y-6">
            {/* DTE Selector - Mobile Optimized: Compact grid */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-3 sm:space-y-4">
              <div>
                <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Paso 1: ¿Qué tipo de comprobante necesitas emitir?
                </label>
                <p className="text-xs text-slate-500 mt-0.5">Selecciona el documento adecuado para tu cliente</p>
              </div>

              {/* Compact Grid on Mobile (2 cols), 3 cols on Desktop */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {(['01', '03', '14', '05', '06'] as DteType[]).map(type => {
                  const meta = DTE_NAMES[type];
                  const isSelected = selectedDteType === type;
                  return (
                    <div
                      key={type}
                      onClick={() => setSelectedDteType(type)}
                      className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-600 bg-brand-50/60 shadow-sm ring-2 ring-brand-500/25'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold ${
                          isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                          DTE-{type}
                        </span>
                        {isSelected && <span className="w-2 h-2 rounded-full bg-brand-600"></span>}
                      </div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug truncate sm:whitespace-normal">
                        {meta.short}
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 leading-relaxed hidden sm:block">
                        {meta.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Active DTE Description Box on Mobile */}
              <div className="sm:hidden p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>{DTE_NAMES[selectedDteType].name}:</strong> {DTE_NAMES[selectedDteType].description}
                </p>
              </div>
            </div>

            {/* Client / Receptor Card */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-3 sm:space-y-4">
              <div>
                <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Datos del Cliente o Receptor
                </label>
                <p className="text-xs text-slate-500 mt-0.5">Selecciona a quién va dirigida esta operación</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Cliente Registrado
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={e => setSelectedClientId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    {filteredClients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} • {c.docType}: {c.docNumber} {c.nrc ? `• NRC: ${c.nrc}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {currentClient && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Documento ({currentClient.docType})
                      </label>
                      <input
                        type="text"
                        disabled
                        value={currentClient.docNumber}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-600"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        NRC (Registro de Contribuyente)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={currentClient.nrc || 'Sin NRC registrado'}
                        className={`w-full bg-slate-100 border rounded-xl px-3 py-2 text-xs font-mono font-semibold ${
                          currentClient.nrc ? 'border-slate-200 text-purple-700' : 'border-amber-300 text-amber-600'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Ubicación
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`${currentClient.address}, ${currentClient.municipality}`}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 truncate"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Assisted Check / Tutor Fiscal for DTE-03 without NRC */}
              {selectedDteType === '03' && !currentClient?.nrc && (
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Este cliente no tiene NRC registrado</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Para emitir un <strong>Crédito Fiscal (DTE-03)</strong>, Hacienda exige el NRC del cliente.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCurrentView('clients')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700"
                    >
                      Editar Cliente y Agregar NRC
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDteType('01')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 font-semibold text-xs hover:bg-amber-50"
                    >
                      Cambiar a Factura (DTE-01)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl sm:rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-brand-600/30 transition-all active:scale-95"
              >
                <span>Continuar a Productos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================== FASE 2: PRODUCTOS Y SERVICIOS ==================== */}
        {currentStep === 2 && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Paso 2: ¿Qué productos o servicios vas a facturar?
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">Agrega los ítems que cobrarás en este documento</p>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-100 text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>
              </div>

              {/* Mobile View: Clean Item Cards (No cramped table scroll!) */}
              <div className="sm:hidden space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={item.productId || ''}
                        onChange={e => handleProductSelect(index, e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-800"
                      >
                        <option value="">-- Personalizado --</option>
                        {filteredProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            [{p.code}] {p.name}
                          </option>
                        ))}
                      </select>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={item.description}
                      onChange={e => handleItemChange(index, 'description', e.target.value)}
                      placeholder="Descripción del producto o servicio"
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800"
                      required
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Cantidad</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-center font-mono font-bold"
                          required
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Precio ($)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={e => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-right font-mono"
                          required
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Total ($)</span>
                        <div className="w-full bg-slate-100 border border-slate-200 rounded-lg p-1.5 text-xs text-right font-mono font-bold text-slate-900">
                          ${item.total.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                      <th className="pb-2 w-1/4">Catálogo</th>
                      <th className="pb-2 w-1/3">Descripción del Producto/Servicio</th>
                      <th className="pb-2 text-center w-16">Cant.</th>
                      <th className="pb-2 text-right w-24">Precio ($)</th>
                      <th className="pb-2 text-right w-20">Desc. ($)</th>
                      <th className="pb-2 text-right w-24">Total ($)</th>
                      <th className="pb-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 pr-2">
                          <select
                            value={item.productId || ''}
                            onChange={e => handleProductSelect(index, e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-medium text-slate-800"
                          >
                            <option value="">-- Personalizado --</option>
                            {filteredProducts.map(p => (
                              <option key={p.id} value={p.id}>
                                [{p.code}] {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={e => handleItemChange(index, 'description', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800"
                            placeholder="Descripción clara del ítem"
                            required
                          />
                        </td>
                        <td className="py-2.5 pr-2 text-center">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-16 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-center font-mono font-bold"
                            required
                          />
                        </td>
                        <td className="py-2.5 pr-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={e => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-right font-mono"
                            required
                          />
                        </td>
                        <td className="py-2.5 pr-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount}
                            onChange={e => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-20 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-right font-mono"
                          />
                        </td>
                        <td className="py-2.5 pr-2 text-right font-mono font-bold text-slate-900">
                          ${item.total.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            disabled={items.length <= 1}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Subtotal Preview */}
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-500">Subtotal Ítems ({items.length}):</span>
                <span className="text-base font-extrabold font-mono text-slate-900">${totals.subtotalGravado.toFixed(2)}</span>
              </div>
            </div>

            {/* Stepper Navigation */}
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-brand-600/30 transition-all active:scale-95"
              >
                <span>Continuar a Pago</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================== FASE 3: FORMA DE PAGO & PLAZOS ==================== */}
        {currentStep === 3 && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-4 sm:space-y-5">
              <div>
                <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Paso 3: ¿Cómo se cancela la operación?
                </label>
                <p className="text-xs text-slate-500 mt-0.5">Define el método de cobro y los términos comerciales</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Payment method selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Método de Pago (CAT-014 MH)
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                  >
                    <option value="01">01 - Billetes y Monedas (Efectivo)</option>
                    <option value="02">02 - Tarjeta de Débito</option>
                    <option value="03">03 - Tarjeta de Crédito</option>
                    <option value="04">04 - Transferencia Bancaria 365</option>
                    <option value="05">05 - Cheque</option>
                  </select>
                </div>

                {/* Condition: Contado vs Crédito */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Condición de Pago
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCondition('CONTADO')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        condition === 'CONTADO'
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Contado
                    </button>
                    <button
                      type="button"
                      onClick={() => setCondition('CREDITO')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        condition === 'CREDITO'
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Crédito a Plazos
                    </button>
                  </div>
                </div>
              </div>

              {/* Progressive Disclosure: Credit Days */}
              {condition === 'CREDITO' && (
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs">
                    <Calendar className="w-4 h-4 text-brand-600" />
                    <span>Plazo de Crédito Otorgado</span>
                  </div>
                  <p className="text-[11px] text-indigo-700">Días que tiene el cliente para cancelar:</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {[15, 30, 60, 90].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setCreditDays(d)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                          creditDays === d
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-white border border-indigo-200 text-indigo-800'
                        }`}
                      >
                        {d} días
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-indigo-800 font-medium">Otro:</span>
                      <input
                        type="number"
                        min="1"
                        value={creditDays}
                        onChange={e => setCreditDays(parseInt(e.target.value) || 30)}
                        className="w-16 bg-white border border-indigo-300 rounded-lg p-1 text-xs text-center font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Observations */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Observaciones adicionales en el DTE
                </label>
                <textarea
                  rows={2}
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  placeholder="Ej. Orden de Compra #4589, entrega en bodega..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              {/* TUTOR FISCAL SIVARCONTA */}
              <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-slate-50 to-cyan-50/50 border border-indigo-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-cyan-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900 tracking-tight">
                        Tutor Fiscal SIVARCONTA
                      </h4>
                      <p className="text-[10px] text-slate-500 hidden sm:block">Asesoría tributaria en tiempo real</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-indigo-100 text-brand-700 border border-indigo-200">
                    Consejo Activo
                  </span>
                </div>

                {/* Contextual guidance */}
                <div className="space-y-2 text-xs">
                  {selectedDteType === '01' && (
                    <div className="flex items-start gap-2 text-slate-700">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-[11px]">
                        <strong>Factura de Consumidor Final:</strong> El valor de ${totals.totalPagar.toFixed(2)} ya incluye el 13% de IVA (${totals.iva13.toFixed(2)}).
                      </div>
                    </div>
                  )}

                  {selectedDteType === '03' && (
                    <div className="flex items-start gap-2 text-slate-700">
                      <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <div className="text-[11px]">
                        <strong>Crédito Fiscal:</strong> Generas ${totals.iva13.toFixed(2)} de Débito Fiscal para tu F07 y crédito para tu cliente con NRC.
                      </div>
                    </div>
                  )}

                  {totals.retencion1 > 0 && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2 text-[11px]">
                      <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Retención de IVA (1%):</strong> Cliente Gran Contribuyente retiene ${totals.retencion1.toFixed(2)}. Pide tu constancia de retención.
                      </div>
                    </div>
                  )}

                  {Boolean(totals.percepcion1 && totals.percepcion1 > 0) && (
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2 text-[11px]">
                      <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Percepción de IVA (1%):</strong> Cobras ${totals.percepcion1.toFixed(2)} adicionales para enterar a Hacienda.
                      </div>
                    </div>
                  )}

                  {selectedDteType === '14' && (
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2 text-[11px]">
                      <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Retención Renta (10%):</strong> Retienes ${totals.retencionRenta10.toFixed(2)} que enterarás en tu informe mensual F14.
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-1.5 text-slate-600 pt-1 border-t border-indigo-100/60 text-[10px] sm:text-[11px]">
                    <span className="font-bold text-slate-800">
                      {condition === 'CONTADO' ? 'Operación al Contado:' : `Venta al Crédito (${creditDays} días):`}
                    </span>
                    <span>
                      {condition === 'CONTADO'
                        ? 'El pago se recibe de inmediato.'
                        : 'El IVA generado debe declararse en el mes de emisión.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stepper Navigation */}
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-brand-600/30 transition-all active:scale-95"
              >
                <span>Revisión Pre-Vuelo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================== FASE 4: PRE-VUELO & FIRMA MH ==================== */}
        {currentStep === 4 && (
          <div className="space-y-4 sm:space-y-6">
            {/* Pre-Flight Checklist */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Semáforo de Validación Pre-Vuelo</h3>
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Listo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-slate-800 block text-[11px]">Receptor:</span>
                    <span className="text-slate-500 text-[10px] truncate block">{currentClient?.name}</span>
                  </div>
                </div>

                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 block text-[11px]">Cálculos de Impuestos:</span>
                    <span className="text-slate-500 text-[10px] font-mono">
                      Sub: ${totals.subtotalGravado.toFixed(2)} | IVA: ${totals.iva13.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 block text-[11px]">Firma Criptográfica:</span>
                    <span className="text-slate-500 text-[10px] font-mono">FirmaSV_2026.crt Activo</span>
                  </div>
                </div>

                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 block text-[11px]">Servidor Hacienda:</span>
                    <span className="text-slate-500 text-[10px]">{currentCompany.mhEnvironment} En línea</span>
                  </div>
                </div>
              </div>

              {rules.blockers.length > 0 && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
                  <strong>⚠️ No se puede transmitir:</strong> {rules.blockers[0]}
                </div>
              )}
            </div>

            {/* Live Draft Preview Box */}
            <div className="bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white border border-slate-800 shadow-xl space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-[10px] sm:text-xs uppercase font-bold tracking-wider text-cyan-400">
                  Resumen de la Transmisión
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-200">
                  DTE-{selectedDteType}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Documento</span>
                  <strong className="text-white text-xs truncate block">{DTE_NAMES[selectedDteType].short}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Condición</span>
                  <strong className="text-white text-xs block">{condition} {condition === 'CREDITO' ? `(${creditDays}d)` : ''}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Método Pago</span>
                  <strong className="text-white text-xs block">{paymentMethod === '01' ? 'Efectivo' : paymentMethod === '04' ? 'Transferencia' : 'Tarjeta'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Total a Cobrar</span>
                  <span className="text-lg sm:text-xl font-extrabold font-mono text-cyan-400 block">
                    ${totals.totalPagar.toFixed(2)}
                  </span>
                </div>
              </div>

              <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono italic pt-2 border-t border-slate-800 leading-relaxed">
                SON: {totals.totalLetras}
              </p>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isTransmitting || !rules.isReady}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white py-3.5 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {isTransmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Transmitiendo a Hacienda...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Firmar y Transmitir DTE a Hacienda</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Stepper Navigation */}
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Paso Anterior</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Modal / Toast of Transmission Sequence */}
      {isTransmitting && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/20 text-cyan-400 flex items-center justify-center mx-auto animate-pulse">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">Transmitiendo a DGII El Salvador</h3>
              <p className="text-xs text-slate-400 mt-1">Ambiente de Pruebas / Homologación DTE</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-cyan-300 font-mono">
              {transmitStep}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
