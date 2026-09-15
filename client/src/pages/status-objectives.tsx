import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDashed,
  Flag,
  Layers3,
  ListChecks,
  Plus,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ViewId = "summary" | "week" | "people" | "accounts";
type GoalLevel = "Empresa" | "Área" | "Persona";

type Goal = {
  id: string;
  level: GoalLevel;
  title: string;
  metric: string;
  target: string;
  progress: number;
  owner: string;
  status: "En curso" | "En riesgo" | "Logrado";
};

type Action = {
  id: string;
  week: string;
  month: string;
  title: string;
  owner: string;
  area: string;
  focus: string;
};

const goals: Goal[] = [
  {
    id: "company-revenue",
    level: "Empresa",
    title: "Cerrar 2026 con crecimiento sostenible",
    metric: "Facturación anual",
    target: "USD 655K base · piso USD 610K",
    progress: 72,
    owner: "Tomás",
    status: "En curso",
  },
  {
    id: "company-recurring",
    level: "Empresa",
    title: "Construir recurrencia para 2027",
    metric: "Nuevo ingreso recurrente firmado",
    target: "USD 10K / mes al 30 nov",
    progress: 42,
    owner: "Vicky",
    status: "En riesgo",
  },
  {
    id: "company-cash",
    level: "Empresa",
    title: "Proteger la caja y la capacidad de entrega",
    metric: "Visibilidad de caja",
    target: "13 semanas actualizadas",
    progress: 80,
    owner: "Acha",
    status: "En curso",
  },
  {
    id: "sales",
    level: "Área",
    title: "Convertir oportunidades prioritarias",
    metric: "Pipeline con próximo paso",
    target: "100% de oportunidades activas",
    progress: 68,
    owner: "Sil",
    status: "En curso",
  },
  {
    id: "marketing",
    level: "Área",
    title: "Generar demanda de alto fit",
    metric: "Campañas y oportunidades calificadas",
    target: "Plan mensual activo",
    progress: 55,
    owner: "Santi",
    status: "En curso",
  },
  {
    id: "operations",
    level: "Área",
    title: "Asegurar margen y calidad de entrega",
    metric: "Proyectos con control semanal",
    target: "100% de cuentas críticas",
    progress: 74,
    owner: "Vicky / PMs",
    status: "En curso",
  },
  {
    id: "tomas",
    level: "Persona",
    title: "Destrabar decisiones de cierre y producto",
    metric: "Decisiones con owner y fecha",
    target: "Resolver en cada weekly",
    progress: 64,
    owner: "Tomás",
    status: "En curso",
  },
  {
    id: "vicky",
    level: "Persona",
    title: "Ordenar cierres, cuentas y operación",
    metric: "Acciones críticas cerradas",
    target: "Sin bloqueos vencidos",
    progress: 61,
    owner: "Vicky",
    status: "En riesgo",
  },
  {
    id: "sil",
    level: "Persona",
    title: "Llevar ventas a próximo paso concreto",
    metric: "Oportunidades con acción siguiente",
    target: "100% del pipeline priorizado",
    progress: 70,
    owner: "Sil",
    status: "En curso",
  },
];

const actions: Action[] = [
  { id: "sep-1", week: "15–19 sep", month: "Septiembre", title: "Definir escenario base, piso y gap de cierre", owner: "Tomás", area: "Empresa", focus: "Dirección" },
  { id: "sep-2", week: "15–19 sep", month: "Septiembre", title: "Ordenar pipeline: monto, probabilidad y próximo paso", owner: "Sil", area: "Ventas", focus: "Conversión" },
  { id: "sep-3", week: "22–26 sep", month: "Septiembre", title: "Elegir cuentas con potencial de expansión y recurrencia", owner: "Vicky", area: "Cuentas", focus: "Expansión" },
  { id: "sep-4", week: "22–26 sep", month: "Septiembre", title: "Actualizar cashflow y necesidades de caja", owner: "Acha", area: "Finanzas", focus: "Caja" },
  { id: "oct-1", week: "1–5 oct", month: "Octubre", title: "Revisar forecast contra piso y escenario base", owner: "Tomás", area: "Empresa", focus: "Forecast" },
  { id: "oct-2", week: "6–10 oct", month: "Octubre", title: "Lanzar cadencia comercial para oportunidades prioritarias", owner: "Sil", area: "Ventas", focus: "Conversión" },
  { id: "nov-1", week: "3–7 nov", month: "Noviembre", title: "Llegar a USD 10K/mes de recurrencia firmada", owner: "Vicky", area: "Cuentas", focus: "Recurrencia" },
  { id: "dec-1", week: "1–5 dic", month: "Diciembre", title: "Cerrar aprendizaje 2026 y plan operativo 2027", owner: "Tomás", area: "Empresa", focus: "2027" },
];

const viewTabs: Array<{ id: ViewId; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "week", label: "Esta semana" },
  { id: "people", label: "Personas" },
  { id: "accounts", label: "Cuentas" },
];

const statusStyles: Record<Goal["status"], string> = {
  "En curso": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "En riesgo": "border-amber-200 bg-amber-50 text-amber-700",
  Logrado: "border-blue-200 bg-blue-50 text-blue-700",
};

const levelStyles: Record<GoalLevel, string> = {
  Empresa: "bg-violet-50 text-violet-700 border-violet-200",
  Área: "bg-sky-50 text-sky-700 border-sky-200",
  Persona: "bg-slate-100 text-slate-700 border-slate-200",
};

function SectionNav({ active }: { active: "status" | "objectives" }) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-xl border border-border/80 bg-card/80 p-1 shadow-sm">
      <a
        href="/review"
        className={cn(
          "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
          active === "status" ? "bg-slate-900 text-white" : "text-muted-foreground hover:bg-muted",
        )}
      >
        Status semanal
      </a>
      <a
        href="/review/objectives"
        className={cn(
          "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
          active === "objectives" ? "bg-slate-900 text-white" : "text-muted-foreground hover:bg-muted",
        )}
      >
        Objetivos
      </a>
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <article className="rounded-2xl border border-border/75 bg-card p-4 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.55)] transition-shadow hover:shadow-[0_18px_32px_-24px_rgba(15,23,42,0.48)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("px-2 py-1 text-[10px]", levelStyles[goal.level])}>{goal.level}</Badge>
            <Badge variant="outline" className={cn("px-2 py-1 text-[10px]", statusStyles[goal.status])}>{goal.status}</Badge>
          </div>
          <h3 className="text-sm font-bold leading-5 text-foreground">{goal.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{goal.metric}</p>
        </div>
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{goal.target}</span>
        <span className="font-bold text-primary">{goal.progress}%</span>
      </div>
      <Progress value={goal.progress} className="mt-2 h-1.5 bg-muted" indicatorClassName={goal.status === "En riesgo" ? "bg-amber-500" : "bg-primary"} />
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        <span>Owner</span>
        <span className="font-semibold text-foreground">{goal.owner}</span>
      </div>
    </article>
  );
}

export default function StatusObjectivesPage() {
  const [view, setView] = useState<ViewId>("summary");
  const [ownerFilter, setOwnerFilter] = useState("Todos");
  const [doneActions, setDoneActions] = useState<Set<string>>(new Set(["sep-1", "sep-2"]));
  const [showActionForm, setShowActionForm] = useState(false);

  const owners = useMemo(() => ["Todos", ...Array.from(new Set(actions.map((action) => action.owner)))], []);
  const filteredActions = useMemo(
    () => ownerFilter === "Todos" ? actions : actions.filter((action) => action.owner === ownerFilter),
    [ownerFilter],
  );
  const completedCount = actions.filter((action) => doneActions.has(action.id)).length;

  const toggleAction = (id: string) => {
    setDoneActions((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <PageShell width="wide" spacing="compact" className="pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionNav active="objectives" />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Plan Cierre 2026</span>
          <span className="text-border">·</span>
          <span>Actualizado hoy</span>
        </div>
      </div>

      <CompactPageHeader
        eyebrow="Status · seguimiento integrado"
        title="Objetivos y acciones"
        description="Una vista liviana para conectar objetivos de empresa, área y personas con las acciones concretas de cada semana."
        icon={<Target className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={() => setShowActionForm((visible) => !visible)}>
            <Plus className="h-4 w-4" />
            Nueva acción
          </Button>
        }
        meta={
          <>
            <Badge variant="outline" className="gap-1.5 border-primary/20 bg-primary/[0.06] text-primary"><CircleDashed className="h-3 w-3" /> Seguimiento activo</Badge>
            <span className="inline-flex items-center gap-1.5"><Flag className="h-3.5 w-3.5" /> Septiembre → diciembre 2026</span>
          </>
        }
      />

      {showActionForm && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-primary"><Plus className="h-4 w-4" /><span className="font-semibold">Nueva acción</span><span className="text-muted-foreground">La creación persistente se conecta al seguimiento semanal.</span></div>
          <Button variant="outline" size="sm" onClick={() => setShowActionForm(false)}>Cerrar</Button>
        </div>
      )}

      <nav aria-label="Vista de objetivos" className="flex items-center gap-1 overflow-x-auto border-b border-border/80 pb-px">
        {viewTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              view === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {view === "summary" && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principales">
            {[
              { label: "Facturación base", value: "USD 655K", detail: "piso USD 610K", icon: BarChart3, tone: "text-primary" },
              { label: "Recurrencia objetivo", value: "USD 10K / mes", detail: "firmada al 30 nov", icon: TrendingUp, tone: "text-emerald-600" },
              { label: "Caja visible", value: "13 semanas", detail: "forecast actualizado", icon: WalletCards, tone: "text-amber-600" },
              { label: "Objetivos en curso", value: "9", detail: `${goals.filter((goal) => goal.status === "En riesgo").length} requieren atención`, icon: ListChecks, tone: "text-violet-600" },
            ].map(({ label, value, detail, icon: Icon, tone }) => (
              <div key={label} className="rounded-2xl border border-border/75 bg-card p-4 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.55)]">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><Icon className={cn("h-4 w-4", tone)} /></div>
                <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">{value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
            <div className="rounded-2xl border border-border/75 bg-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div><h2 className="text-base font-bold text-foreground">Árbol de objetivos</h2><p className="mt-1 text-xs text-muted-foreground">La cascada evita que las acciones semanales queden desconectadas del cierre.</p></div>
                <Layers3 className="h-5 w-5 text-primary" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {goals.slice(0, 6).map((goal) => <GoalCard key={goal.id} goal={goal} />)}
              </div>
            </div>
            <div className="rounded-2xl border border-border/75 bg-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div><h2 className="text-base font-bold text-foreground">Esta semana</h2><p className="mt-1 text-xs text-muted-foreground">15–19 de septiembre · {completedCount}/{actions.length} acciones cerradas</p></div>
                <ListChecks className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="space-y-2">
                {actions.slice(0, 4).map((action) => {
                  const done = doneActions.has(action.id);
                  return <button key={action.id} type="button" onClick={() => toggleAction(action.id)} className="flex w-full items-start gap-3 rounded-xl border border-border/70 p-3 text-left transition-colors hover:bg-muted/50">
                    <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background text-transparent")}><Check className="h-3 w-3" /></span>
                    <span className="min-w-0 flex-1"><span className={cn("block text-sm font-semibold", done && "text-muted-foreground line-through")}>{action.title}</span><span className="mt-1 block text-[11px] text-muted-foreground">{action.owner} · {action.area}</span></span>
                  </button>;
                })}
              </div>
              <button type="button" onClick={() => setView("week")} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Ver todas las acciones <ArrowUpRight className="h-3.5 w-3.5" /></button>
            </div>
          </section>
        </>
      )}

      {view === "week" && (
        <section className="rounded-2xl border border-border/75 bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-base font-bold text-foreground">Acciones por semana</h2><p className="mt-1 text-xs text-muted-foreground">Owner, mes y foco en una sola lista para la weekly.</p></div>
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground"><option value="Todos">Todos los owners</option>{owners.slice(1).map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></div>
          </div>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground"><th className="pb-3 pl-2">Acción</th><th className="pb-3">Semana</th><th className="pb-3">Owner</th><th className="pb-3">Área</th><th className="pb-3 pr-2 text-right">Estado</th></tr></thead><tbody>{filteredActions.map((action) => { const done = doneActions.has(action.id); return <tr key={action.id} className="border-b border-border/60 last:border-0"><td className="py-3 pl-2"><button type="button" onClick={() => toggleAction(action.id)} className="flex items-center gap-2 text-left"><span className={cn("grid h-5 w-5 place-items-center rounded-full border", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-transparent")}><Check className="h-3 w-3" /></span><span className={cn("font-semibold", done && "text-muted-foreground line-through")}>{action.title}</span></button><div className="ml-7 mt-1 text-[11px] text-muted-foreground">{action.focus}</div></td><td className="py-3 text-xs text-muted-foreground">{action.week}<div className="mt-1 text-[10px]">{action.month}</div></td><td className="py-3 text-xs font-semibold">{action.owner}</td><td className="py-3 text-xs text-muted-foreground">{action.area}</td><td className="py-3 pr-2 text-right"><Badge variant="outline" className={cn("text-[10px]", done ? statusStyles.Logrado : statusStyles["En curso"])}>{done ? "Cerrada" : "Pendiente"}</Badge></td></tr>; })}</tbody></table></div>
        </section>
      )}

      {view === "people" && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {goals.filter((goal) => goal.level === "Persona").map((goal) => <GoalCard key={goal.id} goal={goal} />)}
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center"><Users className="h-6 w-6 text-primary" /><h2 className="mt-3 text-sm font-bold">Próximo paso por persona</h2><p className="mt-1 max-w-xs text-xs text-muted-foreground">Cada owner ve sus acciones pendientes y el objetivo al que contribuyen.</p></div>
        </section>
      )}

      {view === "accounts" && (
        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary" /><h2 className="text-base font-bold">Cuentas de expansión</h2></div><p className="mt-1 text-xs text-muted-foreground">Vista preparada para conectar oportunidades, expansión y recurrencia con el objetivo de USD 10K/mes.</p><div className="mt-5 space-y-3">{["Cuentas con potencial de expansión", "Propuestas de servicio recurrente", "Clientes a proteger por renovación"].map((label, index) => <div key={label} className="flex items-center justify-between rounded-xl border border-border/70 p-3"><div><div className="text-sm font-semibold">{label}</div><div className="mt-1 text-[11px] text-muted-foreground">Próximo paso definido en la weekly</div></div><Badge variant="outline" className="border-primary/20 bg-primary/[0.06] text-primary">{[4, 3, 6][index]} activas</Badge></div>)}</div></div>
          <div className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-600" /><h2 className="text-base font-bold">Indicador de recurrencia</h2></div><div className="mt-6 text-3xl font-bold tracking-tight">42%</div><p className="mt-1 text-xs text-muted-foreground">avance hacia la meta de USD 10K/mes</p><Progress value={42} className="mt-5 h-2" indicatorClassName="bg-emerald-500" /><div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>Actual</span><span className="font-semibold text-foreground">Meta: 30 nov</span></div></div>
        </section>
      )}
    </PageShell>
  );
}
