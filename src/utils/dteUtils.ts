import { DteType, InvoiceItem } from '../types';

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
}

export function generateControlNumber(dteType: DteType, correlative: number, establishment = 'M001', pos = 'P001'): string {
  const padCorrelative = String(correlative).padStart(15, '0');
  return `DTE-${dteType}-${establishment}${pos}-${padCorrelative}`;
}

export function generateReceptionStamp(): string {
  const chars = '0123456789ABCDEF';
  let stamp = '';
  for (let i = 0; i < 40; i++) {
    stamp += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return stamp;
}

export function getMhQrUrl(generationCode: string, emissionDate: string, env: 'PRUEBAS' | 'PRODUCCION' = 'PRUEBAS'): string {
  const ambienteCode = env === 'PRODUCCION' ? '01' : '00';
  return `https://admin.factura.gob.sv/consultaPublica?ambiente=${ambienteCode}&codGen=${generationCode}&fechaEmi=${emissionDate}`;
}

export function numberToWordsSpanish(amount: number): string {
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const tens = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const specialTens: Record<number, string> = {
    11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
    16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
    21: 'VEINTIUNO', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO', 25: 'VEINTICINCO',
    26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
  };
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function convertGroup(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';

    let output = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;

    if (h > 0) output += hundreds[h] + ' ';

    if (remainder > 10 && remainder < 20) {
      output += specialTens[remainder] + ' ';
    } else if (remainder > 20 && remainder < 30) {
      output += specialTens[remainder] + ' ';
    } else {
      if (t > 0) {
        output += tens[t];
        if (u > 0) output += ' Y ' + units[u];
        output += ' ';
      } else if (u > 0) {
        output += units[u] + ' ';
      }
    }
    return output.trim();
  }

  let words = '';
  if (integerPart === 0) {
    words = 'CERO';
  } else if (integerPart < 1000) {
    words = convertGroup(integerPart);
  } else if (integerPart < 1000000) {
    const thousands = Math.floor(integerPart / 1000);
    const remainder = integerPart % 1000;
    const thWords = thousands === 1 ? 'MIL' : convertGroup(thousands) + ' MIL';
    words = thWords + (remainder > 0 ? ' ' + convertGroup(remainder) : '');
  } else {
    words = String(integerPart);
  }

  const cents = String(decimalPart).padStart(2, '0');
  return `${words} DÓLARES CON ${cents}/100 USD`;
}

export function calculateInvoiceTotals(
  dteType: DteType,
  items: InvoiceItem[],
  clientIsGranContribuyente = false,
  companyIsGranContribuyente = false
) {
  let subtotalGravado = 0;
  let subtotalExento = 0;
  let subtotalNoSujeto = 0;
  let totalDescuento = 0;

  items.forEach(item => {
    const lineTotal = item.quantity * item.unitPrice;
    const lineNet = Math.max(0, lineTotal - (item.discount || 0));
    totalDescuento += item.discount || 0;

    if (item.taxType === 'GRAVADO') {
      subtotalGravado += lineNet;
    } else if (item.taxType === 'EXENTO') {
      subtotalExento += lineNet;
    } else {
      subtotalNoSujeto += lineNet;
    }
  });

  let iva13 = 0;
  let retencion1 = 0;
  let percepcion1 = 0;
  let retencionRenta10 = 0;
  let totalPagar = 0;

  if (dteType === '03' || dteType === '05' || dteType === '06') {
    // Comprobante de Crédito Fiscal: IVA 13% explícito
    iva13 = subtotalGravado * 0.13;
    
    // Regla de Retención y Percepción 1% en El Salvador (Art. 162-163 Código Tributario):
    // Aplica únicamente si la operación gravada es >= $100.00
    if (subtotalGravado >= 100) {
      if (clientIsGranContribuyente && !companyIsGranContribuyente) {
        // El cliente (comprador) es Gran Contribuyente: Retiene 1% de IVA
        retencion1 = subtotalGravado * 0.01;
      } else if (companyIsGranContribuyente && !clientIsGranContribuyente) {
        // La empresa emisora (vendedora) es Gran Contribuyente: Percibe 1% de IVA
        percepcion1 = subtotalGravado * 0.01;
      }
    }
    
    totalPagar = subtotalGravado + subtotalExento + subtotalNoSujeto + iva13 - retencion1 + percepcion1;
  } else if (dteType === '14') {
    // Factura Sujeto Excluido: Retención 10% de Impuesto sobre la Renta
    retencionRenta10 = subtotalGravado * 0.10;
    totalPagar = subtotalGravado - retencionRenta10;
  } else {
    // DTE-01 (Factura Consumidor Final): IVA 13% incluido en el total
    iva13 = (subtotalGravado / 1.13) * 0.13;
    totalPagar = subtotalGravado + subtotalExento + subtotalNoSujeto;
  }

  return {
    subtotalGravado: Number(subtotalGravado.toFixed(2)),
    subtotalExento: Number(subtotalExento.toFixed(2)),
    subtotalNoSujeto: Number(subtotalNoSujeto.toFixed(2)),
    descuentoTotal: Number(totalDescuento.toFixed(2)),
    iva13: Number(iva13.toFixed(2)),
    retencion1: Number(retencion1.toFixed(2)),
    percepcion1: Number(percepcion1.toFixed(2)),
    retencionRenta10: Number(retencionRenta10.toFixed(2)),
    totalPagar: Number(totalPagar.toFixed(2)),
    totalLetras: numberToWordsSpanish(Number(totalPagar.toFixed(2)))
  };
}
