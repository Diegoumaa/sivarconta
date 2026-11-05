import type { IvaAnnexData, IvaAnnexRecord, SpecialAnnex } from '../types/ivaAnnex';

// Source: MH F07 v14, revision 24/07/2025, sections VI–XIV and XIX.
export const SPECIAL_ANNEXES: Record<SpecialAnnex, { number: string; label: string; rate?: number; types?: string[] }> = {
  '108': { number: '4', label: '108 · Ventas por cuenta de terceros', types: ['01', '03', '05', '06', '11'] },
  '66': { number: '5', label: '66 · Compras a sujetos excluidos' },
  '161': { number: '6', label: '161 · Anticipo 2 % recibido', rate: 2 },
  '162': { number: '7', label: '162 · Retención 1 % recibida', rate: 1, types: ['05', '06', '07'] },
  '163': { number: '8', label: '163 · Percepción 1 % recibida', rate: 1, types: ['03', '05', '06', '12'] },
  '169': { number: '9', label: '169 · Percepción 1 % practicada', rate: 1, types: ['03', '05', '06'] },
  '170': { number: '10', label: '170 · Retención 1 % practicada', rate: 1, types: ['05', '06', '07'] },
  '171': { number: '11', label: '171 · Anticipo 2 % practicado', rate: 2 },
  '172': { number: '12', label: '172 · Retención IVA 13 % practicada', rate: 13, types: ['05', '06', '07'] },
  documentos: { number: 'DOC', label: 'Documentos anulados, invalidados o extraviados', types: ['01','02','03','04','05','06','07','08','09','10','11','14'] }
};
export const emptyAnnexData = (): IvaAnnexData => ({ documentClass: '1', partyDocType: 'NIT', partyDoc: '', partyName: '', docType: '07', series: '', resolution: '', documentNumber: '', generationCode: '', amount: '', taxAmount: '', operation: '', classification: '', sector: '', cost: '', settlementClass: '1', settlementSeries: '', settlementResolution: '', settlementNumber: '', settlementGenerationCode: '', settlementDate: '', detailType: 'A', preprintedFrom: '', preprintedTo: '', from: '', to: '' });
const compact = (s: string) => s.replace(/[-/]/g, '').toUpperCase();
const uuid = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
const fail = (s: string): never => { throw new Error(s); };
function text(s: string, label: string, max = 100, optional = false) {
  if (typeof s !== 'string' || (!optional && !s.trim()) || s.length > max || /[;"\x00-\x1f]/.test(s) || /^\s*[=+@-]/.test(s)) fail(`Revisa ${label}: falta el dato o contiene caracteres incompatibles con el CSV.`);
  return s.trim();
}
function date(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) fail('La fecha del comprobante no es válida.');
  return s.split('-').reverse().join('/');
}
function money(s: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(s) || !Number.isFinite(Number(s)) || Number(s) > 9999999.99) fail('Los montos deben tener hasta dos decimales, sin negativos ni separadores de miles, y ocupar como máximo 10 caracteres.');
  const value = Number(s).toFixed(2);
  if (value.length > 10) fail('El monto supera los 10 caracteres admitidos por Hacienda.');
  return value;
}
function document(d: IvaAnnexData, when: string, settlement = false) {
  const cls = settlement ? d.settlementClass : d.documentClass;
  const series = text(settlement ? d.settlementSeries : d.series, 'serie o sello');
  const number = text(settlement ? d.settlementNumber : d.documentNumber, 'número de documento');
  const resolution = settlement ? d.settlementResolution : d.resolution;
  const generation = settlement ? d.settlementGenerationCode : d.generationCode;
  if (!['1','2','4'].includes(cls)) fail('Selecciona la clase real del comprobante.');
  if (cls !== '4') return { series: series.toUpperCase(), number, resolution: resolution.toUpperCase() };
  if (!/^[A-Z0-9]{40}$/i.test(series) || !uuid.test(generation)) fail('El DTE requiere su sello real de 40 caracteres y código de generación UUID.');
  const control = text(number, 'número de control');
  if (!/^DTE-\d{2}-[A-Z0-9]{8}-\d{15}$/i.test(control)) fail('El número de control del DTE debe tener el formato DTE-XX-XXXXXXXX-000000000000001.');
  return { series: series.toUpperCase(), number: compact(when < '2022-11-01' ? control : generation), resolution: compact(when < '2022-11-01' ? generation : control) };
}

export function specialAnnexRow(r: IvaAnnexRecord): string[] {
  const spec = SPECIAL_ANNEXES[r.annex];
  if (!spec) fail('Anexo no reconocido.');
  const d = r.data, day = date(r.emissionDate), doc = document(d, r.emissionDate);
  if (spec.types && !spec.types.includes(d.docType)) fail('Este tipo de documento no corresponde a la casilla seleccionada.');
  if (r.annex === 'documentos') {
    if (d.documentClass === '4') {
      if (d.detailType !== 'D') fail('Un DTE invalidado se informa con detalle D.');
      return [d.documentNumber.toUpperCase(), '4', '0', '0', d.docType, 'D', doc.series, '0', '0', d.generationCode.toUpperCase()];
    }
    if (!['A','X'].includes(d.detailType)) fail('El documento impreso requiere detalle A (anulado) o X (extraviado).');
    for (const [a,b] of [[d.from,d.to], [d.preprintedFrom,d.preprintedTo]]) {
      if (!/^\d{1,100}$/.test(a) || !/^\d{1,100}$/.test(b) || BigInt(a) > BigInt(b)) fail('Revisa los rangos inicial y final de los documentos.');
    }
    return [compact(text(doc.resolution, 'resolución')), d.documentClass, d.preprintedFrom, d.preprintedTo, d.docType, d.detailType, doc.series, d.from, d.to, ''];
  }
  const id = compact(text(d.partyDoc, 'identificación de la contraparte', 20));
  if (d.partyDocType === 'NIT' ? !/^\d{14}$/.test(id) : d.partyDocType === 'DUI' ? !/^\d{9}$/.test(id) || r.emissionDate < '2022-01-01' : d.partyDocType === 'NRC' ? r.annex !== '108' || !/^\d{1,8}$/.test(id) : r.annex !== '66' || !/^[A-Z0-9]{1,14}$/.test(id)) fail('Revisa el tipo y número de identificación de la contraparte.');
  const nit = d.partyDocType === 'DUI' ? '' : id, dui = d.partyDocType === 'DUI' ? id : '';
  const base = money(d.amount), tax = money(d.taxAmount);
  if (Number(base) <= 0) fail('La base del comprobante debe ser mayor que cero.');
  const rate = spec.rate ?? (r.annex === '66' ? 13 : undefined);
  if (rate && !(r.annex === '66' && Number(tax) === 0) && Math.abs(Math.round(Number(base) * rate) - Math.round(Number(tax) * 100)) > 1) fail(`El importe debe corresponder al ${rate} % de la base sujeta (tolerancia de un centavo).`);
  if (r.annex === '108') {
    const settle = document(d, d.settlementDate, true);
    return [nit, text(d.partyName, 'nombre del mandante', 500), day, d.docType, doc.series, text(doc.resolution, 'resolución'), doc.number, base, tax, settle.series, text(settle.resolution, 'resolución de liquidación'), settle.number, date(d.settlementDate), dui, '4'];
  }
  if (r.annex === '66') {
    const historical = r.emissionDate < '2024-02-01';
    const codes = historical ? ['0','0','0','0'] : [d.operation,d.classification,d.sector,d.cost];
    if (!historical && (!['1','2','3','4','8','9'].includes(d.operation) || !['1','2','9'].includes(d.classification) || !['1','2','3','4','9'].includes(d.sector) || !['1','2','3','4','5','6','7','8','9'].includes(d.cost))) fail('Completa los cuatro códigos de renta de esta compra a sujeto excluido.');
    return [d.partyDocType === 'NIT' ? '1' : d.partyDocType === 'DUI' ? '2' : '3', id, text(d.partyName, 'nombre del sujeto excluido', 500), day, doc.series, doc.number, base, tax, ...codes, '5'];
  }
  if (r.annex === '161') return [nit, day, doc.series, doc.number, base, tax, dui, '6'];
  if (r.annex === '162' || r.annex === '163') return [nit, day, d.docType, doc.series, doc.number, base, tax, dui, spec.number];
  if (r.annex === '171') return [nit, day, text(doc.resolution, 'resolución'), doc.series, doc.number, base, tax, dui, '11'];
  if (r.annex === '172') return [nit, day, d.docType, doc.series, text(doc.resolution, 'resolución'), doc.number, base, tax, dui, '12'];
  return [nit, day, d.docType, text(doc.resolution, 'resolución'), doc.series, doc.number, base, tax, dui, spec.number];
}

export const annexSign = (r: IvaAnnexRecord) => r.data.docType === '05' ? -1 : 1;
export function buildSpecialF07(annex: SpecialAnnex, records: IvaAnnexRecord[], period: string): string {
  const rows = records.filter(r => r.annex === annex && !r.voided && r.emissionDate.startsWith(period + '-')).sort((a,b) => `${a.emissionDate}${a.id}`.localeCompare(`${b.emissionDate}${b.id}`));
  if (!rows.length) fail('No hay comprobantes registrados para este anexo y período.');
  const seen = new Set<string>();
  return rows.map(r => {
    const row = specialAnnexRow(r), key = `${r.data.partyDocType}:${compact(r.data.partyDoc)}:${r.data.docType}:${r.data.documentClass}:${compact(r.data.documentClass === '4' ? r.data.generationCode : r.data.series + ':' + r.data.documentNumber)}`;
    if (seen.has(key)) fail('Hay un comprobante duplicado en el anexo.');
    seen.add(key);
    return row.join(';');
  }).join('\r\n') + '\r\n';
}
