import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, authFetchJson, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/ui/page-shell";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { OpportunityEditor } from "@/components/pipeline/opportunity-editor";
import {
  opportunitySchema,
  stages,
  scopes,
  metrics,
  localDay,
  type Opportunity,
} from "@shared/pipeline";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  History,
  LayoutDashboard,
  ListFilter,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

const base = "/api/crm/pipeline";
const navigation = [
  {
    label: "Resumen",
    icon: LayoutDashboard,
    description: "La cartera, en perspectiva.",
  },
  {
    label: "Oportunidades",
    icon: Target,
    description: "Cada alcance, su evidencia y el próximo paso.",
  },
  {
    label: "Alertas",
    icon: Bell,
    description: "Lo que necesita atención para avanzar.",
  },
  {
    label: "Concentración",
    icon: Building2,
    description: "Exposición a Warner y diversificación de la cartera.",
  },
  {
    label: "Cierre mensual",
    icon: ClipboardCheck,
    description: "Conciliá, guardá un corte y compartí el resumen.",
  },
  {
    label: "Registro",
    icon: History,
    description: "Decisiones y cambios, con su contexto.",
  },
];
const alertTypes = [
  "Sin próximo paso",
  "Sin valor USD",
  "Sin probabilidad respaldada",
  "Evidencia desactualizada",
  "Sin fecha objetivo",
];
const stageColors: Record<string, string> = {
  Prospección: "bg-slate-400",
  "Reunión / demo": "bg-sky-500",
  Propuesta: "bg-indigo-500",
  Negociación: "bg-amber-500",
  Confirmada: "bg-emerald-500",
  "Sin etapa verificada": "bg-slate-300",
};
const fieldLabels: Record<string, string> = {
  account: "Cuenta",
  project: "Proyecto",
  stage: "Etapa",
  status: "Estado",
  scope: "Alcance",
  usd: "Valor USD",
  probability: "Probabilidad",
  probabilityReason: "Motivo de probabilidad",
  probabilitySource: "Fuente de probabilidad",
  closeDate: "Fecha objetivo",
  next: "Próximo paso",
  nextDate: "Fecha próximo paso",
  owner: "Responsable",
  ownerId: "Responsable",
  contact: "Contacto",
  evidence: "Evidencia",
  evidenceDate: "Fecha de evidencia",
  sources: "Fuentes",
  notes: "Notas",
  confidence: "Confianza",
  warner: "Grupo Warner",
  eligible: "Vigencia",
  valueNote: "Fundamento del importe",
};
const money = (value: unknown) =>
  value === null || value === undefined
    ? "Pendiente"
    : new Intl.NumberFormat("es-AR", {
        maximumFractionDigits: 2,
        minimumFractionDigits: Number(value) % 1 ? 2 : 0,
      }).format(Number(value));
const pct = (value: unknown) =>
  value === null || value === undefined
    ? "Pendiente"
    : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(Number(value))}%`;
const civilDate = (value?: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Pendiente";
const dateTime = (value: string) =>
  new Date(value).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm",
        className,
      )}
    >
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function EmptyState({
  title,
  description,
  icon: Icon = Target,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-400">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
function Coverage({ n = 0, total = 0 }: { n?: number; total?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {total
            ? n === total
              ? "Cobertura completa"
              : "Cobertura parcial"
            : "Sin cartera abierta"}
        </span>
        <span className="font-medium tabular-nums">
          {n}/{total}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full",
            n === total && total ? "bg-emerald-500" : "bg-slate-700",
          )}
          style={{ width: `${total ? (n / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
function Metric({
  title,
  value,
  icon: Icon,
  subtitle,
  coverage,
  highlight = false,
  onClick,
}: {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  subtitle?: string;
  coverage?: { n: number; total: number };
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[160px] flex-col rounded-2xl border bg-card p-5 shadow-sm",
        highlight ? "border-amber-200 bg-amber-50/40" : "border-slate-200/80",
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Icon
          className={cn(
            "h-4 w-4",
            highlight ? "text-amber-600" : "text-slate-400",
          )}
        />
      </div>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <div className="mt-auto pt-4">
        {coverage ? (
          <Coverage {...coverage} />
        ) : (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {onClick && (
        <button
          onClick={onClick}
          aria-label={`Ver ${title.toLowerCase()}`}
          className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      )}
    </div>
  );
}
function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className="h-9 justify-between gap-3 bg-background px-3 text-xs font-normal"
        >
          <span className="max-w-[180px] truncate">
            {options.find((o) => o.value === value)?.label ?? (value || label)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>Sin coincidencias.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value ? "opacity-0" : "opacity-100",
                  )}
                />
                Todas las opciones
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === o.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
function StageBadge({ stage }: { stage: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          stageColors[stage] ?? "bg-slate-400",
        )}
      />
      {stage}
    </span>
  );
}
function OpportunityTable({
  rows,
  loading,
  onOpen,
  compact = false,
}: {
  rows: any[];
  loading: boolean;
  onOpen: (r: Opportunity) => void;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="min-w-[240px] px-5 py-3 font-medium">
              Cuenta y oportunidad
            </th>
            <th className="min-w-[155px] px-3 py-3 font-medium">
              Situación comercial
            </th>
            <th className="px-3 py-3 text-right font-medium">Valor USD</th>
            {!compact && (
              <>
                <th className="px-3 py-3 text-right font-medium">
                  Probabilidad
                </th>
                <th className="px-3 py-3 text-right font-medium">
                  Ponderado USD
                </th>
              </>
            )}
            <th className="min-w-[150px] px-3 py-3 font-medium">
              {compact ? "Próximo paso" : "Seguimiento"}
            </th>
            {!compact && (
              <th className="min-w-[145px] px-3 py-3 font-medium">
                Responsable
              </th>
            )}
            <th className="w-12 px-3 py-3">
              <span className="sr-only">Abrir ficha</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: compact ? 5 : 8 }, (_, j) => (
                    <td className="px-5 py-5" key={j}>
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((r) => (
                <tr
                  className="group transition-colors hover:bg-slate-50/80"
                  key={r.id ?? r.importKey}
                >
                  <td className="px-5 py-4">
                    <button
                      onClick={() => onOpen(r)}
                      className="block max-w-[340px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="font-semibold text-slate-900 group-hover:text-primary">
                        {r.account}
                      </span>
                      <span className="mt-1 block leading-relaxed text-muted-foreground">
                        {r.project || "Alcance por definir"}
                      </span>
                    </button>
                    {!compact && (
                      <span className="mt-1.5 block text-[10px] text-slate-400">
                        {r.contact || "Contacto pendiente"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <StageBadge stage={r.stage} />
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {r.status} · {r.scope}
                    </p>
                    {!compact && (
                      <span className="mt-1 inline-block text-[10px] text-slate-400">
                        Confianza {r.confidence?.toLowerCase()}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right font-medium tabular-nums">
                    {money(r.usd)}
                  </td>
                  {!compact && (
                    <>
                      <td className="px-3 py-4 text-right tabular-nums">
                        {pct(r.probability)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-right tabular-nums text-muted-foreground">
                        {money(metrics([r]).weighted)}
                      </td>
                    </>
                  )}
                  <td className="max-w-[240px] px-3 py-4">
                    <p className="line-clamp-2 leading-relaxed text-slate-600">
                      {compact
                        ? r.next || "Definir próximo paso"
                        : civilDate(r.closeDate)}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {compact
                        ? civilDate(r.nextDate)
                        : `Evidencia: ${civilDate(r.evidenceDate)}`}
                    </p>
                    {r.alerts?.length > 0 && (
                      <button
                        onClick={() => onOpen(r)}
                        className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                        title={r.alerts.join(" · ")}
                      >
                        <AlertCircle className="h-3 w-3" />
                        {r.alerts.length}{" "}
                        {r.alerts.length === 1 ? "pendiente" : "pendientes"}
                      </button>
                    )}
                  </td>
                  {!compact && (
                    <td className="px-3 py-4">
                      <span className="inline-flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-500">
                          {r.owner
                            ? r.owner
                                .split(" ")
                                .map((s: string) => s[0])
                                .slice(0, 2)
                                .join("")
                            : "—"}
                        </span>
                        {r.owner || "Sin responsable"}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400"
                      aria-label={`Abrir ${r.account}`}
                      onClick={() => onOpen(r)}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Pipeline() {
  const initial = new URLSearchParams(location.search),
    createKey = useRef(crypto.randomUUID()),
    cutKey = useRef(crypto.randomUUID());
  const [tab, setTab] = useState(
      navigation.some((n) => n.label === initial.get("view"))
        ? initial.get("view")!
        : "Resumen",
    ),
    [snapshot, setSnapshot] = useState(initial.get("snapshotId") ?? ""),
    [period, setPeriod] = useState(
      initial.get("period") ?? localDay().slice(0, 7),
    ),
    [filter, setFilter] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        [...initial.entries()].filter(([k]) =>
          [
            "q",
            "account",
            "owner",
            "stage",
            "scope",
            "closeMonth",
            "group",
            "alert",
          ].includes(k),
        ),
      ),
    ),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Opportunity | null>(null),
    [decision, setDecision] = useState(""),
    [showFilters, setShowFilters] = useState(false),
    [copied, setCopied] = useState(false),
    [logOffset, setLogOffset] = useState(0),
    [success, setSuccess] = useState("");
  const { isAdmin, hasPermission } = usePermissions();
  const canReadQuotes = hasPermission("quotations");
  const qs = new URLSearchParams({
    ...filter,
    ...(snapshot ? { snapshotId: snapshot } : {}),
  }).toString();
  const universeQs = snapshot ? `snapshotId=${snapshot}` : "";
  const useData = (path: string, enabled = true) =>
    useQuery<any>({
      queryKey: [base, path],
      queryFn: () => authFetchJson(base + path),
      enabled,
    });
  const summary = useData("/summary?" + qs),
    rows = useData(
      `/${tab === "Alertas" ? "alerts" : "opportunities"}?${qs}&offset=${offset}`,
      ["Resumen", "Oportunidades", "Alertas", "Concentración"].includes(tab),
    ),
    cuts = useData("/cuts"),
    log = useData(
      "/log?offset=" + logOffset,
      tab === "Registro" && canReadQuotes,
    ),
    checklist = useData(
      "/checklist/" + period,
      tab === "Cierre mensual" && !snapshot,
    ),
    settings = useData("/settings", tab === "Concentración" && isAdmin),
    text = useData(
      "/executive-summary?" + qs + "&period=" + period,
      tab === "Cierre mensual",
    ),
    cut = useData("/cuts/" + snapshot, !!snapshot),
    accounts = useData(
      "/opportunities?" + universeQs + "&group=account&limit=1",
      showFilters,
    ),
    owners = useData(
      "/opportunities?" + universeQs + "&group=owner&limit=1",
      showFilters,
    );
  const data = summary.data;
  const selectedCut = cut.data;
  const effectivePeriod = selectedCut?.period ?? period;
  const billing = useData(
    "/billing?period=" + effectivePeriod,
    tab === "Concentración" && hasPermission("finance"),
  );
  useEffect(() => {
    const p = new URLSearchParams({
      ...filter,
      view: tab,
      period,
      ...(snapshot ? { snapshotId: snapshot } : {}),
    });
    window.history.replaceState(null, "", `/crm/pipeline?${p}`);
  }, [tab, snapshot, filter, period]);
  const navigate = (view: string, cutId = snapshot) => {
    setTab(view);
    setSnapshot(cutId);
    setOffset(0);
    setError("");
    setSuccess("");
  };
  const update = (k: string, v: string) => {
    setOffset(0);
    setFilter((f) => {
      const n = { ...f };
      if (v) n[k] = v;
      else delete n[k];
      return n;
    });
  };
  async function mutate(path: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest(base + path, method, body);
      await queryClient.invalidateQueries({ queryKey: [base] });
      return result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const newOpportunity = () => {
    createKey.current = crypto.randomUUID();
    setError("");
    setEditing(opportunitySchema.parse({ account: "Nueva cuenta" }));
  };
  const openOpportunity = (r: Opportunity) => {
    setError("");
    setEditing(r);
  };
  const filterCount = Object.entries(filter).filter(
    ([k]) => k !== "q" && k !== "group",
  ).length;
  const visibleRows = (rows.data?.rows ?? []).filter(
    (r: Opportunity) => tab !== "Concentración" || r.warner,
  );
  const rowError = [
    "Resumen",
    "Oportunidades",
    "Alertas",
    "Concentración",
  ].includes(tab)
    ? rows.error
    : null;
  const currentError =
    error ||
    summary.error?.message ||
    rowError?.message ||
    (tab === "Registro" ? log.error?.message : null) ||
    (tab === "Cierre mensual"
      ? (text.error?.message ?? checklist.error?.message)
      : null);
  const options = (values: readonly string[]) =>
    values.map((value) => ({ value, label: value }));
  const clearFilters = () => {
    setFilter({});
    setOffset(0);
  };
  const activeFilters = Object.entries(filter).filter(
    ([k]) => k !== "q" && k !== "group",
  );
  const completed = (checklist.data?.steps ?? []).filter(Boolean).length;
  const showList = ["Oportunidades", "Alertas", "Concentración"].includes(tab);
  const pagination = (
    <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-slate-50/40 px-5 py-3">
      <span className="text-xs text-muted-foreground">
        {rows.data?.total
          ? `${offset + 1}–${Math.min(offset + 50, rows.data.total)} de ${rows.data.total} oportunidades`
          : "Sin oportunidades"}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Página anterior"
          disabled={!offset || rows.isFetching}
          onClick={() => setOffset((v) => Math.max(0, v - 50))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Página siguiente"
          disabled={offset + 50 >= (rows.data?.total ?? 0) || rows.isFetching}
          onClick={() => setOffset((v) => v + 50)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
  return (
    <PageShell width="full" spacing="compact" className="pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4 pt-1">
        <div>
          <Link
            href="/crm"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al CRM
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
              Pipeline comercial
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium",
                snapshot
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-emerald-50 text-emerald-700",
              )}
            >
              {snapshot ? (
                <LockKeyhole className="h-3 w-3" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
              {snapshot ? "Corte guardado" : "Cartera actual"}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Decisiones comerciales con evidencia, valor y próximos pasos.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Actualizar pipeline"
            className="h-9 w-9"
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: [base] })
            }
          >
            <RefreshCw
              className={cn("h-4 w-4", summary.isFetching && "animate-spin")}
            />
          </Button>
          {!snapshot && (
            <Button className="h-9 gap-2 px-4 text-xs" onClick={newOpportunity}>
              <Plus className="h-4 w-4" />
              Nueva oportunidad
            </Button>
          )}
        </div>
      </header>
      <nav
        aria-label="Vistas del pipeline"
        className="-mx-1 flex overflow-x-auto border-b border-slate-200 px-1"
      >
        {navigation.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => navigate(label)}
            aria-current={tab === label ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
              tab === label
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {label === "Alertas" && !!data?.alerted && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                {data.alerted}
              </span>
            )}
            {tab === label && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </nav>
      {snapshot && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 h-4 w-4 text-indigo-500" />
            <div>
              <p className="text-xs font-medium text-indigo-950">
                {selectedCut
                  ? `${selectedCut.period} · versión ${selectedCut.version}`
                  : "Corte guardado"}{" "}
                · solo lectura
              </p>
              <p className="mt-1 text-[11px] text-indigo-700">
                {selectedCut
                  ? `Guardado el ${dateTime(selectedCut.created_at)}. `
                  : ""}
                Los cambios actuales no modifican esta fotografía.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-8 border-indigo-200 bg-white text-xs"
            onClick={() => navigate(tab, "")}
          >
            Volver a cartera actual
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {["Resumen", "Oportunidades", "Alertas", "Concentración"].includes(
        tab,
      ) && (
        <div className="rounded-xl border border-border/70 bg-card">
          <div className="flex flex-wrap items-center gap-2 p-3">
            <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="h-9 border-slate-200 bg-slate-50/60 pl-9 text-xs"
                placeholder="Buscar cuenta, proyecto o contacto…"
                aria-label="Buscar oportunidades"
                value={filter.q ?? ""}
                onChange={(e) => update("q", e.target.value)}
              />
            </div>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              className="h-9 gap-2 text-xs"
              onClick={() => setShowFilters((v) => !v)}
            >
              <ListFilter className="h-3.5 w-3.5" />
              Filtros
              {filterCount > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 text-primary">
                  {filterCount}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  showFilters && "rotate-180",
                )}
              />
            </Button>
            {tab === "Oportunidades" && (
              <Picker
                label="Sin agrupación"
                value={filter.group ?? ""}
                options={[
                  { value: "stage", label: "Agrupar por etapa" },
                  { value: "account", label: "Agrupar por cuenta" },
                  { value: "owner", label: "Agrupar por responsable" },
                  { value: "closeMonth", label: "Agrupar por mes de cierre" },
                ]}
                onChange={(v) => update("group", v)}
              />
            )}
            <div className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              Importes respaldados · USD
            </div>
          </div>
          {showFilters && (
            <div className="flex flex-wrap items-end gap-2 border-t border-border/60 bg-slate-50/40 p-3">
              <Picker
                label="Cuenta"
                value={filter.account ?? ""}
                options={(accounts.data?.groups ?? []).map((g: any) => ({
                  value: g.name,
                  label: g.name,
                }))}
                onChange={(v) => update("account", v)}
              />
              <Picker
                label="Responsable"
                value={filter.owner ?? ""}
                options={(owners.data?.groups ?? []).map((g: any) => ({
                  value: g.name,
                  label: g.name,
                }))}
                onChange={(v) => update("owner", v)}
              />
              <Picker
                label="Etapa"
                value={filter.stage ?? ""}
                options={options(stages)}
                onChange={(v) => update("stage", v)}
              />
              <Picker
                label="Alcance"
                value={filter.scope ?? ""}
                options={options(scopes)}
                onChange={(v) => update("scope", v)}
              />
              <label className="relative">
                <span className="sr-only">Mes objetivo de cierre</span>
                <Input
                  aria-label="Mes objetivo de cierre"
                  type="month"
                  className="h-9 w-40 bg-background text-xs"
                  value={
                    filter.closeMonth === "pending"
                      ? ""
                      : (filter.closeMonth ?? "")
                  }
                  onChange={(e) => update("closeMonth", e.target.value)}
                />
              </label>
              <Button
                variant={
                  filter.closeMonth === "pending" ? "secondary" : "outline"
                }
                className="h-9 text-xs"
                onClick={() =>
                  update(
                    "closeMonth",
                    filter.closeMonth === "pending" ? "" : "pending",
                  )
                }
              >
                Sin fecha objetivo
              </Button>
            </div>
          )}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/50 px-3 py-2">
              {activeFilters.map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => update(k, "")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600"
                >
                  {v === "pending" ? "Sin fecha objetivo" : v}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                className="text-[10px] font-medium text-primary"
                onClick={clearFilters}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}
      {currentError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-center gap-2 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {String(currentError)}
          </div>
          <Button
            variant="outline"
            className="h-8 text-xs"
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: [base] })
            }
          >
            Reintentar
          </Button>
        </div>
      )}
      {success && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800"
        >
          <Check className="h-4 w-4" />
          {success}
        </p>
      )}
      {summary.isLoading && ["Resumen", "Concentración"].includes(tab) && (
        <div
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          role="status"
          aria-label="Cargando indicadores"
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border bg-slate-100/70"
            />
          ))}
        </div>
      )}
      {tab === "Resumen" && data && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              title="Pipeline Value · USD"
              value={money(data.gross)}
              icon={TrendingUp}
              coverage={{ n: data.valueCoverage, total: data.open }}
            />
            <Metric
              title="Weighted Pipeline Value · USD"
              value={money(data.weighted)}
              icon={Target}
              coverage={{ n: data.weightedCoverage, total: data.open }}
            />
            <Metric
              title="Oportunidades abiertas"
              value={data.open}
              icon={Users}
              subtitle="Alcances vigentes en el pipeline"
              onClick={() => navigate("Oportunidades")}
            />
            <Metric
              title="Oportunidades con alertas"
              value={data.alerted}
              icon={Bell}
              highlight={data.alerted > 0}
              subtitle={
                data.alerted
                  ? "Datos o acciones que requieren atención"
                  : "Sin alertas en el pipeline abierto"
              }
              onClick={() => navigate("Alertas")}
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
            <Panel
              title="Distribución por etapa"
              description="El valor conocido y su cobertura dentro de cada etapa."
              action={
                <span className="text-[10px] text-muted-foreground">
                  Pipeline abierto
                </span>
              }
            >
              <div className="px-5 py-2">
                {(data.stages ?? [])
                  .filter((s: any) => s.stage !== "Confirmada")
                  .map((s: any) => (
                    <button
                      className="grid w-full grid-cols-[minmax(120px,1fr)_42px_minmax(90px,1fr)] items-center gap-3 border-b border-slate-100 py-4 text-left last:border-0 sm:grid-cols-[minmax(140px,1fr)_minmax(60px,1fr)_38px_120px]"
                      key={s.stage}
                      onClick={() => {
                        update("stage", s.stage);
                        navigate("Oportunidades");
                      }}
                    >
                      <span className="text-xs font-medium">{s.stage}</span>
                      <div className="hidden h-2 overflow-hidden rounded-full bg-slate-100 sm:block">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            stageColors[s.stage],
                          )}
                          style={{
                            width: `${data.open ? (s.open / data.open) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-center text-sm font-semibold tabular-nums">
                        {s.open}
                      </span>
                      <span className="text-right">
                        <span className="block text-xs font-medium tabular-nums">
                          {money(s.gross)}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          USD · {s.valueCoverage}/{s.open} con valor
                        </span>
                        <span className="mt-1 block text-[10px] text-slate-400">
                          Pond. {money(s.weighted)} · {s.weightedCoverage}/
                          {s.open}
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
              {!data.open && (
                <p className="border-t border-border/60 bg-slate-50/50 px-5 py-3 text-xs text-muted-foreground">
                  Las etapas se completan al incorporar oportunidades vigentes.
                </p>
              )}
            </Panel>
            <div className="flex flex-col gap-4">
              <section className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 text-white">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[24px] border-white/[0.035]" />
                <div className="relative">
                  <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.16em] text-slate-400">
                    <Building2 className="h-3.5 w-3.5" />
                    Concentración Warner
                  </p>
                  <div className="mt-5 flex items-end gap-3">
                    <strong className="text-4xl font-semibold tracking-tight tabular-nums">
                      {pct(data.warner.countPct)}
                    </strong>
                    <span className="pb-1 text-xs text-slate-400">
                      de las abiertas
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {data.warner.open} de {data.open} oportunidades · umbral{" "}
                    {data.warner.threshold}%
                  </p>
                  <div className="mt-6 flex justify-between border-t border-white/10 pt-4 text-xs">
                    <span className="text-slate-400">
                      Participación en valor
                    </span>
                    <span>{pct(data.warner.valuePct)}</span>
                  </div>
                  <button
                    onClick={() => navigate("Concentración")}
                    className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-white"
                  >
                    Analizar exposición
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </section>
              <Panel>
                <div className="flex gap-3 p-5">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <div>
                    <h3 className="text-xs font-semibold">
                      Una lectura con contexto
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {data.open
                        ? `${data.open - data.valueCoverage} oportunidades todavía no tienen un valor USD respaldado. El ponderado utiliza solo probabilidades justificadas.`
                        : "Los importes sin evidencia se muestran pendientes. No se asignan probabilidades automáticas por etapa."}
                    </p>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
          <Panel
            title="Última evidencia comercial"
            description="Las oportunidades más recientes de la selección."
            action={
              <Button
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={() => navigate("Oportunidades")}
              >
                Ver cartera
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          >
            {rows.isLoading || visibleRows.length ? (
              <OpportunityTable
                rows={visibleRows.slice(0, 5)}
                loading={rows.isLoading}
                onOpen={openOpportunity}
                compact
              />
            ) : (
              <EmptyState
                title="La cartera está lista para empezar"
                description={
                  Object.keys(filter).length
                    ? "No encontramos oportunidades para esta selección. Probá otros filtros."
                    : "Incorporá una oportunidad o conciliá la carga inicial para empezar a seguir el valor y los próximos pasos."
                }
                action={
                  Object.keys(filter).length ? (
                    <Button variant="outline" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  ) : !snapshot ? (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={newOpportunity}
                    >
                      <Plus className="h-4 w-4" />
                      Crear primera oportunidad
                    </Button>
                  ) : undefined
                }
              />
            )}
          </Panel>
        </>
      )}
      {tab === "Alertas" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                Prioridades de seguimiento
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Una oportunidad puede tener más de un pendiente.
              </p>
            </div>
            <Button
              variant={
                filter.scope === "Validación CRM" ? "secondary" : "outline"
              }
              className="h-8 text-xs"
              onClick={() =>
                update(
                  "scope",
                  filter.scope === "Validación CRM" ? "" : "Validación CRM",
                )
              }
            >
              Revisión del CRM
              {filter.scope === "Validación CRM" && (
                <Check className="ml-2 h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertTypes.map((a) => (
              <button
                key={a}
                onClick={() => update("alert", filter.alert === a ? "" : a)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] transition-colors",
                  filter.alert === a
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-border bg-card text-muted-foreground hover:border-amber-200",
                )}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {a}
              </button>
            ))}
          </div>
        </>
      )}
      {tab === "Concentración" && data && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              {
                title: "Participación por cantidad",
                value: data.warner.countPct,
                caption: `${data.warner.open} de ${data.open} oportunidades abiertas`,
                note: "Warner dentro de la cartera abierta.",
                partial: false,
              },
              {
                title: "Participación por valor",
                value: data.warner.valuePct,
                caption: `USD ${money(data.warner.gross)} de USD ${money(data.gross)}`,
                note: `Cobertura Warner: ${data.warner.valueCoverage}/${data.warner.open}. ${data.warner.partial ? "La participación total sigue pendiente." : "Base completa."}`,
                partial: data.warner.partial,
              },
            ].map((c) => (
              <Panel key={c.title} title={c.title}>
                <div className="p-6">
                  <div className="flex items-end justify-between gap-3">
                    <strong className="text-4xl font-semibold tracking-tight tabular-nums">
                      {pct(c.value)}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      Umbral {data.warner.threshold}%
                    </span>
                  </div>
                  <div className="relative my-5 h-3 rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        c.value >= data.warner.threshold
                          ? "bg-amber-500"
                          : "bg-slate-700",
                      )}
                      style={{ width: `${Math.min(100, c.value ?? 0)}%` }}
                    />
                    <div
                      className="absolute -top-1 h-5 w-px bg-slate-400"
                      style={{ left: `${data.warner.threshold}%` }}
                    />
                  </div>
                  <p className="text-sm font-medium">{c.caption}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {c.note}
                  </p>
                  {c.value !== null && c.value >= data.warner.threshold && (
                    <Badge
                      className="mt-3 border-amber-200 bg-amber-50 text-amber-800"
                      variant="outline"
                    >
                      {c.partial
                        ? "Señal parcial de concentración"
                        : "Concentración sobre el umbral"}
                    </Badge>
                  )}
                </div>
              </Panel>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel title="Cartera fuera de Warner">
              <div className="grid grid-cols-2 gap-5 p-5">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {data.warner.outside.open}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    oportunidades abiertas
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {money(data.warner.outside.gross)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    USD · {data.warner.outside.valueCoverage}/
                    {data.warner.outside.open} con valor
                  </p>
                </div>
              </div>
            </Panel>
            {hasPermission("finance") && (
              <Panel
                title="Facturación mensual · USD"
                description="Base facturación, separada del pipeline comercial."
                action={
                  <Input
                    aria-label="Período de facturación"
                    type="month"
                    value={effectivePeriod}
                    disabled={!!snapshot}
                    className="h-8 w-36 text-xs"
                    onChange={(e) =>
                      e.target.value && setPeriod(e.target.value)
                    }
                  />
                }
              >
                <div className="px-5 py-4">
                  {billing.isLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Conciliando ingresos reales…
                    </p>
                  ) : billing.error ? (
                    <p className="text-xs text-red-700">
                      No pudimos consultar la facturación. Reintentá actualizar.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-2xl font-semibold tabular-nums">
                            {pct(billing.data?.warnerSharePct)}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Participación Warner · {effectivePeriod}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            billing.data?.state === "verified"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }
                        >
                          {billing.data?.state === "verified"
                            ? "Verificada"
                            : "Pendiente de conciliación"}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        {billing.data?.reason}
                      </p>
                      {billing.data?.state === "verified" && (
                        <p className="mt-2 text-xs">
                          Warner: USD {money(billing.data.warnerUsd)} / total
                          USD {money(billing.data.totalUsd)} ·{" "}
                          {billing.data.eventCount} hechos reales
                        </p>
                      )}
                      <p className="mt-3 border-t pt-3 text-[10px] leading-relaxed text-slate-400">
                        Referencia histórica: ≈80% informado el 28/10/2026. No
                        equivale a facturación mensual verificada.
                        {snapshot
                          ? " Esta consulta financiera es actual y no forma parte del corte congelado."
                          : ""}
                      </p>
                    </>
                  )}
                </div>
              </Panel>
            )}
          </div>
          {isAdmin && !snapshot && (
            <details className="rounded-xl border bg-card">
              <summary className="cursor-pointer px-5 py-4 text-xs font-medium text-muted-foreground">
                Configurar umbral operativo
              </summary>
              <form
                className="flex flex-wrap items-end gap-3 border-t p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void mutate("/settings", "PATCH", {
                    threshold: Number(f.get("threshold")),
                    version: settings.data?.version,
                    reason: f.get("reason"),
                  })
                    .then(() => setSuccess("Umbral actualizado y registrado."))
                    .catch(() => {});
                }}
              >
                <label className="text-xs">
                  Umbral (%)
                  <Input
                    className="mt-2 h-9 w-28"
                    name="threshold"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={data.warner.threshold}
                    required
                  />
                </label>
                <label className="min-w-[220px] flex-1 text-xs">
                  Motivo del cambio
                  <Input
                    className="mt-2 h-9"
                    name="reason"
                    placeholder="Documentá el criterio operativo"
                    required
                  />
                </label>
                <Button
                  className="h-9 text-xs"
                  disabled={busy || !settings.data}
                >
                  Guardar umbral
                </Button>
              </form>
            </details>
          )}
        </>
      )}
      {showList && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">
                {tab === "Concentración"
                  ? "Oportunidades vinculadas a Warner"
                  : tab === "Alertas"
                    ? "Oportunidades para revisar"
                    : "Cartera comercial"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {navigation.find((n) => n.label === tab)?.description}
              </p>
            </div>
            {tab === "Oportunidades" && data && (
              <p className="text-xs text-muted-foreground">
                {data.open} abiertas ·{" "}
                <span className="font-medium text-foreground">
                  USD {money(data.gross)}
                </span>{" "}
                · cobertura {data.valueCoverage}/{data.open}
              </p>
            )}
          </div>
          {rows.data?.groups?.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {rows.data.groups.map((g: any) => (
                <div
                  className="rounded-xl border bg-card px-4 py-3"
                  key={g.name}
                >
                  <p className="truncate text-xs font-medium">{g.name}</p>
                  <p className="mt-2 text-sm font-semibold">
                    USD {money(g.gross)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {g.open} abiertas · cobertura {g.valueCoverage}/{g.open}
                  </p>
                </div>
              ))}
            </div>
          )}
          <Panel>
            {rows.isLoading || visibleRows.length ? (
              <>
                <OpportunityTable
                  rows={visibleRows}
                  loading={rows.isLoading}
                  onOpen={openOpportunity}
                />
                {pagination}
              </>
            ) : (
              <EmptyState
                icon={
                  tab === "Alertas"
                    ? CheckCheck
                    : tab === "Concentración"
                      ? Building2
                      : Target
                }
                title={
                  tab === "Alertas"
                    ? "Sin alertas en esta selección"
                    : tab === "Concentración"
                      ? "Sin oportunidades de Warner en esta selección"
                      : "No encontramos oportunidades"
                }
                description={
                  Object.keys(filter).length
                    ? "Ajustá los filtros para ampliar la selección."
                    : "Las oportunidades aparecerán aquí cuando se incorporen a la cartera."
                }
                action={
                  Object.keys(filter).length ? (
                    <Button variant="outline" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  ) : tab === "Oportunidades" && !snapshot ? (
                    <Button variant="outline" onClick={newOpportunity}>
                      Nueva oportunidad
                    </Button>
                  ) : undefined
                }
              />
            )}
          </Panel>
        </>
      )}
      {tab === "Cierre mensual" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                Un corte, una conversación clara
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Guardá la cartera completa. El resumen respeta la selección que
                estás consultando.
              </p>
            </div>
            <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <span className="sr-only">Período del corte</span>
              <Input
                aria-label="Período del corte"
                type="month"
                className="h-8 w-36 border-0 bg-transparent p-0 text-xs shadow-none"
                value={effectivePeriod}
                disabled={!!snapshot}
                onChange={(e) => {
                  if (e.target.value) {
                    setPeriod(e.target.value);
                    cutKey.current = crypto.randomUUID();
                  }
                }}
              />
            </label>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(300px,1fr)_minmax(0,1.35fr)]">
            <div className="space-y-4">
              <Panel
                title={snapshot ? "Checklist del corte" : "Preparar el cierre"}
                action={
                  <span className="text-[10px] text-muted-foreground">
                    {snapshot ? "Guardado" : `${completed}/4 completados`}
                  </span>
                }
              >
                <div className="divide-y divide-slate-100">
                  {[
                    "Conciliar CRM, cotizaciones y evidencia",
                    "Validar importes y probabilidades",
                    "Registrar decisiones y actualizar Mind",
                    "Guardar corte y revisar resumen",
                  ].map((s, i) => {
                    const checked = snapshot
                      ? !!(selectedCut?.payload?.checklist?.steps ??
                          selectedCut?.payload?.checklist)?.[i]
                      : (checklist.data?.steps[i] ?? false);
                    return (
                      <label
                        key={s}
                        className="flex cursor-pointer items-start gap-3 px-5 py-4"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary"
                          checked={checked}
                          disabled={!!snapshot || busy || !checklist.data}
                          onChange={(e) => {
                            const steps = [...checklist.data.steps];
                            steps[i] = e.target.checked;
                            void mutate("/checklist/" + period, "PATCH", {
                              steps,
                              version: checklist.data.version,
                              reason: s,
                            }).catch(() => {});
                          }}
                        />
                        <span>
                          <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                            Paso {i + 1}
                          </span>
                          <span
                            className={cn(
                              "mt-1 block text-xs",
                              checked ? "text-muted-foreground" : "font-medium",
                            )}
                          >
                            {s}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Panel>
              {!snapshot && (
                <Panel
                  title="Decisión del período"
                  description="Dejá un fundamento antes de guardar el corte."
                >
                  <div className="p-5">
                    <textarea
                      aria-label="Decisión o motivo del corte"
                      className="min-h-[110px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Qué cambió, qué se decidió y qué queda por resolver…"
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canReadQuotes && (
                        <Button
                          variant="outline"
                          className="h-9 text-xs"
                          disabled={busy || !decision.trim()}
                          onClick={() =>
                            void mutate("/decisions", "POST", {
                              period,
                              reason: decision,
                            })
                              .then(() => {
                                setSuccess("Decisión registrada.");
                                setDecision("");
                              })
                              .catch(() => {})
                          }
                        >
                          Registrar decisión
                        </Button>
                      )}
                      <Button
                        className="h-9 gap-2 text-xs"
                        disabled={busy || !decision.trim()}
                        onClick={() =>
                          void mutate("/cuts", "POST", {
                            period,
                            reason: decision,
                            requestKey: cutKey.current,
                          })
                            .then((r: any) => {
                              cutKey.current = crypto.randomUUID();
                              navigate(tab, String(r.id));
                              setSuccess(
                                "Corte guardado. Podés revisar y compartir el resumen.",
                              );
                            })
                            .catch(() => {})
                        }
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LockKeyhole className="h-3.5 w-3.5" />
                        )}
                        Guardar corte
                      </Button>
                    </div>
                  </div>
                </Panel>
              )}
              <Panel
                title="Cortes guardados"
                description="Cada versión conserva su propia cartera."
              >
                {cuts.isLoading ? (
                  <p className="p-5 text-xs text-muted-foreground">
                    Cargando cortes…
                  </p>
                ) : cuts.data?.length ? (
                  <div className="max-h-72 divide-y overflow-auto">
                    {cuts.data.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => navigate(tab, String(c.id))}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50",
                          snapshot === String(c.id) && "bg-indigo-50/60",
                        )}
                      >
                        <span>
                          <span className="text-xs font-semibold">
                            {c.period}{" "}
                            <span className="ml-2 font-normal text-muted-foreground">
                              v{c.version}
                            </span>
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {dateTime(c.created_at)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-5 py-6 text-xs leading-relaxed text-muted-foreground">
                    Todavía no hay cortes guardados. El primero será la base de
                    las próximas comparaciones.
                  </p>
                )}
              </Panel>
            </div>
            <Panel
              title="Resumen para Fede"
              description={`${effectivePeriod} · listo para revisar y compartir manualmente`}
              action={<FileText className="h-4 w-4 text-slate-400" />}
            >
              <div className="p-5">
                <textarea
                  aria-label="Resumen para Fede"
                  readOnly
                  className="min-h-[440px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-[13px] leading-7 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={
                    text.isLoading
                      ? "Preparando resumen…"
                      : (text.data?.text ?? "Pendiente")
                  }
                />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    className="h-9 gap-2 text-xs"
                    disabled={!text.data?.text}
                    onClick={() =>
                      navigator.clipboard
                        .writeText(text.data.text)
                        .then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2500);
                        })
                        .catch((e) => setError(e.message))
                    }
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? "Copiado" : "Copiar resumen"}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 gap-2 text-xs"
                    disabled={!text.data?.text}
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([text.data.text], {
                          type: "text/plain;charset=utf-8",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `pipeline-${effectivePeriod}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar TXT
                  </Button>
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground">
                  El resumen no se envía automáticamente a ningún canal.
                </p>
              </div>
            </Panel>
          </div>
        </>
      )}
      {tab === "Registro" && (
        <Panel
          title="Historial de decisiones y cambios"
          description="Quién cambió qué, cuándo y con qué fundamento."
          action={<History className="h-4 w-4 text-slate-400" />}
        >
          {!canReadQuotes ? (
            <EmptyState
              icon={LockKeyhole}
              title="Registro con acceso restringido"
              description="Necesitás acceso a cotizaciones para consultar los fundamentos y las fuentes del registro."
            />
          ) : log.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">
              Cargando registro…
            </p>
          ) : !log.data?.length ? (
            <EmptyState
              icon={History}
              title="El historial empieza con la primera decisión"
              description="Las altas, ediciones, cierres y cambios de configuración quedarán registrados acá."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {log.data.map((r: any) => {
                const changes = r.changes?.after
                  ? Object.keys(r.changes.after).filter(
                      (k) =>
                        JSON.stringify(r.changes.after[k]) !==
                        JSON.stringify(r.changes.before?.[k]),
                    )
                  : Object.keys(r.changes ?? {});
                return (
                  <article key={r.id} className="flex gap-4 px-5 py-5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                      <CircleDot className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs">
                          <span className="font-semibold">
                            {r.actor || `Usuario ${r.actor_id}`}
                          </span>
                          <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] capitalize text-slate-600">
                            {r.kind}
                          </span>
                        </p>
                        <time className="text-[10px] text-muted-foreground">
                          {dateTime(r.created_at)}
                        </time>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed">{r.reason}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.period && (
                          <span className="text-[10px] text-muted-foreground">
                            Período {r.period}
                          </span>
                        )}
                        {changes.slice(0, 8).map((k) => (
                          <span
                            key={k}
                            className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500"
                          >
                            {fieldLabels[k] ?? k}
                          </span>
                        ))}
                        {changes.length > 8 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{changes.length - 8} campos
                          </span>
                        )}
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-[10px] text-muted-foreground">
                          Ver detalle del cambio
                        </summary>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-600">
                          {JSON.stringify(r.changes, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button
              variant="outline"
              className="h-8 text-xs"
              disabled={!logOffset}
              onClick={() => setLogOffset((v) => Math.max(0, v - 100))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              className="h-8 text-xs"
              disabled={(log.data?.length ?? 0) < 100}
              onClick={() => setLogOffset((v) => v + 100)}
            >
              Siguiente
            </Button>
          </div>
        </Panel>
      )}
      <OpportunityEditor
        opportunity={editing}
        readOnly={!!snapshot}
        busy={busy}
        error={error}
        onClose={() => setEditing(null)}
        onSave={async (data, reason) => {
          const id = editing?.id;
          await mutate(
            id ? "/opportunities/" + id : "/opportunities",
            id ? "PATCH" : "POST",
            {
              data,
              reason,
              ...(id
                ? { version: editing?.version }
                : { requestKey: createKey.current }),
            },
          );
          setEditing(null);
          setSuccess(id ? "Oportunidad actualizada." : "Oportunidad creada.");
        }}
      />
    </PageShell>
  );
}
