import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Eye,
  Loader2,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PublicPipeline } from "@shared/pipeline-share";
import { cn } from "@/lib/utils";
import {
  Amount,
  BigValue,
  StageBadge,
  cardBase,
  civilDate,
  dateTime,
  isPending,
  money,
  pct,
  pendingText,
  stageColors,
  tableHead,
} from "@/components/pipeline/ui";

/** El token viaja en el fragmento (#t=…): no se envía al servidor con la URL ni en el Referer. */
const readToken = () =>
  new URLSearchParams(window.location.hash.replace(/^#/, "")).get("t") ?? "";

function Kpi({
  title,
  icon: Icon,
  value,
  unit,
  footer,
}: {
  title: string;
  icon: LucideIcon;
  value: React.ReactNode;
  unit?: string;
  footer: string;
}) {
  return (
    <div className={cn(cardBase, "flex min-h-[132px] flex-col p-5")}>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-muted-foreground">
          {title}
        </p>
        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      <div className="mt-2">
        <BigValue value={value} unit={unit} />
      </div>
      <p className="mt-auto pt-4 text-sm text-muted-foreground">{footer}</p>
    </div>
  );
}

function Message({
  title,
  description,
  loading = false,
}: {
  title: string;
  description: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6">
      <div className={cn(cardBase, "max-w-md p-8 text-center")}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
        </div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function PublicPipelinePage() {
  const [token] = useState(readToken);
  useEffect(() => {
    // Vista privada aunque se comparta: que no la indexen ni filtren el enlace.
    const tags = [
      ["robots", "noindex, nofollow"],
      ["referrer", "no-referrer"],
    ].map(([name, content]) => {
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
      return meta;
    });
    const previous = document.title;
    document.title = "Pipeline comercial · Mind";
    return () => {
      tags.forEach((t) => t.remove());
      document.title = previous;
    };
  }, []);
  const { data, isLoading, error } = useQuery<PublicPipeline>({
    queryKey: ["/api/public/pipeline", token],
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch("/api/public/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "omit",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.message ?? "No pudimos abrir el pipeline.");
      return body;
    },
  });

  if (!token)
    return (
      <Message
        title="Enlace incompleto"
        description="Abrí el enlace completo que te compartieron. Si el problema sigue, pedí uno nuevo."
      />
    );
  if (isLoading)
    return (
      <Message
        loading
        title="Abriendo el pipeline…"
        description="Preparando la cartera comercial actualizada."
      />
    );
  if (error || !data)
    return (
      <Message
        title="No pudimos abrir el pipeline"
        description={
          (error as Error)?.message ??
          "El enlace no existe, venció o fue revocado."
        }
      />
    );

  const { summary, rows } = data;
  return (
    <div className="min-h-[100dvh] bg-slate-50/70">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white"
            >
              M
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                Pipeline comercial
              </h1>
              <p className="text-sm text-muted-foreground">
                Actualizado {dateTime(data.generatedAt)}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            <Eye className="h-3.5 w-3.5" />
            Solo lectura
            {data.expiresAt && ` · vence ${civilDate(data.expiresAt)}`}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            title="Pipeline Value"
            icon={TrendingUp}
            value={isPending(summary.gross) ? null : money(summary.gross)}
            unit="USD"
            footer={`Con valor respaldado: ${summary.valueCoverage}/${summary.open}`}
          />
          <Kpi
            title="Weighted Pipeline Value"
            icon={Target}
            value={isPending(summary.weighted) ? null : money(summary.weighted)}
            unit="USD"
            footer={`Con probabilidad respaldada: ${summary.weightedCoverage}/${summary.open}`}
          />
          <Kpi
            title="Oportunidades abiertas"
            icon={Users}
            value={summary.open}
            footer="Alcances vigentes en el pipeline"
          />
          <Kpi
            title="Warner en el pipeline"
            icon={Building2}
            value={`${summary.warner.open} de ${summary.open}`}
            footer={`Participación en valor: ${isPending(summary.warner.valuePct) ? "pendiente" : pct(summary.warner.valuePct)}`}
          />
        </div>

        <section className={cn(cardBase, "overflow-hidden")}>
          <div className="border-b border-border/60 px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight">
              Pipeline por etapa
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cartera abierta e importes USD respaldados.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={tableHead}>
                <tr>
                  <th className="px-5 py-3 font-medium">Etapa</th>
                  <th className="px-4 py-3 text-right font-medium">Abiertas</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">
                    Bruto USD
                  </th>
                  <th className="whitespace-nowrap px-5 py-3 text-right font-medium">
                    Ponderado USD
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.stages.map((s) => (
                  <tr key={s.stage}>
                    <td className="px-5 py-3.5 align-top">
                      <span className="inline-flex items-center gap-2 font-medium leading-5">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            stageColors[s.stage],
                          )}
                        />
                        {s.stage}
                      </span>
                      <div className="ml-4 mt-2 h-1 max-w-[180px] overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn("h-full", stageColors[s.stage])}
                          style={{
                            width: `${summary.open ? (s.open / summary.open) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right align-top font-medium leading-5 tabular-nums">
                      {s.open}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right align-top leading-5">
                      <Amount value={s.gross} className="font-medium" />
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {s.valueCoverage}/{s.open} con valor
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right align-top leading-5">
                      <Amount value={s.weighted} className="font-medium" />
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {s.weightedCoverage}/{s.open} respaldadas
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50/60">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Total abierto</th>
                  <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                    {summary.open}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Amount value={summary.gross} className="font-semibold" />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Amount
                      value={summary.weighted}
                      className="font-semibold"
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className={cn(cardBase, "overflow-hidden")}>
          <div className="border-b border-border/60 px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight">
              Oportunidades abiertas
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ordenadas por etapa e importe.
            </p>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No hay oportunidades abiertas en este momento.
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className={tableHead}>
                    <tr>
                      <th className="whitespace-nowrap px-5 py-3 font-medium">
                        Cuenta y oportunidad
                      </th>
                      <th className="px-2.5 py-3 font-medium">Situación</th>
                      <th className="whitespace-nowrap px-2.5 py-3 text-right font-medium">
                        Valor USD
                      </th>
                      <th className="whitespace-nowrap px-2.5 py-3 text-right font-medium">
                        Ponderado USD
                      </th>
                      <th className="whitespace-nowrap px-2.5 py-3 font-medium">
                        Próximo paso
                      </th>
                      <th className="px-2.5 py-3 pr-5 font-medium">
                        Responsable
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-5 py-3.5 align-top">
                          <span className="block font-semibold leading-5">
                            {r.account}
                          </span>
                          <span className="mt-0.5 block leading-5 text-muted-foreground">
                            {r.project || "Alcance por definir"}
                          </span>
                        </td>
                        <td className="px-2.5 py-3.5 align-top">
                          <StageBadge stage={r.stage} />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.status}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-3.5 text-right align-top font-medium leading-5">
                          <Amount value={r.usd} />
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-3.5 text-right align-top leading-5">
                          <Amount value={r.weighted} className="font-medium" />
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {isPending(r.probability)
                              ? "Sin probabilidad"
                              : `Probabilidad ${pct(r.probability)}`}
                          </p>
                        </td>
                        <td className="max-w-[280px] px-2.5 py-3.5 align-top">
                          <p className="line-clamp-2 leading-5 text-slate-700">
                            {r.next || (
                              <span className={pendingText}>
                                Sin próximo paso
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.nextDate
                              ? civilDate(r.nextDate)
                              : r.closeDate
                                ? `Cierre ${civilDate(r.closeDate)}`
                                : "Sin fecha"}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-3.5 pr-5 align-top leading-5">
                          {r.owner || (
                            <span className={pendingText}>Sin responsable</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-slate-100 md:hidden">
                {rows.map((r, i) => (
                  <li key={i} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-5">
                          {r.account}
                        </p>
                        <p className="mt-0.5 line-clamp-2 leading-5 text-muted-foreground">
                          {r.project || "Alcance por definir"}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium leading-5">
                        <Amount value={r.usd} />
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StageBadge stage={r.stage} />
                      <span className="text-xs text-muted-foreground">
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-2 border-t border-dashed border-slate-100 pt-2 text-sm leading-5 text-slate-700">
                      {r.next || (
                        <span className={pendingText}>Sin próximo paso</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[r.nextDate && civilDate(r.nextDate), r.owner]
                        .filter(Boolean)
                        .join(" · ") || "Sin fecha"}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <p className="pb-4 text-center text-xs text-muted-foreground">
          Vista de solo lectura compartida desde Mind · Epical. Los importes
          figuran solo cuando están respaldados por evidencia.
        </p>
      </main>
    </div>
  );
}
