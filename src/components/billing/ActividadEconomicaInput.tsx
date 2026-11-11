import { useEffect, useId, useState } from 'react';

// Catálogo CAT-019 (Actividad Económica) de Hacienda. Se carga bajo demanda para no pesar en la carga inicial.
let cache: Record<string, string> | null = null;
export function useActividades() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    import('../../data/mhActividades.json').then(module => {
      cache = module.default as Record<string, string>;
      if (alive) setData(cache);
    }).catch(() => { /* Sin catálogo local: el servidor vuelve a validar el código. */ });
    return () => { alive = false; };
  }, []);
  return data;
}

export const codigoActividad = (texto: string) => texto.trim().match(/^(\d{5,6})(?!\d)/)?.[1] || null;

/** Normaliza «62010» o «62010 - …» a «62010 - Descripción oficial» si el código existe en el catálogo. */
export function actividadNormalizada(texto: string, actividades: Record<string, string> | null) {
  const code = codigoActividad(texto);
  return code && actividades?.[code] ? `${code} - ${actividades[code]}` : texto.trim();
}

export function ActividadEconomicaInput({ id, value, onChange, className, required }: {
  id: string; value: string; onChange: (value: string) => void; className?: string; required?: boolean;
}) {
  const actividades = useActividades();
  const listId = useId();
  const code = codigoActividad(value);
  const descripcion = code ? actividades?.[code] : undefined;
  return <>
    <input id={id} list={listId} value={value} onChange={e => onChange(e.target.value)} required={required}
      inputMode="text" autoComplete="off" placeholder="Código CAT-019, ej. 62010" className={className} />
    <datalist id={listId}>
      {actividades && Object.entries(actividades).map(([c, d]) => <option key={c} value={`${c} - ${d}`} />)}
    </datalist>
    {value.trim() && actividades && <p className={`mt-1 text-[11px] ${descripcion ? 'text-slate-600' : 'text-red-700'}`}>
      {descripcion ? `Catálogo de Hacienda: ${descripcion}` : 'Escribe un código de 5 o 6 dígitos del catálogo CAT-019 de Hacienda.'}
    </p>}
  </>;
}
