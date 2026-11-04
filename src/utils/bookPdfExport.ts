import type { BookReport } from './ivaBookReport';
import type { Company } from '../types';

/** Text PDF with repeated headings and intact table rows across pages. */
export async function exportBookPdf(report: BookReport, company: Company, period: string, filename: string) {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const left = 9, width = 261.4, bottom = 198;
  const weights = report.columns.map((_, c) => c === 0 ? 0.55 : c === 2 || (report.title.includes('CONSUMIDOR') && c <= 5 && c >= 2) ? 2.5 : c === 3 && !report.title.includes('COMPRAS') ? 2.5 : c === 4 && report.title.includes('COMPRAS') ? 2.5 : c === 1 ? 1.25 : 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0), widths = weights.map(w => w * width / totalWeight);
  let y = 0;
  const tableRow = (cells: (string | number)[], header = false, total = false) => {
    doc.setFontSize(header ? 7 : 6.8); doc.setFont('helvetica', header || total ? 'bold' : 'normal');
    const firstMoney = report.title.includes('CONSUMIDOR') ? 7 : 5;
    const totalLabelWidth = widths.slice(0, firstMoney).reduce((a, b) => a + b, 0);
    const lines = cells.map((c, col) => doc.splitTextToSize(typeof c === 'number' && col >= firstMoney ? c.toFixed(2) : String(c), (total && col === 0 ? totalLabelWidth : widths[col]) - 2));
    const height = Math.max(7, ...lines.map(l => l.length * 3 + 2));
    if (height > 140) throw new Error('Una fila es demasiado extensa para una página. Descarga el libro de Excel para conservar todo su contenido.');
    if (!header && y + height > bottom) { doc.addPage(); pageHeader(); }
    let x = left;
    cells.forEach((cell, col) => {
      if (total && col > 0 && col < firstMoney) return;
      const cellWidth = total && col === 0 ? totalLabelWidth : widths[col];
      if (header || total) { doc.setFillColor(238, 242, 246); doc.rect(x, y, cellWidth, height, 'F'); }
      doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.15); doc.rect(x, y, cellWidth, height);
      doc.setTextColor(15, 23, 42); doc.text(lines[col], x + 1, y + 3.6);
      x += cellWidth;
    }); y += height;
  };
  const pageHeader = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(company.name, left, 13);
    doc.setFontSize(9); doc.text(report.title, left, 19);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(`NIT: ${company.nit}     NRC: ${company.nrc}`, left, 25);
    doc.text(`Período: ${period}`, left, 30); doc.text('Valores expresados en USD', left, 35);
    if (report.notice) { doc.setFont('helvetica', 'bold'); doc.setTextColor(146, 64, 14); doc.text(report.notice, left, 40); doc.setTextColor(15, 23, 42); }
    y = report.notice ? 45 : 41; tableRow(report.columns, true);
  };
  pageHeader();
  report.rows.forEach(row => tableRow(row)); tableRow(report.totals, false, true);
  if (y + 18 > bottom) { doc.addPage(); pageHeader(); }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('F. _________________________', 115, y + 12); doc.text('CONTADOR', 128, y + 17);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFontSize(7); doc.text(`Página ${p} de ${pages}`, 248, 208); }
  doc.save(filename);
}
