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
export function buildBookXlsx(rows: ReportCell[][], columnWidths: number[], firstMoney: number): Uint8Array {
  const colName = (index: number) => { let result = ''; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result; return result; };
  const headingRows = 5;
  const columnHeaderRow = headingRows + 1;
  const totalRow = rows.length - 3;
  const lastCol = colName(columnWidths.length - 1);
  const widths = columnWidths.map((pixels, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.round(pixels / 7)}" customWidth="1"/>`).join('');
  const fullWidthRows = [1, 2, 3, 4, 5, rows.length - 1, rows.length];
  const merges = fullWidthRows.map(row => `A${row}:${lastCol}${row}`);
  if (firstMoney > 1) merges.push(`A${totalRow}:${colName(firstMoney - 1)}${totalRow}`);
  const sheetRows = rows.map((row, index) => {
    const number = index + 1;
    const cells = row.map((value, column) => {
      const ref = `${colName(column)}${number}`;
      const money = typeof value === 'number' && column >= firstMoney;
      const style = number <= 2 ? 3 : fullWidthRows.includes(number) ? 4
        : number === columnHeaderRow ? 1 : number === totalRow ? money ? 6 : 5
        : money ? 2 : 0;
      return typeof value === 'number'
        ? `<c r="${ref}" s="${style}"><v>${Number.isFinite(value) ? value : 0}</v></c>`
        : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
    }).join('');
    const height = number === columnHeaderRow ? ' ht="32" customHeight="1"' : '';
    return `<row r="${number}"${height}>${cells}</row>`;
  }).join('');
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const files: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Libro de IVA" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'Libro de IVA'!$1:$${columnHeaderRow}</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">'Libro de IVA'!$A$1:$${lastCol}$${rows.length}</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="7">
      <xf borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
      <xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
      <xf numFmtId="4" borderId="1" applyNumberFormat="1" applyBorder="1"/>
      <xf fontId="1" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
      <xf applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
      <xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
      <xf numFmtId="4" fontId="1" fillId="2" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
    </cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${columnHeaderRow}" topLeftCell="A${columnHeaderRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A${columnHeaderRow}:${lastCol}${totalRow - 1}"/><mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup orientation="landscape" paperSize="5" fitToWidth="1" fitToHeight="0"/></worksheet>`
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));
}
