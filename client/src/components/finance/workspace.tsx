import { Link, useLocation } from 'wouter';
import { useFinancePeriod } from '@/hooks/use-finance-period';
import { FINANCE_SUMMARY_ACCESS_SECTIONS, usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const groups = [
  { label: 'Resumen', question: 'Ventas, costos y resultado de la empresa.', paths: ['/dashboard'] },
  { label: 'Caja', question: 'Dinero disponible y movimientos bancarios.', paths: ['/finance/cashflow'], finance: true },
  { label: 'Cobros y pagos', question: 'Saldos por cobrar, por pagar y provisiones.', paths: ['/finance/activo', '/finance/pasivo', '/finance/provisions'], finance: true },
  { label: 'Clientes y proyectos', question: 'Contribución mensual, costos e ingresos recurrentes.', paths: ['/finance/rendimiento', '/finance/costos', '/finance/arr'] },
  { label: 'Proyección', question: 'Estimación del resultado al terminar el ejercicio.', paths: ['/finance/proyeccion'] },
];
export const financePaths = [...groups.flatMap(group => group.paths), '/finance/cargar', '/finance/facturas-equipo', '/finance/cierre'];
const secondary: Record<string, string> = { '/finance/activo': 'Por cobrar', '/finance/pasivo': 'Por pagar', '/finance/provisions': 'Provisiones', '/finance/rendimiento': 'Contribución por proyecto', '/finance/costos': 'Desglose de costos', '/finance/arr': 'Ingresos recurrentes' };

export function FinanceWorkspace() {
  const [path] = useLocation();
  const { period, setPeriod } = useFinancePeriod();
  const { hasPermission, hasAnyPermission } = usePermissions();
  if (!financePaths.includes(path) || !hasAnyPermission(FINANCE_SUMMARY_ACCESS_SECTIONS)) return null;
  const canManage = hasPermission('finance');
  const active = groups.find(group => group.paths.includes(path));
  const link = (href: string, label: string, selected = path === href) => <Link key={href} href={`${href}?period=${period}`} aria-current={selected ? path === href ? 'page' : 'location' : undefined} className={cn('shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>{label}</Link>;
  const actions = <><Button asChild size="sm" variant={path === '/finance/cargar' ? 'default' : 'outline'}><Link href={`/finance/cargar?period=${period}`}>Cargar información</Link></Button><Button asChild size="sm" variant={path === '/finance/facturas-equipo' ? 'default' : 'outline'}><Link href={`/finance/facturas-equipo?period=${period}`}>Facturas del equipo</Link></Button><Button asChild size="sm" variant={path === '/finance/cierre' ? 'default' : 'outline'}><Link href={`/finance/cierre?period=${period}`}>Revisar cierre</Link></Button></>;
  return <section aria-label="Área de Finanzas" className="mx-auto mb-5 max-w-[1680px] rounded-2xl border bg-card p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-semibold">Finanzas</span><label className="flex items-center gap-2 text-xs text-muted-foreground"><span className="hidden sm:inline">Mes de referencia</span><Input aria-label="Mes de referencia de Finanzas" className="h-9 w-40 bg-background" type="month" value={period} onChange={event => setPeriod(event.target.value)} /></label></div>
      {canManage && <><div className="hidden flex-wrap gap-2 sm:flex">{actions}</div><details className="w-full sm:hidden"><summary className="cursor-pointer text-sm font-medium">Cargar información y revisar cierre</summary><div className="mt-2 flex flex-wrap gap-2">{actions}</div></details></>}
    </div>
    <nav aria-label="Vistas de Finanzas" className="mt-3 flex flex-wrap gap-1 border-t pt-3">{groups.filter(group => !group.finance || canManage).map(group => link(group.paths[0], group.label, active === group))}</nav>
    {active && <p className="mt-2 px-3 text-xs leading-5 text-muted-foreground">{active.question}{['/finance/costos','/finance/proyeccion'].includes(path) && ` Se muestra el ejercicio ${period.slice(0,4)} completo.`}</p>}
    {path === '/finance/cargar' && <p className="mt-2 text-xs text-muted-foreground">La bandeja reúne todos los períodos. Revisá la fecha y el mes de aplicación de cada documento antes de confirmar.</p>}
    {active && active.paths.length > 1 && <nav aria-label={`Detalle de ${active.label}`} className="mt-2 flex flex-wrap gap-1">{active.paths.map(href => link(href, secondary[href]))}</nav>}
  </section>;
}
