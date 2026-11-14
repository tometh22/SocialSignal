import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useSearch } from 'wouter';

export const validFinancePeriod = (value: string | null): value is string => !!value && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(value);
export function previousFinanceMonth(now = new Date()) {
  const current = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit' }).format(now);
  const [year, month] = current.split('-').map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}
const Context = createContext<{ period: string; setPeriod: (value: string) => void } | null>(null);
const isFinancePath = (path: string) => path === '/dashboard' || path.startsWith('/finance/');
export function FinancePeriodProvider({ children }: { children: ReactNode }) {
  const search = useSearch();
  const [path, navigate] = useLocation();
  const [period, update] = useState(() => {
    const explicit = isFinancePath(window.location.pathname) ? new URLSearchParams(window.location.search).get('period') : null;
    if (validFinancePeriod(explicit)) return explicit;
    try { const saved = localStorage.getItem('mind.finance.period'); if (validFinancePeriod(saved)) return saved; } catch { /* storage may be unavailable */ }
    return previousFinanceMonth();
  });
  useEffect(() => {
    if (!isFinancePath(path)) return;
    const params = new URLSearchParams(search);
    const explicit = params.get('period');
    if (validFinancePeriod(explicit)) update(explicit);
    else { params.set('period', period); navigate(`${path}?${params}`, { replace: true }); }
  }, [path, search]);
  useEffect(() => { try { localStorage.setItem('mind.finance.period', period); } catch { /* optional persistence */ } }, [period]);
  const setPeriod = (value: string) => {
    if (!validFinancePeriod(value)) return;
    update(value);
    const params = new URLSearchParams(window.location.search); params.set('period', value);
    navigate(`${path}?${params}`, { replace: true });
  };
  return <Context.Provider value={{ period, setPeriod }}>{children}</Context.Provider>;
}
export function useFinancePeriod() {
  const value = useContext(Context);
  if (!value) throw new Error('FinancePeriodProvider required');
  const [year, month] = value.period.split('-');
  return { ...value, year, month, setYear: (year: string) => value.setPeriod(`${year}-${month}`), setMonth: (month: string) => value.setPeriod(`${year}-${month.padStart(2, '0')}`) };
}
