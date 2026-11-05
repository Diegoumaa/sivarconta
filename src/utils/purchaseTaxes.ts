/** Explicitly recorded taxes from a received document; ISR and IVA never share a field. */
export function purchaseTaxes(base: number, exempt: number, kind: string, flags: { renta?: boolean; retain?: boolean; perceive?: boolean; perceptionBase?: number; retain13?: boolean; service?: boolean }) {
  if (![base, exempt].every(n => Number.isFinite(n) && n >= 0 && n <= 9999999.99)) throw new Error('Revisa los montos de la compra.');
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const ccf = kind === 'CCF' || kind === 'NOTA_CREDITO';
  const creditoFiscal = ccf ? round(base * .13) : 0;
  const retencion1 = ccf && flags.retain && base >= 100 ? round(base * .01) : 0;
  const eligible = flags.perceptionBase ?? base;
  const percepcion1 = ccf && flags.perceive && eligible >= 100 && eligible <= base ? round(eligible * .01) : 0;
  if (retencion1 && percepcion1) throw new Error('Revisa la calidad de agente de las partes: no apliques retención y percepción del 1 % a la misma operación.');
  const retencionIva13 = kind === 'SUJETO_EXCLUIDO' && flags.retain13 ? round(base * .13) : 0;
  const retencionRenta10 = flags.service && flags.renta && ['CCF','SUJETO_EXCLUIDO'].includes(kind) ? round(base * .1) : 0;
  return { creditoFiscal, retencion1, percepcion1, retencionIva13, retencionRenta10, totalPagar: round(base + exempt + creditoFiscal + percepcion1 - retencion1 - retencionIva13 - retencionRenta10) };
}
