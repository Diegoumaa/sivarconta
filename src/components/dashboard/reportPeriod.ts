export type ReportPeriod = 'hoy' | 'semana' | 'mes' | 'anterior' | 'personalizado';

/** Accounting dates use El Salvador's calendar, independent of browser timezone. */
export function getReportRange(period: ReportPeriod, now = new Date(), start = '', end = '') {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const date = new Date(`${today}T12:00:00Z`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  if (period === 'personalizado') return { start, end };
  if (period === 'hoy') return { start: today, end: today };
  if (period === 'semana') {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return { start: iso(date), end: today };
  }
  date.setUTCDate(1);
  if (period === 'anterior') {
    date.setUTCDate(0);
    const lastDay = iso(date);
    date.setUTCDate(1);
    return { start: iso(date), end: lastDay };
  }
  return { start: iso(date), end: today };
}

export function isInReportRange(date: string, range: { start: string; end: string }) {
  return Boolean(range.start && range.end && range.start <= range.end && date >= range.start && date <= range.end);
}
