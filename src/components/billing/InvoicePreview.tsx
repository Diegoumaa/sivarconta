import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { InvoiceDocument, DTE_NAMES } from '../../types';
import { Printer, Download, X, Code2, QrCode, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { exportElementToPdf } from '../../utils/pdfExport';

interface InvoicePreviewProps {
  invoice: InvoiceDocument;
  onClose: () => void;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoice, onClose }) => {
  const { currentCompany } = useApp();
  const [showJson, setShowJson] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Attach a class to body while modal is open to ensure clean CSS print isolation
  useEffect(() => {
    document.body.classList.add('dte-modal-active');
    return () => {
      document.body.classList.remove('dte-modal-active');
    };
  }, []);

  const meta = DTE_NAMES[invoice.dteType];

  const safeCompany = currentCompany || {
    name: 'Empresa Emisora',
    tradeName: '',
    nit: '0614-000000-000-0',
    nrc: '000000-0',
    economicActivity: 'Comercio General',
    economicActivityCode: '46510',
    address: 'San Salvador, El Salvador',
    phone: '+503 2222-0000',
    email: 'facturacion@empresa.sv',
    mhEnvironment: 'PRUEBAS' as const
  };

  const mhJsonPayload = {
    identificacion: {
      version: 3,
      ambiente: safeCompany.mhEnvironment === 'PRODUCCION' ? '01' : '00',
      tipoDte: invoice.dteType,
      numeroControl: invoice.controlNumber,
      codigoGeneracion: invoice.generationCode,
      tipoModelo: 1,
      tipoOperacion: 1,
      fecEmi: invoice.emissionDate,
      horEmi: invoice.emissionTime,
      tipoMoneda: 'USD'
    },
    emisor: {
      nit: safeCompany.nit,
      nrc: safeCompany.nrc,
      nombre: safeCompany.name,
      codActividad: safeCompany.economicActivityCode,
      descActividad: safeCompany.economicActivity,
      direccion: {
        departamento: '06',
        municipio: '14',
        complemento: safeCompany.address
      },
      telefono: safeCompany.phone,
      correo: safeCompany.email
    },
    receptor: {
      tipoDocumento: invoice.clientDocType === 'NIT' ? '36' : '13',
      numDocumento: invoice.clientDocNumber,
      nrc: invoice.clientNrc || null,
      nombre: invoice.clientName,
      correo: invoice.clientEmail,
      direccion: {
        complemento: invoice.clientAddress
      }
    },
    cuerpoDocumento: invoice.items.map((item, idx) => ({
      numItem: idx + 1,
      tipoItem: 1,
      cantidad: item.quantity,
      codigo: item.code,
      uniMedida: parseInt(item.unitOfMeasure) || 59,
      descripcion: item.description,
      precioUni: item.unitPrice,
      montoDescu: item.discount,
      ventaNoSuj: 0,
      ventaExenta: item.taxType === 'EXENTO' ? item.total : 0,
      ventaGravada: item.taxType === 'GRAVADO' ? item.total : 0,
      tributos: item.taxType === 'GRAVADO' ? ['20'] : null
    })),
    resumen: {
      totalNoSuj: invoice.subtotalNoSujeto,
      totalExenta: invoice.subtotalExento,
      totalGravada: invoice.subtotalGravado,
      subTotalVentas: invoice.subtotalGravado + invoice.subtotalExento,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada: invoice.descuentoTotal,
      porcentajeDescuento: 0,
      totalDescu: invoice.descuentoTotal,
      tributos: invoice.dteType === '03' ? [{ codigo: '20', descripcion: 'IVA 13%', valor: invoice.iva13 }] : null,
      ivaRete1: invoice.retencion1 || 0,
      ivaPerci1: invoice.percepcion1 || 0,
      reteRenta: invoice.retencionRenta10 || 0,
      totalPagar: invoice.totalPagar,
      totalLetras: invoice.totalLetras,
      condicionOperacion: invoice.condition === 'CONTADO' ? 1 : 2
    },
    selloRecibido: invoice.mhReceptionStamp
  };

  // Direct High-Resolution PDF Download (Vector-like Quality, 0% print dialog hassle)
  const handleDownloadPdf = async () => {
    if (showJson) setShowJson(false);
    setIsGeneratingPdf(true);
    try {
      setTimeout(async () => {
        await exportElementToPdf('printable-dte-area', `${invoice.controlNumber}.pdf`);
        setIsGeneratingPdf(false);
      }, 150);
    } catch (err) {
      console.error('PDF export error:', err);
      setIsGeneratingPdf(false);
    }
  };

  // Native Browser Print (Protected by print:hidden on main layout & custom print media CSS)
  const handlePrint = () => {
    if (showJson) {
      setShowJson(false);
      setTimeout(() => window.print(), 150);
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-2 sm:p-6 flex items-center justify-center print-modal-wrapper">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 my-4 sm:my-8 print-document-card">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print bg-slate-900 px-4 sm:px-6 py-3.5 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-600/30 text-cyan-400 border border-brand-500/30">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs sm:text-sm">Representación Gráfica Oficial DTE</h3>
                <span className="px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SELLO MH
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">Ministerio de Hacienda de El Salvador (DGII)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJson(!showJson)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              <Code2 className="w-4 h-4 text-cyan-400" />
              <span>{showJson ? 'Ver Factura' : 'Ver JSON MH'}</span>
            </button>

            {/* Direct High-Resolution PDF Download */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white transition-all shadow-md shadow-emerald-600/30 active:scale-95 cursor-pointer"
              title="Descargar archivo PDF oficial tamaño Carta listo para enviar o imprimir"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
              <span className="sm:hidden">{isGeneratingPdf ? '...' : 'PDF'}</span>
            </button>

            {/* Native Browser Print */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white transition-all shadow-md shadow-brand-600/30 active:scale-95 cursor-pointer"
              title="Abrir diálogo de impresión del navegador"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Cerrar vista previa"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {showJson ? (
          <div className="p-6 bg-slate-950 text-cyan-300 font-mono text-xs overflow-x-auto max-h-[75vh]">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
              <span className="text-slate-400">Payload JSON transmitido a la API del Ministerio de Hacienda (DGII)</span>
              <span className="text-emerald-400 font-bold">Estado: FIRMADO_JWS</span>
            </div>
            <pre>{JSON.stringify(mhJsonPayload, null, 2)}</pre>
          </div>
        ) : (
          <div id="printable-dte-area" className="p-6 sm:p-10 text-slate-900 max-h-[85vh] overflow-y-auto print:max-h-none print:p-0 print:overflow-visible print:text-black bg-white">
            {/* Header: Emisor (Left) & Official DTE Box (Right) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-6 pb-5 border-b-2 border-slate-900 items-start">
              {/* Emisor Info */}
              <div className="sm:col-span-7 print:col-span-7 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Emisor Autorizado
                </span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  {safeCompany.name}
                </h2>
                {safeCompany.tradeName && (
                  <p className="text-xs font-bold text-brand-700">{safeCompany.tradeName}</p>
                )}
                
                <div className="text-[11px] text-slate-700 space-y-1 pt-1 leading-normal">
                  <p><strong>NIT:</strong> <span className="font-mono font-medium">{safeCompany.nit}</span> &nbsp;|&nbsp; <strong>NRC:</strong> <span className="font-mono font-medium">{safeCompany.nrc}</span></p>
                  <p><strong>Giro / Actividad:</strong> {safeCompany.economicActivity}</p>
                  <p><strong>Dirección:</strong> {safeCompany.address}</p>
                  <p><strong>Teléfono:</strong> {safeCompany.phone} &nbsp;|&nbsp; <strong>Correo:</strong> {safeCompany.email}</p>
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    Establecimiento: <strong>{invoice.establishmentCode}</strong> &nbsp;|&nbsp; Punto de Venta: <strong>{invoice.posCode}</strong>
                  </p>
                </div>
              </div>

              {/* Official DTE Box */}
              <div className="sm:col-span-5 print:col-span-5 p-4 rounded-xl bg-slate-50 border-2 border-slate-900 space-y-2.5">
                <div className="text-center border-b border-slate-300 pb-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600 block">
                    DOCUMENTO TRIBUTARIO ELECTRÓNICO
                  </span>
                  <h3 className="font-black text-xs sm:text-sm text-slate-900 uppercase mt-1">
                    {meta.name}
                  </h3>
                  <span className="inline-block mt-1.5 font-mono font-extrabold text-[10px] px-2.5 py-0.5 bg-slate-900 text-white rounded">
                    DTE-{invoice.dteType}
                  </span>
                </div>

                <div className="text-[10px] space-y-2 font-mono">
                  <div className="pb-0.5">
                    <span className="text-slate-500 font-sans font-bold text-[8px] uppercase block">Número de Control:</span>
                    <strong className="text-slate-900 text-[11px] block mt-0.5">{invoice.controlNumber}</strong>
                  </div>
                  <div className="pb-0.5">
                    <span className="text-slate-500 font-sans font-bold text-[8px] uppercase block">Código de Generación (UUID):</span>
                    <span className="text-slate-800 break-all text-[9.5px] block font-semibold leading-normal mt-0.5">{invoice.generationCode}</span>
                  </div>
                  <div className="pb-0.5">
                    <span className="text-slate-500 font-sans font-bold text-[8px] uppercase block">Sello de Recepción MH:</span>
                    <span className="text-emerald-800 break-all text-[9.5px] block font-bold leading-normal mt-0.5">{invoice.mhReceptionStamp}</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200 text-slate-600 font-sans text-[10px] flex justify-between items-center">
                    <span><strong>Fecha:</strong> {invoice.emissionDate}</span>
                    <span><strong>Hora:</strong> {invoice.emissionTime}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Receptor Information Box */}
            <div className="py-4 border-b border-slate-300 text-xs">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Receptor / Cliente
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-3 text-[11px] leading-normal">
                <div className="sm:col-span-2 print:col-span-2">
                  <span className="text-slate-500 block text-[10px]">Nombre / Razón Social:</span>
                  <p className="font-bold text-slate-900 text-xs mt-0.5">{invoice.clientName}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">{invoice.clientDocType}:</span>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">{invoice.clientDocNumber}</p>
                </div>
                {invoice.clientNrc && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">NRC:</span>
                    <p className="font-mono font-bold text-purple-700 mt-0.5">{invoice.clientNrc}</p>
                  </div>
                )}
                <div className={invoice.clientNrc ? 'sm:col-span-2 print:col-span-2' : 'sm:col-span-2 print:col-span-2'}>
                  <span className="text-slate-500 block text-[10px]">Dirección:</span>
                  <p className="text-slate-800 leading-normal break-words mt-0.5">{invoice.clientAddress}, {invoice.clientMunicipality}, {invoice.clientDepartment}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Condición / Pago:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {invoice.condition} {invoice.condition === 'CREDITO' ? `(${invoice.creditTermDays || 30} días)` : ''} ({invoice.paymentMethod === '01' ? 'Efectivo' : invoice.paymentMethod === '04' ? 'Transferencia' : 'Tarjeta'})
                  </p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-400 text-slate-700 font-bold uppercase text-[9px]">
                    <th className="py-2 text-center w-8">#</th>
                    <th className="py-2 text-center w-12">Cant.</th>
                    <th className="py-2">Descripción del Producto / Servicio</th>
                    <th className="py-2 text-right w-24">Precio Unit.</th>
                    <th className="py-2 text-right w-20">Descuento</th>
                    <th className="py-2 text-right w-24">Ventas Gravadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2 text-center font-mono font-bold text-slate-900">{item.quantity}</td>
                      <td className="py-2">
                        <span className="font-bold text-slate-900 block leading-tight">{item.description}</span>
                        {item.code && (
                          <span className="text-[9px] text-slate-400 font-mono block mt-0.5">Código: {item.code}</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono">${item.unitPrice.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono text-slate-500">${(item.discount || 0).toFixed(2)}</td>
                      <td className="py-2 text-right font-mono font-bold text-slate-900">${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Visual Divider between Table and Totals */}
            <hr className="border-t-2 border-slate-900 my-3" />

            {/* Bottom Summary: QR Code + Totals Box */}
            <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-6 items-start">
              {/* QR Code and MH Seal */}
              <div className="sm:col-span-6 print:col-span-6 flex items-center gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-300 flex flex-col items-center justify-center shrink-0 shadow-sm">
                  <QrCode className="w-14 h-14 text-slate-900" />
                  <span className="text-[7px] font-mono text-slate-600 font-bold uppercase mt-0.5">DTE HACIENDA</span>
                </div>
                <div className="text-[10px] text-slate-600 space-y-1 leading-normal">
                  <div className="flex items-center gap-1 text-emerald-800 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Documento Válido ante Hacienda</span>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-tight">
                    Escanee el código QR para validar este documento directamente en el portal oficial del Ministerio de Hacienda de El Salvador.
                  </p>
                  <p className="text-[8px] font-mono text-brand-700 leading-normal break-all">
                    factura.gob.sv/consultaPublica
                  </p>
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="sm:col-span-6 print:col-span-6 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Suma de Ventas Gravadas:</span>
                  <span className="font-mono font-bold text-slate-800">${invoice.subtotalGravado.toFixed(2)}</span>
                </div>
                {invoice.subtotalExento > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Suma de Ventas Exentas:</span>
                    <span className="font-mono">${invoice.subtotalExento.toFixed(2)}</span>
                  </div>
                )}
                {invoice.descuentoTotal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>(-) Monto de Descuentos:</span>
                    <span className="font-mono text-red-600">-${invoice.descuentoTotal.toFixed(2)}</span>
                  </div>
                )}
                
                {/* IVA 13% display based on DTE Type */}
                {invoice.dteType === '01' ? (
                  <div className="flex justify-between text-blue-900 font-medium">
                    <span>(IVA 13% Incluido en Precio):</span>
                    <span className="font-mono font-bold">${invoice.iva13.toFixed(2)}</span>
                  </div>
                ) : invoice.dteType === '05' ? (
                  <div className="flex justify-between text-rose-900 font-medium">
                    <span>(-) IVA 13% Débito Fiscal (Ajuste NC):</span>
                    <span className="font-mono font-bold">-${invoice.iva13.toFixed(2)}</span>
                  </div>
                ) : (invoice.dteType === '03' || invoice.dteType === '06' || invoice.iva13 > 0) ? (
                  <div className="flex justify-between text-purple-900 font-medium">
                    <span>(+) IVA 13% Débito Fiscal:</span>
                    <span className="font-mono font-bold">+${invoice.iva13.toFixed(2)}</span>
                  </div>
                ) : null}
                
                {invoice.retencion1 > 0 && (
                  <div className="flex justify-between text-amber-900 font-medium">
                    <span>(-) Retención IVA 1% (Gran Contribuyente):</span>
                    <span className="font-mono font-bold">-${invoice.retencion1.toFixed(2)}</span>
                  </div>
                )}
                {Boolean(invoice.percepcion1 && invoice.percepcion1 > 0) && (
                  <div className="flex justify-between text-emerald-900 font-medium">
                    <span>(+) Percepción IVA 1% (Agente de Percepción):</span>
                    <span className="font-mono font-bold">+${invoice.percepcion1!.toFixed(2)}</span>
                  </div>
                )}
                {invoice.retencionRenta10 > 0 && (
                  <div className="flex justify-between text-amber-900 font-medium">
                    <span>(-) Retención Renta 10% (Sujeto Excluido):</span>
                    <span className="font-mono font-bold">-${invoice.retencionRenta10.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t-2 border-slate-900 pt-2 mt-1.5 flex justify-between items-center">
                  <span className="text-xs sm:text-sm font-black text-slate-900 uppercase">Monto Total a Pagar:</span>
                  <span className="text-lg sm:text-xl font-black font-mono text-slate-900">
                    ${invoice.totalPagar.toFixed(2)}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 font-mono italic pt-1 leading-normal">
                  SON: {invoice.totalLetras}
                </p>
              </div>
            </div>

            {/* Observations */}
            {invoice.observations && (
              <div className="mt-4 pt-2 border-t border-slate-200 text-[10px] text-slate-600">
                <strong>Observaciones:</strong> {invoice.observations}
              </div>
            )}

            {/* Official Fiscal Footer & Resolution */}
            <div className="mt-8 pt-4 border-t border-slate-200 text-center space-y-1">
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">
                Representación Gráfica Oficial de Documento Tributario Electrónico (DTE) · Ministerio de Hacienda de El Salvador
              </p>
              <p className="text-[8px] text-slate-400 font-mono">
                Emitido conforme al Art. 29-A de la Ley de IVA y Art. 119-B del Código Tributario · Autorización DGII: RES-MH-DTE-2024-00492
              </p>
              <p className="text-[8px] text-slate-400">
                Plataforma Certificada SIVARCONTA · Verifique la autenticidad con el código QR o en factura.gob.sv
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
