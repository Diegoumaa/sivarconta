import { DteType, InvoiceItem } from '../types';

export function generateUUID(): string {
  // Generation codes identify documents; use the browser's secure random source.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID().toUpperCase();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase();
}

export function generateControlNumber(dteType: DteType, correlative: number, establishment = 'M001', pos = 'P001'): string {
  if (!['01', '03', '05', '06', '14'].includes(dteType)) {
    throw new RangeError('Tipo de DTE no soportado.');
  }
  if (!Number.isSafeInteger(correlative) || correlative < 1 || correlative > 999999999999999) {
    throw new RangeError('El correlativo debe ser un entero positivo de hasta 15 dígitos.');
  }
  if (!/^[A-Z0-9]{4}$/.test(establishment) || !/^[A-Z0-9]{4}$/.test(pos)) {
    throw new RangeError('Los códigos de establecimiento y punto de venta deben tener 4 caracteres alfanuméricos en mayúsculas.');
  }
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
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER / 100) {
    throw new RangeError('El monto debe ser finito, no negativo y expresable en centavos.');
  }
  // Round the complete amount first so 1.999 becomes two dollars, not 100 cents.
  const totalCents = Math.round((amount + Number.EPSILON * Math.max(1, amount)) * 100);
  const integerPart = Math.floor(totalCents / 100);
  const decimalPart = totalCents % 100;

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
  } else if (integerPart < 1000000000) {
    const millions = Math.floor(integerPart / 1000000);
    const remainder = integerPart % 1000000;
    const millWords = millions === 1 ? 'UN MILLÓN' : convertGroup(millions) + ' MILLONES';
    let remWords = '';
    if (remainder > 0) {
      if (remainder < 1000) {
        remWords = ' ' + convertGroup(remainder);
      } else {
        const thousands = Math.floor(remainder / 1000);
        const subRemainder = remainder % 1000;
        const thWords = thousands === 1 ? 'MIL' : convertGroup(thousands) + ' MIL';
        remWords = ' ' + thWords + (subRemainder > 0 ? ' ' + convertGroup(subRemainder) : '');
      }
    }
    words = millWords + remWords;
  } else {
    words = String(integerPart);
  }

  const cents = String(decimalPart).padStart(2, '0');
  const needsDe = words.trim().endsWith('MILLÓN') || words.trim().endsWith('MILLONES');
  const currency = integerPart === 1 ? 'DÓLAR' : (needsDe ? 'DE DÓLARES' : 'DÓLARES');
  return `${words.trim()} ${currency} CON ${cents}/100 USD`;
}

export const generateGenerationCode = generateUUID;

export function calculateInvoiceTotals(
  dteType: DteType,
  items: InvoiceItem[],
  clientIsGranContribuyente = false,
  companyIsGranContribuyente = false
) {
  let rawGravado = 0;
  let rawExento = 0;
  let rawNoSujeto = 0;
  let rawDescuento = 0;

  items.forEach(item => {
    // Keep the live preview finite while a numeric field is being edited.
    const nonNegative = (value: number) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    const qty = nonNegative(item.quantity);
    const price = nonNegative(item.unitPrice);
    const lineTotal = Number.isFinite(qty * price) ? qty * price : 0;
    const disc = Math.min(lineTotal, nonNegative(item.discount));
    const lineNet = lineTotal - disc;
    rawDescuento += disc;

    if (item.taxType === 'GRAVADO') {
      rawGravado += lineNet;
    } else if (item.taxType === 'EXENTO') {
      rawExento += lineNet;
    } else {
      rawNoSujeto += lineNet;
    }
  });

  const subtotalGravado = Number(rawGravado.toFixed(2));
  const subtotalExento = Number(rawExento.toFixed(2));
  const subtotalNoSujeto = Number(rawNoSujeto.toFixed(2));
  const descuentoTotal = Number(rawDescuento.toFixed(2));

  let iva13 = 0;
  let retencion1 = 0;
  let percepcion1 = 0;
  let retencionRenta10 = 0;
  let totalPagar = 0;

  if (dteType === '03' || dteType === '05' || dteType === '06') {
    // Comprobante de Crédito Fiscal / Nota Crédito / Débito: IVA 13% explícito
    iva13 = Number((subtotalGravado * 0.13).toFixed(2));
    
    // Regla de Retención y Percepción 1% en El Salvador (Art. 162-163 Código Tributario):
    // Aplica únicamente si la operación gravada es >= $100.00 USD
    if (subtotalGravado >= 100) {
      if (clientIsGranContribuyente && !companyIsGranContribuyente) {
        // El cliente (comprador) es Gran Contribuyente: Retiene 1% de IVA
        retencion1 = Number((subtotalGravado * 0.01).toFixed(2));
      } else if (companyIsGranContribuyente && !clientIsGranContribuyente) {
        // La empresa emisora (vendedora) es Gran Contribuyente: Percibe 1% de IVA
        percepcion1 = Number((subtotalGravado * 0.01).toFixed(2));
      }
    }
    
    totalPagar = Number(
      (subtotalGravado + subtotalExento + subtotalNoSujeto + iva13 - retencion1 + percepcion1).toFixed(2)
    );
  } else if (dteType === '14') {
    // Factura Sujeto Excluido: Retención 10% de Impuesto sobre la Renta (Art. 156 CT)
    // No causa IVA
    retencionRenta10 = Number((subtotalGravado * 0.10).toFixed(2));
    totalPagar = Number(
      (subtotalGravado + subtotalExento + subtotalNoSujeto - retencionRenta10).toFixed(2)
    );
  } else {
    // DTE-01 (Factura Consumidor Final): IVA 13% incluido en el total
    iva13 = Number(((subtotalGravado / 1.13) * 0.13).toFixed(2));
    totalPagar = Number(
      (subtotalGravado + subtotalExento + subtotalNoSujeto).toFixed(2)
    );
  }

  return {
    subtotalGravado,
    subtotalExento,
    subtotalNoSujeto,
    descuentoTotal,
    iva13,
    retencion1,
    percepcion1,
    retencionRenta10,
    totalPagar,
    totalLetras: numberToWordsSpanish(totalPagar)
  };
}
