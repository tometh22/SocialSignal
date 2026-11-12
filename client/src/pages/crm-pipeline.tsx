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
import {
  OpportunityEditor,
  stageColors,
} from "@/components/pipeline/opportunity-editor";
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
// Escala tipográfica compartida por todas las vistas del módulo.
const tableHead =
  "bg-slate-50/80 text-xs font-medium uppercase tracking-wider text-slate-500";
const cardBase = "rounded-2xl border border-slate-200/80 bg-card shadow-sm";
const isPending = (value: unknown) => value === null || value === undefined;
/** Muestra un importe o un "Pendiente" atenuado, para que el dato faltante no compita con los reales. */
function Amount({
  value,
  format = money,
  className,
}: {
  value: unknown;
  format?: (v: unknown) => string;
  className?: string;
}) {
  return isPending(value) ? (
    <span className="font-normal text-slate-400">Pendiente</span>
  ) : (
    <span className={cn("tabular-nums", className)}>{format(value)}</span>
  );
}
function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
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
    <section className={cn("overflow-hidden", cardBase, className)}>
      {title && (
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
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
      <div className="flex items-center justify-between text-sm">
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
  unit,
  icon: Icon,
  subtitle,
  coverage,
  highlight = false,
  onClick,
}: {
  title: string;
  /** `null`/`undefined` se muestran como "Pendiente" atenuado. */
  value: ReactNode;
  unit?: string;
  icon: LucideIcon;
  subtitle?: string;
  coverage?: { n: number; total: number };
  highlight?: boolean;
  onClick?: () => void;
}) {
  const pending = isPending(value) || value === "Pendiente";
  return (
    <div
      className={cn(
        "relative flex min-h-[136px] flex-col rounded-2xl border bg-card p-5 shadow-sm",
        highlight ? "border-amber-200 bg-amber-50/40" : "border-slate-200/80",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className="truncate text-sm font-medium text-muted-foreground"
          title={title}
        >
          {title}
        </p>
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            highlight ? "text-amber-600" : "text-slate-400",
          )}
        />
      </div>
      <p className="mt-2 flex h-9 items-baseline gap-1.5">
        {pending ? (
          <span className="text-xl font-medium text-slate-400">Pendiente</span>
        ) : (
          <>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {value}
            </span>
            {unit && (
              <span className="text-sm font-medium text-muted-foreground">
                {unit}
              </span>
            )}
          </>
        )}
      </p>
      <div className="mt-auto pt-4">
        {coverage ? (
          <Coverage {...coverage} />
        ) : (
          <p className="text-sm leading-snug text-muted-foreground">
            {subtitle}
          </p>
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
          className="h-9 justify-between gap-3 bg-background px-3 text-sm font-normal"
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
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium leading-5 text-slate-700">
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
  const cell = "px-2.5 py-3.5 align-top";
  const head = "whitespace-nowrap px-2.5 py-3 font-medium";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className={tableHead}>
          <tr>
            <th className={cn(head, "min-w-[200px] pl-5")}>
              Cuenta y oportunidad
            </th>
            <th className={cn(head, "min-w-[140px]")}>Situación</th>
            <th className={cn(head, "text-right")}>Valor USD</th>
            {!compact && (
              <th className={cn(head, "text-right")}>Ponderado USD</th>
            )}
            <th className={cn(head, "min-w-[160px]")}>
              {compact ? "Próximo paso" : "Seguimiento"}
            </th>
            {!compact && <th className={head}>Responsable</th>}
            {!compact && (
              <th className={cn(head, "hidden min-w-[170px] 2xl:table-cell")}>
                Fuente
              </th>
            )}
            <th className="w-10 px-2 py-3">
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
            : rows.map((r) => {
                const weighted = metrics([r]).weighted;
                return (
                  <tr
                    className="group transition-colors hover:bg-slate-50/80"
                    key={r.id ?? r.importKey}
                  >
                    <td className={cn(cell, "pl-5")}>
                      <button
                        onClick={() => onOpen(r)}
                        className="block max-w-[340px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="block font-semibold leading-5 text-slate-900 group-hover:text-primary">
                          {r.account}
                        </span>
                        <span className="mt-0.5 block leading-5 text-muted-foreground">
                          {r.project || "Alcance por definir"}
                        </span>
                      </button>
                      {!compact && (
                        <span className="mt-1 block text-xs text-slate-400">
                          {r.contact || "Contacto pendiente"}
                        </span>
                      )}
                    </td>
                    <td className={cell}>
                      <StageBadge stage={r.stage} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.status} · {r.scope}
                      </p>
                      {!compact && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          Confianza {r.confidence?.toLowerCase()}
                        </p>
                      )}
                    </td>
                    <td
                      className={cn(
                        cell,
                        "whitespace-nowrap text-right font-medium leading-5",
                      )}
                    >
                      <Amount value={r.usd} />
                    </td>
                    {!compact && (
                      <td
                        className={cn(
                          cell,
                          "whitespace-nowrap text-right leading-5",
                        )}
                      >
                        <Amount value={weighted} className="font-medium" />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {isPending(r.probability)
                            ? "Sin probabilidad"
                            : `Probabilidad ${pct(r.probability)}`}
                        </p>
                      </td>
                    )}
                    <td className={cn(cell, "max-w-[240px]")}>
                      <p className="line-clamp-2 leading-5 text-slate-700">
                        {compact ? (
                          r.next || (
                            <span className="text-slate-400">
                              Definir próximo paso
                            </span>
                          )
                        ) : r.closeDate ? (
                          civilDate(r.closeDate)
                        ) : (
                          <span className="text-slate-400">
                            Sin fecha objetivo
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                        {compact
                          ? civilDate(r.nextDate)
                          : `Evidencia: ${civilDate(r.evidenceDate)}`}
                      </p>
                      {r.alerts?.length > 0 && (
                        <button
                          onClick={() => onOpen(r)}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700"
                          title={r.alerts.join(" · ")}
                        >
                          <AlertCircle className="h-3 w-3" />
                          {r.alerts.length}{" "}
                          {r.alerts.length === 1 ? "pendiente" : "pendientes"}
                        </button>
                      )}
                    </td>
                    {!compact && (
                      <td className={cell}>
                        <span className="inline-flex items-center gap-2 whitespace-nowrap leading-5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
                            {r.owner
                              ? r.owner
                                  .split(" ")
                                  .map((s: string) => s[0])
                                  .slice(0, 2)
                                  .join("")
                              : "—"}
                          </span>
                          {r.owner || (
                            <span className="text-slate-400">
                              Sin responsable
                            </span>
                          )}
                        </span>
                      </td>
                    )}
                    {!compact && (
                      <td
                        className={cn(
                          cell,
                          "hidden max-w-[220px] 2xl:table-cell",
                        )}
                      >
                        {r.sources?.[0] ? (
                          <>
                            <a
                              className="inline-flex items-start gap-1 font-medium leading-5 text-primary hover:underline"
                              href={r.sources[0].url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span className="line-clamp-2">
                                {r.sources[0].title}
                              </span>
                              <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            </a>
                            {r.sources.length > 1 && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                +{r.sources.length - 1} en detalle
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="leading-5 text-slate-400">
                            Pendiente
                          </span>
                        )}
                      </td>
                    )}
                    <td className={cn(cell, "px-2 py-2.5")}>
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
                );
              })}
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
  const alertScope =
    filter.scope === "Validación CRM" ? "Validación CRM" : "Pipeline";
  const qs = new URLSearchParams({
    ...(["Resumen", "Concentración"].includes(tab) ? {} : filter),
    ...(tab === "Alertas" ? { scope: alertScope } : {}),
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
      `/${tab === "Alertas" ? "alerts" : "opportunities"}?${qs}&offset=${offset}${tab === "Concentración" ? "&warner=true" : tab === "Resumen" ? "&scope=Pipeline" : ""}`,
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
  const countParams = new URLSearchParams(qs);
  countParams.delete("scope");
  countParams.delete("alert");
  countParams.delete("group");
  const scopeSummary = useData(
    "/summary?" + countParams.toString(),
    tab === "Oportunidades",
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
      <span className="text-sm text-muted-foreground">
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
    <PageShell
      width="full"
      spacing="compact"
      className="pb-8 !space-y-3 text-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/crm"
            aria-label="Volver al CRM"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Pipeline comercial
          </h1>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            {snapshot ? (
              <LockKeyhole className="h-4 w-4" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
            {snapshot ? "Corte guardado" : "Cartera actual"}
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            className="h-9 shrink-0 gap-2 text-sm"
            aria-label="Resumen para Fede"
            onClick={() => navigate("Cierre mensual")}
          >
            <ClipboardCheck className="h-4 w-4" />
            <span className="sm:hidden">Resumen</span>
            <span className="hidden sm:inline">Resumen para Fede</span>
          </Button>
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
            <Button className="h-9 gap-2 text-sm" onClick={newOpportunity}>
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
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
              tab === label
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {label === "Alertas" && !!data?.alerted && (
              <span className="rounded-full bg-amber-100 px-1.5 text-xs font-medium leading-5 tabular-nums text-amber-800">
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
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-indigo-950">
            <LockKeyhole className="h-4 w-4 shrink-0 text-indigo-500" />
            <span className="font-medium">
              {selectedCut
                ? `${selectedCut.period} · versión ${selectedCut.version}`
                : "Corte guardado"}{" "}
              · solo lectura
            </span>
            {selectedCut && (
              <span className="text-indigo-700/80">
                · Guardado {dateTime(selectedCut.created_at)}
              </span>
            )}
          </p>
          <button
            className="inline-flex items-center gap-1.5 font-medium text-indigo-800 hover:text-indigo-950"
            onClick={() => navigate(tab, "")}
          >
            Cartera actual
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {tab === "Oportunidades" && (
        <div className={cardBase}>
          <div className="flex flex-wrap items-center gap-2 p-3">
            <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 border-slate-200 bg-slate-50/60 pl-9 text-sm"
                placeholder="Buscar cuenta, proyecto o contacto…"
                aria-label="Buscar oportunidades"
                value={filter.q ?? ""}
                onChange={(e) => update("q", e.target.value)}
              />
            </div>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              className="h-9 gap-2 text-sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <ListFilter className="h-4 w-4" />
              Filtros
              {filterCount > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 text-xs leading-5 tabular-nums text-primary">
                  {filterCount}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 opacity-50 transition-transform",
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
            <div className="ml-auto hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
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
                  className="h-9 w-40 bg-background text-sm"
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
                className="h-9 text-sm"
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
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2">
              {activeFilters.map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => update(k, "")}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-slate-100 px-2 text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  {v === "pending" ? "Sin fecha objetivo" : v}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                className="text-xs font-medium text-primary"
                onClick={clearFilters}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}
      {tab === "Oportunidades" && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            { scope: "", label: "Todas" },
            ...scopes.map((scope) => ({
              scope,
              label:
                scope === "Cerrada / confirmada"
                  ? "Confirmadas"
                  : scope === "Descartada"
                    ? "Descartadas"
                    : scope,
            })),
          ].map(({ scope, label }) => (
            <button
              key={scope}
              onClick={() => update("scope", scope)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                (filter.scope ?? "") === scope
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-card text-slate-600 hover:bg-slate-50",
              )}
            >
              <span>{label}</span>
              <span
                className={cn(
                  "rounded-md px-1.5 text-xs leading-5 tabular-nums",
                  (filter.scope ?? "") === scope
                    ? "bg-primary/10 text-primary"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {scopeSummary.isLoading
                  ? "…"
                  : scope
                    ? (scopeSummary.data?.scopeCounts?.[scope] ?? 0)
                    : Object.values(
                        scopeSummary.data?.scopeCounts ?? {},
                      ).reduce(
                        (total: number, n: unknown) => total + Number(n),
                        0,
                      )}
              </span>
            </button>
          ))}
        </div>
      )}
      {currentError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
        >
          <div className="flex items-center gap-2 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {String(currentError)}
          </div>
          <Button
            variant="outline"
            className="h-8 text-sm"
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
          className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
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
              title="Pipeline Value"
              value={isPending(data.gross) ? null : money(data.gross)}
              unit="USD"
              icon={TrendingUp}
              coverage={{ n: data.valueCoverage, total: data.open }}
            />
            <Metric
              title="Weighted Pipeline Value"
              value={isPending(data.weighted) ? null : money(data.weighted)}
              unit="USD"
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
              title="Oportunidades en alerta"
              value={data.alerted}
              icon={Bell}
              highlight={data.alerted > 0}
              subtitle={
                data.alerted
                  ? "Con datos o acciones que requieren atención"
                  : "Sin alertas en el pipeline abierto"
              }
              onClick={() => navigate("Alertas")}
            />
          </div>
          <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
            <Panel
              title="Pipeline por etapa"
              description="Cartera abierta, importes USD y cobertura de evidencia."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className={tableHead}>
                    <tr>
                      <th className="whitespace-nowrap px-5 py-3 font-medium">
                        Etapa
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-medium">
                        Abiertas
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-medium">
                        Bruto USD
                      </th>
                      <th className="whitespace-nowrap px-5 py-3 text-right font-medium">
                        Ponderado USD
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(data.stages ?? [])
                      .filter(
                        (stage: any) =>
                          stage.stage !== "Confirmada" &&
                          (stage.open > 0 ||
                            stage.stage !== "Sin etapa verificada"),
                      )
                      .map((stage: any) => (
                        <tr
                          key={stage.stage}
                          className="transition-colors hover:bg-slate-50/80"
                        >
                          <td className="px-5 py-3.5 align-top">
                            <button
                              className="inline-flex items-center gap-2 text-left font-medium leading-5 hover:text-primary"
                              onClick={() => {
                                update("stage", stage.stage);
                                navigate("Oportunidades");
                              }}
                            >
                              <span
                                className={cn(
                                  "h-2 w-2 shrink-0 rounded-full",
                                  stageColors[stage.stage],
                                )}
                              />
                              {stage.stage}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-right align-top font-medium leading-5 tabular-nums">
                            {stage.open}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right align-top leading-5">
                            <Amount
                              value={stage.gross}
                              className="font-medium"
                            />
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {stage.valueCoverage}/{stage.open} con valor
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right align-top leading-5">
                            <Amount
                              value={stage.weighted}
                              className="font-medium"
                            />
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {stage.weightedCoverage}/{stage.open} respaldadas
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!data.open && (
                <p className="border-t bg-slate-50/50 px-5 py-3 text-sm text-muted-foreground">
                  Las etapas se completan al incorporar oportunidades vigentes.
                </p>
              )}
            </Panel>
            <Panel
              title="Exposición a Warner"
              description={
                hasPermission("finance")
                  ? "Referencia de facturación, separada de la cartera abierta."
                  : "Participación en la cartera abierta."
              }
            >
              <div className="flex h-full flex-col gap-4 p-5">
                {hasPermission("finance") && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Facturación histórica informada
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                      ≈80%
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Referencia del 28/10/2026. La participación en facturación
                      mensual sigue pendiente de conciliación.
                    </p>
                  </div>
                )}
                <dl className="space-y-2 border-t border-slate-100 pt-4 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">Pipeline abierto</dt>
                    <dd className="text-right font-medium tabular-nums">
                      {data.warner.open} de {data.open} oportunidades
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">
                      Participación en valor
                    </dt>
                    <dd className="text-right font-medium">
                      <Amount value={data.warner.valuePct} format={pct} />
                    </dd>
                  </div>
                </dl>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  La cantidad de oportunidades no mide la dependencia económica.
                  Cobertura de valor: {data.valueCoverage}/{data.open}.
                </p>
                <button
                  className="mt-auto inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
                  onClick={() => navigate("Concentración")}
                >
                  Ver concentración
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </Panel>
          </div>
          <Panel
            title="Oportunidades en seguimiento"
            description="Pipeline abierto, ordenado por la última evidencia comercial."
            action={
              <button
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                onClick={() => navigate("Oportunidades")}
              >
                Ver cartera
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
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
          <SectionHeading
            title="Alertas de seguimiento"
            description="Datos que faltan para avanzar. Una oportunidad puede tener varias alertas."
            action={
              <div className="flex gap-2">
                {["Pipeline", "Validación CRM"].map((scope) => (
                  <Button
                    key={scope}
                    variant={alertScope === scope ? "secondary" : "outline"}
                    className="h-9 text-sm"
                    onClick={() => {
                      update("scope", scope);
                      update("alert", "");
                    }}
                  >
                    {scope}
                  </Button>
                ))}
              </div>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {alertTypes.map((alert) => (
              <button
                key={alert}
                aria-pressed={filter.alert === alert}
                onClick={() =>
                  update("alert", filter.alert === alert ? "" : alert)
                }
                className={cn(
                  "flex min-h-[112px] flex-col items-stretch justify-start rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  filter.alert === alert
                    ? "border-amber-400 bg-amber-50/60"
                    : "border-slate-200/80 hover:border-amber-200",
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-3xl font-semibold leading-9 tracking-tight tabular-nums">
                    {summary.isLoading
                      ? "…"
                      : (data?.alertCounts?.[alert] ?? 0)}
                  </span>
                  <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
                </span>
                <span className="mt-2 text-sm font-medium leading-snug text-slate-600">
                  {alert}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {tab === "Concentración" && data && (
        <>
          <div
            className={cn(
              "grid gap-3",
              hasPermission("finance") ? "lg:grid-cols-3" : "lg:grid-cols-2",
            )}
          >
            {hasPermission("finance") && (
              <Metric
                title="Facturación histórica informada"
                value="≈80%"
                icon={Building2}
                subtitle="Referencia del 28/10/2026 · conciliación mensual pendiente"
              />
            )}
            <Metric
              title="Warner / bruto cuantificado"
              value={
                isPending(data.warner.valuePct)
                  ? null
                  : pct(data.warner.valuePct)
              }
              icon={TrendingUp}
              subtitle={`${isPending(data.warner.gross) ? "Warner sin valor" : `USD ${money(data.warner.gross)}`} de USD ${money(data.gross)} · cobertura ${data.valueCoverage}/${data.open}`}
            />
            <Metric
              title="Warner / oportunidades abiertas"
              value={`${data.warner.open} de ${data.open}`}
              icon={Users}
              subtitle={`${data.warner.outside.open} oportunidades fuera de Warner. No mide facturación.`}
            />
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 px-5 py-4 text-sm leading-relaxed">
            <p className="font-semibold">Lectura de concentración</p>
            <p className="mt-1 text-muted-foreground">
              Umbral operativo: {data.warner.threshold}%.{" "}
              {data.warner.valuePct === null
                ? "Faltan valores para medir la concentración del pipeline."
                : data.warner.partial
                  ? "La participación describe solo el bruto cuantificado; la concentración total sigue pendiente."
                  : data.warner.signal
                    ? "El bruto cuantificado alcanza el umbral operativo."
                    : "El bruto cuantificado está por debajo del umbral."}{" "}
              La referencia de facturación histórica y la cantidad de
              oportunidades representan bases diferentes.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Cartera fuera de Warner"
              description="Oportunidades abiertas de otras cuentas."
            >
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="px-5 py-4">
                  <p className="text-sm text-muted-foreground">
                    Oportunidades abiertas
                  </p>
                  <p className="mt-1 text-2xl font-semibold leading-8 tracking-tight tabular-nums">
                    {data.warner.outside.open}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm text-muted-foreground">
                    Bruto USD · {data.warner.outside.valueCoverage}/
                    {data.warner.outside.open} con valor
                  </p>
                  <p className="mt-1 text-2xl font-semibold leading-8 tracking-tight">
                    {isPending(data.warner.outside.gross) ? (
                      <span className="text-xl font-medium text-slate-400">
                        Pendiente
                      </span>
                    ) : (
                      <span className="tabular-nums">
                        {money(data.warner.outside.gross)}
                      </span>
                    )}
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
                    className="h-8 w-36 text-sm"
                    onChange={(e) =>
                      e.target.value && setPeriod(e.target.value)
                    }
                  />
                }
              >
                <div className="px-5 py-4">
                  {billing.isLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Conciliando ingresos reales…
                    </p>
                  ) : billing.error ? (
                    <p className="text-sm text-red-700">
                      No pudimos consultar la facturación. Reintentá actualizar.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Participación Warner · {effectivePeriod}
                          </p>
                          <p className="mt-1 text-2xl font-semibold leading-8 tracking-tight">
                            {isPending(billing.data?.warnerSharePct) ? (
                              <span className="text-xl font-medium text-slate-400">
                                Pendiente
                              </span>
                            ) : (
                              <span className="tabular-nums">
                                {pct(billing.data?.warnerSharePct)}
                              </span>
                            )}
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
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {billing.data?.reason}
                      </p>
                      {billing.data?.state === "verified" && (
                        <p className="mt-2 text-sm">
                          Warner: USD {money(billing.data.warnerUsd)} / total
                          USD {money(billing.data.totalUsd)} ·{" "}
                          {billing.data.eventCount} hechos reales
                        </p>
                      )}
                      <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-muted-foreground">
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
            <details className={cardBase}>
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-muted-foreground hover:text-foreground">
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
                <label className="text-sm font-medium">
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
                <label className="min-w-[220px] flex-1 text-sm font-medium">
                  Motivo del cambio
                  <Input
                    className="mt-2 h-9"
                    name="reason"
                    placeholder="Documentá el criterio operativo"
                    required
                  />
                </label>
                <Button
                  className="h-9 text-sm"
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
          <SectionHeading
            title={
              tab === "Concentración"
                ? "Oportunidades vinculadas a Warner"
                : tab === "Alertas"
                  ? "Oportunidades para revisar"
                  : "Cartera comercial"
            }
            description={navigation.find((n) => n.label === tab)?.description}
            action={
              tab === "Oportunidades" && data ? (
                <p className="text-sm tabular-nums text-muted-foreground">
                  {data.open} abiertas ·{" "}
                  <span className="font-medium text-foreground">
                    USD {money(data.gross)}
                  </span>{" "}
                  · cobertura {data.valueCoverage}/{data.open}
                </p>
              ) : undefined
            }
          />
          <Panel>
            {rows.isLoading || visibleRows.length ? (
              <>
                {tab === "Oportunidades" && filter.group && !rows.isLoading ? (
                  Object.entries(
                    Object.groupBy(visibleRows, (r: any) =>
                      filter.group === "closeMonth"
                        ? (r.closeDate?.slice(0, 7) ?? "Sin fecha de cierre")
                        : (r[filter.group] ?? "Sin responsable"),
                    ),
                  ).map(([name, items], groupIndex) => {
                    const aggregate = rows.data?.groups?.find(
                      (g: any) => g.name === name,
                    );
                    return (
                      <section key={name}>
                        <div
                          className={cn(
                            "border-b border-slate-200 bg-slate-50/60 px-5 py-3",
                            groupIndex > 0 && "border-t",
                          )}
                        >
                          <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
                            {name}
                            <span className="font-normal text-muted-foreground">
                              {items?.length} en esta página
                            </span>
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Grupo completo · bruto USD {money(aggregate?.gross)}{" "}
                            · ponderado USD {money(aggregate?.weighted)} ·
                            cobertura {aggregate?.valueCoverage ?? 0}/
                            {aggregate?.open ?? 0}
                          </p>
                        </div>
                        <OpportunityTable
                          rows={items ?? []}
                          loading={false}
                          onOpen={openOpportunity}
                        />
                      </section>
                    );
                  })
                ) : (
                  <OpportunityTable
                    rows={visibleRows}
                    loading={rows.isLoading}
                    onOpen={openOpportunity}
                  />
                )}
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
          <SectionHeading
            title="Un corte, una conversación clara"
            description="Guardá la cartera completa. El resumen respeta la selección que estás consultando."
            action={
              <label className="flex h-9 items-center gap-2 rounded-lg border bg-card px-3">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <span className="sr-only">Período del corte</span>
                <Input
                  aria-label="Período del corte"
                  type="month"
                  className="h-7 w-36 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
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
            }
          />
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(300px,1fr)_minmax(0,1.35fr)]">
            <div className="space-y-4">
              <Panel
                title={snapshot ? "Checklist del corte" : "Preparar el cierre"}
                action={
                  <span className="rounded-md bg-slate-100 px-2 text-xs font-medium leading-6 tabular-nums text-slate-600">
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
                        className="flex cursor-pointer items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded border-slate-300 accent-primary"
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
                          <span className="block text-xs font-medium uppercase leading-4 tracking-wider text-slate-400">
                            Paso {i + 1}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block text-sm font-medium",
                              checked && "text-muted-foreground",
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
                          className="h-9 text-sm"
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
                        className="h-9 gap-2 text-sm"
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
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LockKeyhole className="h-4 w-4" />
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
                  <p className="px-5 py-4 text-sm text-muted-foreground">
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
                          <span className="flex items-baseline gap-2 text-sm font-semibold tabular-nums">
                            {c.period}
                            <span className="text-xs font-medium text-muted-foreground">
                              v{c.version}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {dateTime(c.created_at)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-5 py-4 text-sm leading-relaxed text-muted-foreground">
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
                  className="min-h-[440px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm leading-7 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={
                    text.isLoading
                      ? "Preparando resumen…"
                      : (text.data?.text ?? "Pendiente")
                  }
                />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    className="h-9 gap-2 text-sm"
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
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "Copiado" : "Copiar resumen"}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 gap-2 text-sm"
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
                    <Download className="h-4 w-4" />
                    Descargar TXT
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
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
            <p className="px-5 py-4 text-sm text-muted-foreground">
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
                  <article key={r.id} className="flex gap-4 px-5 py-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                      <CircleDot className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm">
                          <span className="font-semibold">
                            {r.actor || `Usuario ${r.actor_id}`}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 text-xs font-medium capitalize leading-5 text-slate-600">
                            {r.kind}
                          </span>
                        </p>
                        <time className="text-xs text-muted-foreground">
                          {dateTime(r.created_at)}
                        </time>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed">
                        {r.reason}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {r.period && (
                          <span className="text-xs text-muted-foreground">
                            Período {r.period}
                          </span>
                        )}
                        {changes.slice(0, 8).map((k) => (
                          <span
                            key={k}
                            className="rounded-md border border-slate-200 px-1.5 text-xs leading-5 text-slate-500"
                          >
                            {fieldLabels[k] ?? k}
                          </span>
                        ))}
                        {changes.length > 8 && (
                          <span className="text-xs text-muted-foreground">
                            +{changes.length - 8} campos
                          </span>
                        )}
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                          Ver detalle del cambio
                        </summary>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
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
              className="h-8 text-sm"
              disabled={!logOffset}
              onClick={() => setLogOffset((v) => Math.max(0, v - 100))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              className="h-8 text-sm"
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
