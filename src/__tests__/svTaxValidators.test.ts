import { describe, it, expect } from 'vitest';
import {
  validateDui,
  validateNrc,
  validateNit,
  checkDteRules,
} from '../utils/svTaxValidators';

describe('svTaxValidators - DUI Checksum and Format Validation', () => {
  it('accepts mathematically valid DUI numbers', () => {
    // 02345678-3: sum=147, 147%10=7, 10-7=3 -> valid
    expect(validateDui('02345678-3').isValid).toBe(true);
    // 00000000-0: sum=0, 0%10=0, 0 -> valid
    expect(validateDui('00000000-0').isValid).toBe(true);
    // 00000001-8: sum=2, 2%10=2, 10-2=8 -> valid
    expect(validateDui('00000001-8').isValid).toBe(true);
  });

  it('rejects DUI with invalid checksum digit', () => {
    const res = validateDui('02345678-4');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('dígito verificador');
  });

  it('rejects DUI with incorrect pattern or missing hyphen', () => {
    expect(validateDui('023456783').isValid).toBe(false);
    expect(validateDui('0234-5678-3').isValid).toBe(false);
    expect(validateDui('ABCDEFGH-1').isValid).toBe(false);
    expect(validateDui('').isValid).toBe(false);
  });
});

describe('svTaxValidators - NRC Validation', () => {
  it('accepts valid NRC formats', () => {
    expect(validateNrc('123456-7').isValid).toBe(true);
    expect(validateNrc('1-9').isValid).toBe(true);
    expect(validateNrc('293847-1').isValid).toBe(true);
  });

  it('rejects malformed or empty NRCs', () => {
    expect(validateNrc('').isValid).toBe(false);
    expect(validateNrc('1234567').isValid).toBe(false); // missing hyphen
    expect(validateNrc('1234567890-1').isValid).toBe(false); // too many digits
    expect(validateNrc('ABCD-1').isValid).toBe(false);
  });
});

describe('svTaxValidators - NIT Validation', () => {
  it('accepts standard 14-digit legal entity NIT with hyphens', () => {
    expect(validateNit('0614-120520-101-1').isValid).toBe(true);
  });

  it('accepts standard 14-digit NIT without hyphens', () => {
    expect(validateNit('06141205201011').isValid).toBe(true);
  });

  it('accepts 9-digit DUI-homologated NIT with valid checksum', () => {
    expect(validateNit('02345678-3').isValid).toBe(true);
  });

  it('accepts 9-digit continuous NIT without hyphens', () => {
    expect(validateNit('023456783').isValid).toBe(true);
  });

  it('rejects invalid or empty NIT', () => {
    expect(validateNit('').isValid).toBe(false);
    expect(validateNit('123').isValid).toBe(false);
    expect(validateNit('invalid-nit-format').isValid).toBe(false);
  });
});

describe('svTaxValidators - DTE Business Rules (checkDteRules)', () => {
  it('blocks issuance if no client is registered or selected', () => {
    const res = checkDteRules('01', 50, '', '', false);
    expect(res.isReady).toBe(false);
    expect(res.blockers).toContain('Debe seleccionar o registrar al menos un cliente para emitir el comprobante.');
  });

  it('blocks issuance if total to pay is <= 0', () => {
    const res = checkDteRules('01', 0, '02345678-3', '', true);
    expect(res.isReady).toBe(false);
    expect(res.blockers).toContain('El monto total a pagar debe ser mayor a $0.00 USD.');
  });

  it('requires identification in DTE-01 from $25,000 or for deductions', () => {
    expect(checkDteRules('01', 24_999.99, '').isReady).toBe(true);
    expect(checkDteRules('01', 25_000, '').blockers[0]).toContain('$25,000.00 USD');
    expect(checkDteRules('01', 25_000, '02345678-3').isReady).toBe(true);
    expect(checkDteRules('01', 10, '', '', true, true).isReady).toBe(false);
    expect(checkDteRules('01', 10, '02345678-3', '', true, true).isReady).toBe(true);
  });

  it.each(['03', '05', '06', '14'])('requires identification in DTE-%s', type => {
    expect(checkDteRules(type, 10, '').isReady).toBe(false);
  });

  it('enforces client NRC on DTE-03 (Comprobante de Crédito Fiscal)', () => {
    const resNoNrc = checkDteRules('03', 100, '0614-120520-101-1', '', true);
    expect(resNoNrc.isReady).toBe(false);
    expect(resNoNrc.blockers[0]).toContain('DEBE tener un NRC registrado');

    const resWithNrc = checkDteRules('03', 100, '0614-120520-101-1', '123456-7', true);
    expect(resWithNrc.isReady).toBe(true);
  });

  it('enforces supplier doc number on DTE-14 (Sujeto Excluido)', () => {
    const resNoDoc = checkDteRules('14', 50, '', '', true);
    expect(resNoDoc.isReady).toBe(false);
    expect(resNoDoc.blockers[0]).toContain('Sujetos Excluidos (DTE-14)');

    const resWithDoc = checkDteRules('14', 50, '02345678-3', '', true);
    expect(resWithDoc.isReady).toBe(true);
  });
});
