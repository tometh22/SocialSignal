import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  effectiveProbability,
  metrics,
  type Opportunity,
  type SortKey,
} from "@shared/pipeline";
import {
  Amount,
  StageBadge,
  civilDate,
  initials,
  isPending,
  pct,
  pendingText,
  tableHead,
} from "./ui";

type Props = {
  rows: any[];
  loading: boolean;
  /** Sin `onOpen` la lista es de solo lectura (enlace compartido): no abre la ficha. */
  onOpen?: (r: Opportunity, section?: string) => void;
  compact?: boolean;
  /** Orden activo, p. ej. "usd" o "-usd". */
  sort?: string;
  onSort?: (sort: string) => void;
};
// Importes: primero los mayores. Texto, etapa y fechas: orden natural.
const descFirst = new Set<SortKey>(["usd", "weighted"]);
const nextSort = (key: SortKey, current?: string) => {
  const active = current?.replace(/^-/, "") === key;
  if (!active) return descFirst.has(key) ? `-${key}` : key;
  return current!.startsWith("-") ? key : `-${key}`;
};
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

function AlertsBadge({ r, onOpen }: { r: any; onOpen: Props["onOpen"] }) {
  if (!r.alerts?.length) return null;
  if (!onOpen)
    return (
      <span
        className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700"
        title={r.alerts.join(" · ")}
      >
        <AlertCircle className="h-3 w-3" />
        {r.alerts.length} {r.alerts.length === 1 ? "pendiente" : "pendientes"}
      </span>
    );
  return (
    <button
      onClick={(e) => {
        stop(e);
        onOpen(r);
      }}
      className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700"
      title={r.alerts.join(" · ")}
    >
      <AlertCircle className="h-3 w-3" />
      {r.alerts.length} {r.alerts.length === 1 ? "pendiente" : "pendientes"}
    </button>
  );
}
/** Probabilidad efectiva (propia o del modelo); con `onOpen`, abre la ficha en esa sección. */
function ProbabilityTag({ r, onOpen }: { r: any; onOpen: Props["onOpen"] }) {
  const p =
    r.probabilityBasis !== undefined
      ? { value: r.probability, basis: r.probabilityBasis }
      : effectiveProbability(r);
  if (isPending(p.value)) return null;
  const text = `${pct(p.value)}${p.basis === "model" ? " · modelo" : ""}`;
  return onOpen ? (
    <button
      type="button"
      title="Ajustar la probabilidad"
      onClick={(e) => {
        stop(e);
        onOpen(r, "Probabilidad");
      }}
      className="rounded-full bg-indigo-50 px-2 text-xs font-medium leading-5 text-indigo-700"
    >
      {text}
    </button>
  ) : (
    <span className="rounded-full bg-indigo-50 px-2 text-xs font-medium leading-5 text-indigo-700">
      {text}
    </span>
  );
}
function FollowUp({ r, compact }: { r: any; compact: boolean }) {
  return (
    <>
      <p className="line-clamp-2 leading-5 text-slate-700">
        {compact ? (
          r.next || <span className={pendingText}>Definir próximo paso</span>
        ) : r.closeDate ? (
          civilDate(r.closeDate)
        ) : (
          <span className={pendingText}>Sin fecha objetivo</span>
        )}
      </p>
      <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
        {compact
          ? civilDate(r.nextDate)
          : `Evidencia: ${civilDate(r.evidenceDate)}`}
      </p>
    </>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey?: SortKey;
  sort?: string;
  onSort?: (sort: string) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const base = cn(
    "whitespace-nowrap px-2.5 py-3 font-medium",
    align === "right" && "text-right",
    className,
  );
  if (!sortKey || !onSort) return <th className={base}>{label}</th>;
  const active = sort?.replace(/^-/, "") === sortKey;
  const desc = active && sort!.startsWith("-");
  const Icon = !active ? ChevronsUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <th
      className={base}
      aria-sort={!active ? "none" : desc ? "descending" : "ascending"}
    >
      <button
        type="button"
        title={`Ordenar por ${label.toLowerCase()}`}
        onClick={() => onSort(nextSort(sortKey, sort))}
        className={cn(
          "group/sort relative inline-flex items-center gap-1 rounded uppercase tracking-wider hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          align === "right" && "flex-row-reverse",
          active && "text-slate-900",
        )}
      >
        {label}
        {active ? (
          <Icon className="h-3.5 w-3.5 shrink-0" />
        ) : (
          // Sin orden activo el ícono aparece al pasar el mouse, sin ensanchar la columna.
          <Icon
            aria-hidden
            className={cn(
              "absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-0 transition-opacity group-hover/sort:opacity-50 group-focus-visible/sort:opacity-50",
              align === "right" ? "right-full mr-0.5" : "left-full ml-0.5",
            )}
          />
        )}
      </button>
    </th>
  );
}

function OpportunityTable({
  rows,
  loading,
  onOpen,
  compact = false,
  sort,
  onSort,
}: Props) {
  const cell = "px-2.5 py-3.5 align-top";
  const sortable = compact ? undefined : onSort;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className={tableHead}>
          <tr>
            <SortHeader
              label="Cuenta y oportunidad"
              sortKey="account"
              sort={sort}
              onSort={sortable}
              className="min-w-[200px] pl-5"
            />
            <SortHeader
              label="Situación"
              sortKey="stage"
              sort={sort}
              onSort={sortable}
              className="min-w-[160px]"
            />
            <SortHeader
              label="Valor USD"
              sortKey="usd"
              sort={sort}
              onSort={sortable}
              align="right"
            />
            {!compact && (
              <SortHeader
                label="Ponderado USD"
                sortKey="weighted"
                sort={sort}
                onSort={sortable}
                align="right"
              />
            )}
            <SortHeader
              label={compact ? "Próximo paso" : "Seguimiento"}
              sortKey={compact ? undefined : "closeDate"}
              sort={sort}
              onSort={sortable}
              className={cn("min-w-[160px]", compact && "pr-5")}
            />
            {!compact && (
              <SortHeader
                label="Responsable"
                className={onOpen ? "pr-5 2xl:pr-2.5" : "pr-5"}
              />
            )}
            {!compact && onOpen && (
              <SortHeader
                label="Fuente"
                className="hidden min-w-[170px] 2xl:table-cell 2xl:pr-5"
              />
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: compact ? 4 : 6 }, (_, j) => (
                    <td className="px-5 py-5" key={j}>
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((r) => (
                <tr
                  className={cn(
                    "group transition-colors hover:bg-slate-50/80",
                    onOpen && "cursor-pointer",
                  )}
                  key={r.id ?? r.importKey}
                  onClick={onOpen ? () => onOpen(r) : undefined}
                >
                  <td className={cn(cell, "pl-5")}>
                    {onOpen ? (
                      <button
                        onClick={(e) => {
                          stop(e);
                          onOpen(r);
                        }}
                        className="block max-w-[340px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="block font-semibold leading-5 text-slate-900 group-hover:text-primary">
                          {r.account}
                        </span>
                        <span className="mt-0.5 block leading-5 text-muted-foreground">
                          {r.project || "Alcance por definir"}
                        </span>
                      </button>
                    ) : (
                      <div className="max-w-[340px]">
                        <span className="block font-semibold leading-5 text-slate-900">
                          {r.account}
                        </span>
                        <span className="mt-0.5 block leading-5 text-muted-foreground">
                          {r.project || "Alcance por definir"}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className={cell}>
                    <StageBadge stage={r.stage} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.status} · {r.scope}
                    </p>
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
                      <Amount
                        value={
                          r.weighted !== undefined
                            ? r.weighted
                            : metrics([r]).weighted
                        }
                        className="font-medium"
                      />
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {(() => {
                          // Vista compartida: ya viene la efectiva y su origen.
                          const p =
                            r.probabilityBasis !== undefined
                              ? {
                                  value: r.probability,
                                  basis: r.probabilityBasis,
                                }
                              : effectiveProbability(r);
                          const text = isPending(p.value)
                            ? "Sin probabilidad"
                            : `Probabilidad ${pct(p.value)}${p.basis === "model" ? " · modelo" : ""}`;
                          return onOpen ? (
                            <button
                              type="button"
                              title="Ajustar la probabilidad"
                              onClick={(e) => {
                                stop(e);
                                onOpen(r, "Probabilidad");
                              }}
                              className="underline decoration-dotted underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              {text}
                            </button>
                          ) : (
                            text
                          );
                        })()}
                      </p>
                    </td>
                  )}
                  <td className={cn(cell, "max-w-[240px]", compact && "pr-5")}>
                    <FollowUp r={r} compact={compact} />
                    <AlertsBadge r={r} onOpen={onOpen} />
                  </td>
                  {!compact && (
                    <td
                      className={cn(cell, onOpen ? "pr-5 2xl:pr-2.5" : "pr-5")}
                    >
                      <span className="inline-flex items-center gap-2 whitespace-nowrap leading-5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
                          {initials(r.owner)}
                        </span>
                        {r.owner || (
                          <span className={pendingText}>Sin responsable</span>
                        )}
                      </span>
                    </td>
                  )}
                  {!compact && onOpen && (
                    <td
                      className={cn(
                        cell,
                        "hidden max-w-[220px] 2xl:table-cell 2xl:pr-5",
                      )}
                    >
                      {r.sources?.[0] ? (
                        <>
                          <a
                            onClick={stop}
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
                        <span className={cn("leading-5", pendingText)}>
                          Pendiente
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

/** En pantallas chicas cada oportunidad es una tarjeta en vez de una fila con scroll horizontal. */
function OpportunityCards({ rows, loading, onOpen, compact = false }: Props) {
  if (loading)
    return (
      <div className="divide-y divide-slate-100">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 px-4 py-4">
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => (
        <li key={r.id ?? r.importKey}>
          <div
            {...(onOpen
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick: () => onOpen(r),
                  onKeyDown: (e: ReactKeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(r);
                    }
                  },
                }
              : {})}
            className={cn(
              "flex w-full items-start gap-3 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
              onOpen && "transition-colors hover:bg-slate-50/80",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-5">
                    {r.account}
                  </p>
                  <p className="mt-0.5 line-clamp-2 leading-5 text-muted-foreground">
                    {r.project || "Alcance por definir"}
                  </p>
                </div>
                <span className="shrink-0 text-right font-medium leading-5">
                  <Amount value={r.usd} />
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <StageBadge stage={r.stage} />
                <span className="text-xs text-muted-foreground">
                  {r.status}
                </span>
                <ProbabilityTag r={r} onOpen={onOpen} />
              </div>
              <CardMeta>
                <FollowUp r={r} compact={compact} />
              </CardMeta>
              <AlertsBadge r={r} onOpen={onOpen} />
            </div>
            {onOpen && (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
const CardMeta = ({ children }: { children: ReactNode }) => (
  <div className="mt-2 border-t border-dashed border-slate-100 pt-2">
    {children}
  </div>
);

export function OpportunityList(props: Props) {
  return (
    <>
      <div className="hidden md:block">
        <OpportunityTable {...props} />
      </div>
      <div className="md:hidden">
        <OpportunityCards {...props} />
      </div>
    </>
  );
}
