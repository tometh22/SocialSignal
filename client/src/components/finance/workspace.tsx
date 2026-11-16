import { Link, useLocation } from 'wouter';
import { BarChart3, ChevronLeft, ChevronRight, ClipboardCheck, Flag, FolderKanban, Landmark, LineChart, Receipt, Scale, UploadCloud } from 'lucide-react';
import { useFinancePeriod } from '@/hooks/use-finance-period';
import { FINANCE_SUMMARY_ACCESS_SECTIONS, usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const groups = [
  { label: 'Resumen', icon: BarChart3, question: 'Ventas, costos y resultado de la empresa.', paths: ['/dashboard'] },
  { label: 'Caja', icon: Landmark, question: 'Dinero disponible y movimientos bancarios.', paths: ['/finance/cashflow'], finance: true },
  { label: 'Cobros y pagos', icon: Scale, question: 'Saldos por cobrar, por pagar y provisiones.', paths: ['/finance/activo', '/finance/pasivo', '/finance/provisions'], finance: true },
  { label: 'Clientes y proyectos', icon: FolderKanban, question: 'Contribución mensual, costos e ingresos recurrentes.', paths: ['/finance/rendimiento', '/finance/costos', '/finance/arr'] },
  { label: 'Proyección', icon: LineChart, question: 'Estimación del resultado al terminar el ejercicio.', paths: ['/finance/proyeccion', '/finance/presupuesto'] },
];
const actions = [
  { href: '/finance/cargar', label: 'Cargar información', icon: UploadCloud, note: 'La bandeja reúne todos los períodos. Revisá la fecha y el mes de aplicación de cada documento antes de confirmar.' },
  { href: '/finance/facturas-equipo', label: 'Facturas del equipo', icon: Receipt },
  { href: '/finance/cierre', label: 'Revisar cierre', icon: ClipboardCheck },
  { href: '/finance/saldos-iniciales', label: 'Saldos iniciales', icon: Flag, note: 'Saldos con los que Finanzas arranca en Mind en el mes de cambio.' },
];
export const financePaths = [...groups.flatMap(group => group.paths), ...actions.map(action => action.href)];
const secondary: Record<string, string> = { '/finance/activo': 'Por cobrar', '/finance/pasivo': 'Por pagar', '/finance/provisions': 'Provisiones', '/finance/rendimiento': 'Contribución por proyecto', '/finance/costos': 'Desglose de costos', '/finance/arr': 'Ingresos recurrentes', '/finance/proyeccion': 'Ejecutado y proyectado', '/finance/presupuesto': 'Presupuesto' };
const shiftMonth = (period: string, delta: number) => { const [year, month] = period.split('-').map(Number); return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7); };

export function FinanceWorkspace() {
  const [path] = useLocation();
  const { period, setPeriod } = useFinancePeriod();
  const { hasPermission, hasAnyPermission } = usePermissions();
  if (!financePaths.includes(path) || !hasAnyPermission(FINANCE_SUMMARY_ACCESS_SECTIONS)) return null;
  const canManage = hasPermission('finance');
  const active = groups.find(group => group.paths.includes(path));
  const activeAction = actions.find(action => action.href === path);
  const yearOnly = ['/finance/costos', '/finance/proyeccion', '/finance/presupuesto'].includes(path);
  const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
  return <section aria-label="Área de Finanzas" className="mx-auto mb-6 max-w-[1680px] rounded-2xl border border-border/75 bg-card shadow-[0_14px_34px_-32px_rgba(15,23,42,0.5)]">
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Finanzas</span>
        <div className="flex items-center gap-1" role="group" aria-label="Período de Finanzas">
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Mes anterior" onClick={() => setPeriod(shiftMonth(period, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Input aria-label="Mes de referencia de Finanzas" className="h-9 w-[10.5rem] bg-background text-sm font-medium" type="month" value={period} onChange={event => setPeriod(event.target.value)} />
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Mes siguiente" onClick={() => setPeriod(shiftMonth(period, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {canManage && <div className="flex gap-1.5">{actions.map(action => {
        const selected = path === action.href;
        return <Button key={action.href} asChild size="sm" variant={selected ? 'default' : 'outline'} className="shrink-0"><Link href={`${action.href}?period=${period}`} aria-current={selected ? 'page' : undefined} aria-label={action.label} title={action.label}><action.icon className="h-4 w-4 sm:mr-1.5" aria-hidden="true" /><span className="hidden sm:inline">{action.label}</span></Link></Button>;
      })}</div>}
    </div>
    <nav aria-label="Vistas de Finanzas" className="mt-2 flex gap-1 overflow-x-auto border-b px-2 sm:px-4">
      {groups.filter(group => !group.finance || canManage).map(group => {
        const selected = active === group;
        return <Link key={group.label} href={`${group.paths[0]}?period=${period}`} aria-current={selected ? path === group.paths[0] ? 'page' : 'location' : undefined}
          className={cn('-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors', focus, selected ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground')}>
          <group.icon className={cn('h-4 w-4', selected ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />{group.label}
        </Link>;
      })}
      {active && active.paths.length === 1 && <p className="ml-auto hidden self-center pl-4 text-xs text-muted-foreground lg:block">{active.question}{yearOnly && ` Se muestra el ejercicio ${period.slice(0, 4)} completo.`}</p>}
    </nav>
    {(active && active.paths.length > 1) || activeAction?.note ? <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
      {active && active.paths.length > 1 ? <nav aria-label={`Detalle de ${active.label}`} className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5">
        {active.paths.map(href => <Link key={href} href={`${href}?period=${period}`} aria-current={path === href ? 'page' : undefined}
          className={cn('shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors', focus, path === href ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{secondary[href]}</Link>)}
      </nav> : <span />}
      <p className="text-xs leading-5 text-muted-foreground">{active?.question ?? activeAction?.note}{yearOnly && ` Se muestra el ejercicio ${period.slice(0, 4)} completo.`}</p>
    </div> : <div className="h-1" aria-hidden="true" />}
  </section>;
}
