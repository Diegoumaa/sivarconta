/**
 * Validadores tributarios oficiales para El Salvador
 * Implementa las reglas de la DGII del Ministerio de Hacienda
 */

export function validateDui(dui: string): { isValid: boolean; error?: string } {
  if (!dui || typeof dui !== 'string') {
    return {
      isValid: false,
      error: 'El número de DUI no puede estar vacío.'
    };
  }

  const cleanDui = dui.trim();
  const duiRegex = /^\d{8}-\d$/;
  
  if (!duiRegex.test(cleanDui)) {
    return { 
      isValid: false, 
      error: 'Formato de DUI incorrecto. Debe tener 8 dígitos, guion y dígito verificador (ej. 02345678-3).' 
    };
  }

  const digits = cleanDui.replace('-', '').split('').map(Number);
  const checkDigit = digits[8];
  const weights = [9, 8, 7, 6, 5, 4, 3, 2];

  const sum = weights.reduce((acc, weight, i) => acc + weight * digits[i], 0);
  const remainder = sum % 10;
  const calculatedCheckDigit = remainder === 0 ? 0 : 10 - remainder;

  if (checkDigit !== calculatedCheckDigit) {
    return { 
      isValid: false, 
      error: 'El dígito verificador del DUI no coincide. Verifica que esté bien escrito.' 
    };
  }

  return { isValid: true };
}

export function validateNrc(nrc: string): { isValid: boolean; error?: string } {
  if (!nrc || typeof nrc !== 'string') {
    return {
      isValid: false,
      error: 'El NRC no puede estar vacío.'
    };
  }

  const cleanNrc = nrc.trim();
  const nrcRegex = /^\d{1,8}-\d$/;
  if (!nrcRegex.test(cleanNrc)) {
    return { 
      isValid: false, 
      error: 'Formato de NRC inválido. Debe contener entre 1 y 8 dígitos, guion y dígito verificador (ej. 123456-7).' 
    };
  }
  return { isValid: true };
}

/**
 * Validador de NIT salvadoreño:
 * - NIT Jurídico tradicional: 14 dígitos con guiones (ej. 0614-120520-101-1)
 * - NIT Homologado a DUI (personas naturales): 9 dígitos (ej. 02345678-3 o 023456783)
 */
export function validateNit(nit: string): { isValid: boolean; error?: string } {
  if (!nit || typeof nit !== 'string') {
    return {
      isValid: false,
      error: 'El NIT no puede estar vacío.'
    };
  }

  const cleanNit = nit.trim();
  const nit14Regex = /^\d{4}-\d{6}-\d{3}-\d$/;
  const nit14NoDashRegex = /^\d{14}$/;
  const nitDuiRegex = /^\d{8}-\d$/;
  const nitDuiNoDashRegex = /^\d{9}$/;

  if (nit14Regex.test(cleanNit) || nit14NoDashRegex.test(cleanNit)) {
    return { isValid: true };
  }

  if (nitDuiRegex.test(cleanNit) || nitDuiNoDashRegex.test(cleanNit)) {
    // Si viene en formato DUI con guion, validamos dígito verificador
    if (nitDuiRegex.test(cleanNit)) {
      return validateDui(cleanNit);
    }
    return { isValid: true };
  }

  return {
    isValid: false,
    error: 'Formato de NIT inválido. Debe ser de 14 dígitos (ej. 0614-120520-101-1) o 9 dígitos homologado a DUI (ej. 02345678-3).'
  };
}

export function checkDteRules(
  dteType: string,
  totalPagar: number,
  clientDocNumber?: string,
  clientNrc?: string,
  hasClient: boolean = true
): { isReady: boolean; warnings: string[]; blockers: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!hasClient) {
    blockers.push('Debe seleccionar o registrar al menos un cliente para emitir el comprobante.');
    return { isReady: false, warnings, blockers };
  }

  if (totalPagar <= 0) {
    blockers.push('El monto total a pagar debe ser mayor a $0.00 USD.');
  }

  // Regla $200 USD en DTE-01 (Factura Consumidor Final) - Art. 119-B Código Tributario
  if (dteType === '01' && totalPagar >= 200) {
    if (!clientDocNumber || clientDocNumber.trim() === '') {
      blockers.push('En ventas mayores o iguales a $200.00 USD, Hacienda exige obligatoriamente registrar el DUI o NIT del cliente.');
    }
  }

  // Regla NRC obligatorio en DTE-03 (Crédito Fiscal)
  if (dteType === '03') {
    if (!clientNrc || clientNrc.trim() === '') {
      blockers.push('Para emitir Comprobante de Crédito Fiscal (DTE-03), el cliente DEBE tener un NRC registrado.');
    }
  }

  // Regla Sujeto Excluido DTE-14
  if (dteType === '14') {
    if (!clientDocNumber || clientDocNumber.trim() === '') {
      blockers.push('Para compras a Sujetos Excluidos (DTE-14), el documento (DUI/NIT) del proveedor es obligatorio.');
    }
  }

  return {
    isReady: blockers.length === 0,
    warnings,
    blockers
  };
}

