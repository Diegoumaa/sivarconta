import type { BookReport } from './ivaBookReport';
import type { Company } from '../types';

/** Report for US Legal paper (14 × 8.5 in), with repeated table headings. */
export async function buildBookPdf(report: BookReport, company: Company, period: string) {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 9;
  const center = pageWidth / 2;
  const tableWidth = pageWidth - 2 * margin;
  const bottom = pageHeight - 15;
  const weight = report.widths.reduce((sum, width) => sum + width, 0);
  const widths = report.widths.map(width => width / weight * tableWidth);
  const identificationWidth = widths.slice(0, report.firstMoney).reduce((sum, width) => sum + width, 0);
  const signatureSpace = 20;
  let y = 0;

  type PdfCell = { value: string | number; width: number; align: 'left' | 'center' | 'right' };
  const row = (cells: PdfCell[], kind: 'group' | 'header' | 'data' | 'total', reserve = 0) => {
    const isHeading = kind === 'group' || kind === 'header';
    const shaded = kind !== 'data';
    const step = 3.55;
    doc.setFont('helvetica', shaded ? 'bold' : 'normal');
    doc.setFontSize(8);
    const lines: string[][] = cells.map(({ value, width, align }) =>
      doc.splitTextToSize(typeof value === 'number' && align === 'right' ? value.toFixed(2) : String(value), width - 3));
    const height = Math.max(7, ...lines.map(text => text.length * step + 3));
    if (!isHeading && y + height + reserve > bottom) {
      doc.addPage();
      pageHeader();
      if (y + height + reserve > bottom) {
        throw new Error('Una fila no cabe en el PDF. Descarga el libro en Excel para revisar todo su contenido.');
      }
    }
    doc.setFont('helvetica', shaded ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.15);
    let x = margin;
    cells.forEach(({ width, align }, index) => {
      if (shaded) {
        doc.setFillColor(kind === 'group' ? 226 : 241, kind === 'group' ? 232 : 245, kind === 'group' ? 240 : 249);
        doc.rect(x, y, width, height, 'FD');
      } else {
        doc.rect(x, y, width, height);
      }
      const textX = align === 'center' ? x + width / 2 : align === 'right' ? x + width - 1.5 : x + 1.5;
      const firstBaseline = y + (height - lines[index].length * step) / 2 + 2.65;
      lines[index].forEach((line, lineIndex) => doc.text(line, textX, firstBaseline + lineIndex * step, { align }));
      x += width;
    });
    y += height;
  };

  const pageHeader = () => {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const name: string[] = doc.splitTextToSize(company.name, tableWidth);
    name.forEach((line, index) => doc.text(line, center, 12 + index * 5, { align: 'center' }));
    const titleY = 18 + (name.length - 1) * 5;
    doc.setFontSize(10);
    doc.text(report.title, center, titleY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`NIT: ${company.nit}     NRC: ${company.nrc}`, center, titleY + 5, { align: 'center' });
    doc.text(`Período: ${period}`, center, titleY + 10, { align: 'center' });
    doc.text('Valores expresados en USD', center, titleY + 14, { align: 'center' });
    if (report.notice) {
      doc.setTextColor(146, 64, 14);
      doc.text(report.notice, center, titleY + 19, { align: 'center' });
    }
    y = titleY + (report.notice ? 24 : 20);
    let offset = 0;
    const groups = report.groups.map(({ label, span }): PdfCell => {
      const width = widths.slice(offset, offset + span).reduce((sum, value) => sum + value, 0);
      offset += span;
      return { value: label, width, align: 'center' };
    });
    row(groups, 'group');
    row(report.columns.map((value, index) => ({ value, width: widths[index], align: 'center' })), 'header');
  };

  pageHeader();
  report.rows.forEach((values, index) => {
    const cells = values.map((value, column): PdfCell => ({
      value, width: widths[column], align: column >= report.firstMoney ? 'right' : column < 2 ? 'center' : 'left',
    }));
    const finalRow = index === report.rows.length - 1;
    row(cells, 'data', finalRow ? signatureSpace + 7 : 0);
  });
  row([
    { value: 'TOTAL', width: identificationWidth, align: 'center' },
    ...report.totals.slice(report.firstMoney).map((value, index): PdfCell => ({
      value, width: widths[report.firstMoney + index], align: 'right',
    })),
  ], 'total', signatureSpace);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('F. _________________________', center, y + 13, { align: 'center' });
  doc.text('CONTADOR', center, y + 18, { align: 'center' });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(7.5);
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }
  return doc;
}

export async function exportBookPdf(report: BookReport, company: Company, period: string, filename: string) {
  const doc = await buildBookPdf(report, company, period);
  doc.save(filename);
}
