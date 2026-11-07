import type { F07Renta } from '../types';

export const saleOperations = {
  '1': 'Gravada', '2': 'No gravada o exenta', '3': 'Excluido o no constituye renta', '4': 'Mixta',
  '12': 'Ingresos sujetos a retención informados', '13': 'Sujetos pasivos excluidos',
};
export const saleIncomes = {
  '1': 'Profesiones, artes y oficios', '2': 'Servicios', '3': 'Comercio', '4': 'Industria', '5': 'Agropecuarias',
  '6': 'Utilidades y dividendos', '7': 'Exportación de bienes', '8': 'Servicios del exterior',
  '9': 'Exportación de servicios', '10': 'Otras rentas gravables', '12': 'Ingresos sujetos a retención',
  '13': 'Sujetos pasivos excluidos',
};
export const purchaseOperations = {
  '1': 'Gravada', '2': 'No gravada o exenta', '3': 'Excluido o no constituye renta', '4': 'Mixta',
  '9': 'Excepción: cuatro campos con código 9',
};
export const purchaseClassifications = { '1': 'Costo', '2': 'Gasto' };
export const purchaseSectors = { '1': 'Industria', '2': 'Comercio', '3': 'Agropecuaria', '4': 'Servicios, profesiones, artes y oficios' };
const purchaseCosts: Record<string, string> = {
  '1': 'Venta sin donación', '2': 'Administración sin donación', '3': 'Financieros sin donación',
  '4': 'Costo de artículos de importación o internación', '5': 'Costo de artículos comprados o producidos localmente',
  '6': 'Costos indirectos de fabricación', '7': 'Mano de obra', '8': 'Operación informada en más de un anexo',
};

export function f07CostOptions({ classification, sector }: F07Renta) {
  const codes = classification === '2' ? ['1', '2', '3', '8']
    : classification === '1' ? ['4', '5', ...(sector === '1' ? ['6', '7'] : []), '8'] : [];
  return Object.fromEntries(codes.map(code => [code, purchaseCosts[code]]));
}

export function validF07Renta(kind: 'purchase' | 'sale', codes?: F07Renta): boolean {
  if (!codes) return false;
  const includes = (options: Record<string, string>, code?: string) => !!code && Object.keys(options).includes(code);
  if (kind === 'sale') return includes(saleOperations, codes.operation) && includes(saleIncomes, codes.income);
  if (codes.operation === '9') return codes.classification === '9' && codes.sector === '9' && codes.cost === '9';
  return includes(purchaseOperations, codes.operation) && includes(purchaseClassifications, codes.classification)
    && includes(purchaseSectors, codes.sector) && includes(f07CostOptions(codes), codes.cost);
}

export function isF07Purchase(docType: string) {
  return docType === 'CCF' || docType === 'NOTA_CREDITO';
}

export function f07SaleKind(dteType: string) {
  if (dteType === '01') return 'ventas_consumidor';
  if (['03', '05', '06'].includes(dteType)) return 'ventas_contribuyente';
}

export function needsF07Renta(kind: 'purchase' | 'sale', emissionDate: string) {
  return emissionDate >= (kind === 'purchase' ? '2024-02-01' : '2025-01-01');
}
