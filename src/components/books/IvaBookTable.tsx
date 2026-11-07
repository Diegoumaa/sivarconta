import React from 'react';
import type { BookReport } from '../../utils/ivaBookReport';

export function IvaBookTable({ report }: { report: BookReport }) {
  const { firstMoney } = report;
  const tableWidth = report.widths.reduce((sum, width) => sum + width, 0);
  const format = (value: string | number, col: number) => typeof value === 'number' && col >= firstMoney ? `$${value.toFixed(2)}` : value;
  return <>
    <p id="iva-scroll-help" className="no-print mb-2 text-xs text-slate-600">Desplázate horizontalmente para ver todas las columnas.</p>
    <div role="region" aria-label={report.title} aria-describedby="iva-scroll-help" tabIndex={0} className="overflow-x-auto rounded-lg book-table-scroll focus-visible:outline-2 focus-visible:outline-brand-600">
      <table className="iva-book-table w-full border-collapse text-xs" style={{ minWidth: tableWidth }}>
        <colgroup>{report.widths.map((width, i) => <col key={i} style={{ width: `${width / tableWidth * 100}%` }} />)}</colgroup>
        <thead>
          <tr>{report.groups.map(g => <th key={g.label} scope="colgroup" colSpan={g.span} className="border border-slate-300 bg-slate-100 px-2 py-2 text-center font-bold">{g.label}</th>)}</tr>
          <tr>{report.columns.map((heading, i) => <th key={i} scope="col" className="border border-slate-300 bg-slate-50 px-2 py-2 text-center">{heading}</th>)}</tr>
        </thead>
        <tbody>{report.rows.length ? report.rows.map((row, index) => <tr key={index} className="even:bg-slate-50">{row.map((cell, col) => <td key={col} className={`border border-slate-300 px-2 py-2 align-middle ${col >= firstMoney ? 'text-right tabular-nums whitespace-nowrap' : col < 2 ? 'text-center' : 'iva-identity-cell'}`}>{format(cell, col)}</td>)}</tr>) : <tr><td colSpan={report.columns.length} className="p-8 text-center text-slate-600">No hay {report.title.includes('COMPRAS') ? 'compras' : 'ventas'} registradas en este período.</td></tr>}</tbody>
        <tfoot><tr><td colSpan={firstMoney} className="border border-slate-300 bg-slate-100 px-2 py-3 text-center font-bold">TOTAL</td>{report.totals.slice(firstMoney).map((cell, index) => <td key={index} className="border border-slate-300 bg-slate-100 px-2 py-3 text-right tabular-nums whitespace-nowrap font-bold">{format(cell, index + firstMoney)}</td>)}</tr></tfoot>
    </table></div>
    <div className="iva-signature mt-10 text-center text-xs"><p>F. _________________________</p><p className="mt-1">CONTADOR</p></div>
  </>;
}
