import { describe, expect, it, vi } from 'vitest';
import { InvoiceItem } from '../types';
import { calculateInvoiceTotals, generateControlNumber, generateUUID, numberToWordsSpanish } from '../utils/dteUtils';
import { checkDteRules, validateNit } from '../utils/svTaxValidators';

const item = (overrides: Partial<InvoiceItem> = {}): InvoiceItem => ({
  id: 'line-1', code: 'A', description: 'Producto', quantity: 1, unitPrice: 100,
  discount: 0, taxType: 'GRAVADO', unitOfMeasure: '59', taxAmount: 0, total: 100,
  ...overrides,
});

describe('Regresiones de montos y validación', () => {
  it.each([
    [1.999, 'DOS DÓLARES CON 00/100 USD'],
    [999.999, 'MIL DÓLARES CON 00/100 USD'],
    [0.005, 'CERO DÓLARES CON 01/100 USD'],
    [1.005, 'UN DÓLAR CON 01/100 USD'],
    [12.345, 'DOCE DÓLARES CON 35/100 USD'],
  ])('normaliza %s antes de separar dólares y centavos', (amount, expected) => {
    expect(numberToWordsSpanish(amount)).toBe(expected);
  });

  it.each([NaN, Infinity, -Infinity, -1])('rechaza un monto no representable en letras: %s', amount => {
    expect(() => numberToWordsSpanish(amount)).toThrow(RangeError);
  });

  it.each([NaN, Infinity, -Infinity, -1, 0])('bloquea emisión con total inválido: %s', amount => {
    expect(checkDteRules('01', amount, '02345678-3').isReady).toBe(false);
  });

  it('bloquea un tipo de DTE desconocido aunque el monto sea positivo', () => {
    expect(checkDteRules('99', 100, '02345678-3').isReady).toBe(false);
  });

  it.each(['023456784', '02345678-4'])('rechaza el mismo checksum NIT/DUI con y sin guion: %s', nit => {
    expect(validateNit(nit).isValid).toBe(false);
  });

  it('acepta el mismo NIT homologado válido con y sin guion', () => {
    expect(validateNit(' 023456783 ').isValid).toBe(true);
    expect(validateNit(' 02345678-3 ').isValid).toBe(true);
  });

  it('un descuento negativo no incrementa artificialmente la venta', () => {
    const result = calculateInvoiceTotals('03', [item({ discount: -10 })]);
    expect(result.descuentoTotal).toBe(0);
    expect(result.totalPagar).toBe(113);
  });

  it('no declara un descuento mayor al valor bruto del artículo', () => {
    const result = calculateInvoiceTotals('03', [item({ discount: 150 })]);
    expect(result.descuentoTotal).toBe(100);
    expect(result.subtotalGravado).toBe(0);
    expect(result.totalPagar).toBe(0);
  });

  it.each([
    { quantity: -2 }, { quantity: Infinity }, { unitPrice: NaN }, { unitPrice: -1 },
  ])('mantiene finita la previsualización durante la edición de %j', invalid => {
    const result = calculateInvoiceTotals('03', [item(invalid)]);
    expect(result.totalPagar).toBe(0);
    expect(result.totalLetras).toBe('CERO DÓLARES CON 00/100 USD');
  });

  it('aplica descuentos antes de calcular el IVA y respeta los montos exentos', () => {
    const result = calculateInvoiceTotals('03', [
      item({ quantity: 2, unitPrice: 60, discount: 20 }),
      item({ id: 'exento', unitPrice: 50, discount: 5, taxType: 'EXENTO' }),
    ]);
    expect(result).toMatchObject({ subtotalGravado: 100, subtotalExento: 45, descuentoTotal: 25, iva13: 13, totalPagar: 158 });
  });

  it('no duplica retención y percepción cuando ambas partes son grandes contribuyentes', () => {
    expect(calculateInvoiceTotals('03', [item()], true, true)).toMatchObject({ retencion1: 0, percepcion1: 0, totalPagar: 113 });
  });
});

describe('Identificadores de documento', () => {
  it.each([0, -1, 1.5, NaN, Infinity, 1000000000000000])('rechaza correlativo inválido: %s', correlative => {
    expect(() => generateControlNumber('01', correlative)).toThrow(RangeError);
  });

  it('admite el correlativo máximo de quince dígitos', () => {
    expect(generateControlNumber('03', 999999999999999, 'M002', 'P003')).toBe('DTE-03-M002P003-999999999999999');
  });

  it.each([['M1', 'P001'], ['m001', 'P001'], ['M001', 'P0001'], ['M-01', 'P001']])('rechaza códigos de longitud o formato inválido', (establishment, pos) => {
    expect(() => generateControlNumber('01', 1, establishment, pos)).toThrow(RangeError);
  });

  it('usa aleatoriedad criptográfica y no Math.random', () => {
    const insecure = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Insecure randomness'); });
    try {
      expect(generateUUID()).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
    } finally {
      insecure.mockRestore();
    }
  });
});
