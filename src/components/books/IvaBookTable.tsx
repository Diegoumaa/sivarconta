import React from 'react';
import type { BookReport } from '../../utils/ivaBookReport';

export function IvaBookTable({ report }: { report: BookReport }) {
  const firstMoney = report.title.includes('CONSUMIDOR') ? 7 : 5;
  const format = (value: string | number, col: number) => typeof value === 'number' && col >= firstMoney ? `$${value.toFixed(2)}` : value;
  return <>
    <div className="overflow-x-auto book-table-scroll"><table className="iva-book-table w-full border-collapse text-xs">
      <thead><tr>{report.groups.map((g, i) => <th key={i} colSpan={g.span} className="border border-slate-500 bg-slate-100 px-2 py-2 text-center text-[10px] uppercase">{g.label}</th>)}</tr><tr>{report.columns.map((h, i) => <th key={i} className="border border-slate-500 bg-slate-50 px-2 py-2 text-center text-[10px]">{h}</th>)}</tr></thead>
      <tbody>{report.rows.length ? report.rows.map((row, index) => <tr key={index}>{row.map((cell, col) => <td key={col} className={`border border-slate-300 px-2 py-2 ${col >= firstMoney ? 'text-right font-mono whitespace-nowrap' : 'break-words'}`}>{format(cell, col)}</td>)}</tr>) : <tr><td colSpan={report.columns.length} className="p-8 text-center text-slate-600">No hay {report.title.includes('COMPRAS') ? 'compras' : 'ventas'} registradas en este período.</td></tr>}</tbody>
      <tfoot><tr><td colSpan={firstMoney} className="border border-slate-500 bg-slate-100 px-2 py-3 text-center font-bold">TOTAL</td>{report.totals.slice(firstMoney).map((cell, index) => <td key={index} className="border border-slate-500 bg-slate-100 px-2 py-3 text-right font-bold">{format(cell, index + firstMoney)}</td>)}</tr></tfoot>
    </table></div>
    <div className="mt-20 text-center text-xs"><p>F. _________________________</p><p className="mt-1">CONTADOR</p></div>
  </>;
}
