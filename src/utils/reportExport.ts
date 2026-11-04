import { zipSync, strToU8 } from 'fflate';

export type ReportCell = string | number;
export const xmlText = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

/** A real OOXML workbook. Identifiers stay text, amounts stay numbers; no formulas from user text. */
export function buildBookXlsx(rows: ReportCell[][]): Uint8Array {
  const colName = (index: number) => { let result = ''; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result; return result; };
  const count = Math.max(9, ...rows.map(row => row.length));
  const lastCol = colName(count - 1);
  const widths = (rows[4] || []).map((label, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 8 : /Nombre|Cliente|Proveedor/i.test(String(label)) ? 36 : /documento|código|Del n|Al n/i.test(String(label)) ? 42 : /Fecha|Día/i.test(String(label)) ? 14 : 18}" customWidth="1"/>`).join('');
  const sheetRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => {
    let n = c + 1, col = '';
    while (n) { n--; col = String.fromCharCode(65 + n % 26) + col; n = Math.floor(n / 26); }
    const ref = `${col}${r + 1}`;
    return typeof v === 'number' ? `<c r="${ref}" s="${c === 0 ? 0 : 2}"><v>${Number.isFinite(v) ? v : 0}</v></c>`
      : `<c r="${ref}" s="${r < 4 ? 3 : r === 4 ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${xmlText(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const files: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Libro de IVA" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'Libro de IVA'!$1:$5</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0" borderId="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="4" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf fontId="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A5:${lastCol}${Math.max(5, rows.length - 4)}"/><mergeCells count="6"><mergeCell ref="A1:${lastCol}1"/><mergeCell ref="A2:${lastCol}2"/><mergeCell ref="A3:D3"/><mergeCell ref="E3:H3"/><mergeCell ref="I3:${lastCol}3"/><mergeCell ref="A4:${lastCol}4"/></mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup orientation="landscape" paperSize="1" fitToWidth="1" fitToHeight="0"/></worksheet>`
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));
}
