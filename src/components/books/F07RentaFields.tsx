import type { F07Renta } from '../../types';
import { f07CostOptions, purchaseClassifications, purchaseOperations, purchaseSectors, saleIncomes, saleOperations } from '../../utils/f07Renta';

export function F07RentaFields({ kind, value, onChange, disabled }: {
  kind: 'purchase' | 'sale';
  value: F07Renta;
  onChange: (value: F07Renta) => void;
  disabled?: boolean;
}) {
  const select = (key: keyof F07Renta, label: string, options: Record<string, string>, locked = false) => (
    <label className="block min-w-0 text-xs font-medium text-slate-700">
      {label}
      <select aria-label={label} value={value[key] || ''} disabled={locked} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
        onChange={event => {
          const next = { ...value, [key]: event.target.value };
          if (kind === 'purchase' && key === 'operation' && next.operation === '9') {
            onChange({ operation: '9', classification: '9', sector: '9', cost: '9' });
            return;
          }
          if (kind === 'purchase' && key === 'operation' && value.operation === '9') {
            onChange({ operation: next.operation });
            return;
          }
          if (kind === 'purchase' && (key === 'classification' || key === 'sector') && !Object.keys(f07CostOptions(next)).includes(next.cost || '')) {
            next.cost = '';
          }
          onChange(next);
        }}>
        <option value="">Selecciona</option>
        {Object.entries(options).map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
      </select>
    </label>
  );
  const exception = kind === 'purchase' && value.operation === '9';
  const exceptionOption = { '9': 'Excepción' };
  return <fieldset disabled={disabled} className="min-w-0">
    <legend className="mb-2 text-sm font-semibold text-slate-900">Clasificación de renta para el F‑07</legend>
    <div className={`grid gap-3 sm:grid-cols-2 ${kind === 'purchase' ? 'xl:grid-cols-4' : ''}`}>
      {select('operation', 'Tipo de operación de renta', kind === 'purchase' ? purchaseOperations : saleOperations)}
      {kind === 'sale' ? select('income', 'Tipo de ingreso de renta', saleIncomes) : <>
        {select('classification', 'Clasificación de renta', exception ? exceptionOption : purchaseClassifications, exception)}
        {select('sector', 'Sector de renta', exception ? exceptionOption : purchaseSectors, exception)}
        {select('cost', 'Tipo de costo o gasto', exception ? exceptionOption : f07CostOptions(value), exception || !value.classification)}
      </>}
    </div>
  </fieldset>;
}
