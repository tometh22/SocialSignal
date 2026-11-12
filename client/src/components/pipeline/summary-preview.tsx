import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { pendingText } from "./ui";

type Block =
  | { kind: "title"; text: string }
  | { kind: "pair"; label: string; value: string }
  | { kind: "list"; heading: string; items: string[] }
  | { kind: "text"; text: string };

const pairPattern = /^([^:]{1,40}):\s+(.+)$/;

/**
 * Interpreta el texto plano del resumen ejecutivo: primera línea como título,
 * "Etiqueta: valor" como fila y "Encabezado:" seguido de líneas como lista.
 * El texto que se copia o descarga no cambia.
 */
export function parseSummary(text: string): Block[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const blocks: Block[] = [];
  let list: Extract<Block, { kind: "list" }> | null = null;
  lines.forEach((line, i) => {
    if (i === 0) return blocks.push({ kind: "title", text: line });
    if (line.endsWith(":")) {
      list = { kind: "list", heading: line.slice(0, -1), items: [] };
      return blocks.push(list);
    }
    if (list) return list.items.push(line.replace(/^[-•]\s*/, ""));
    const pair = line.match(pairPattern);
    blocks.push(
      pair
        ? { kind: "pair", label: pair[1], value: pair[2] }
        : { kind: "text", text: line },
    );
  });
  return blocks;
}
/** Atenúa "Pendiente" dentro de una frase para que los datos reales resalten. */
function soften(text: string): ReactNode {
  return text.split(/(Pendiente)/g).map((part, i) =>
    part === "Pendiente" ? (
      <span key={i} className={pendingText}>
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function SummaryPreview({
  text,
  loading,
}: {
  text?: string | null;
  loading?: boolean;
}) {
  if (loading)
    return (
      <div
        className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-5"
        role="status"
        aria-label="Preparando resumen"
      >
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200/80" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-slate-200/60"
            style={{ width: `${90 - i * 8}%` }}
          />
        ))}
      </div>
    );
  if (!text)
    return (
      <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-muted-foreground">
        El resumen todavía no está disponible para este período.
      </p>
    );
  const blocks = parseSummary(text);
  return (
    <article
      aria-label="Vista previa del resumen"
      className="max-h-[520px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-5 text-sm"
    >
      {blocks.map((b, i) =>
        b.kind === "title" ? (
          <h3 key={i} className="text-base font-semibold tracking-tight">
            {b.text}
          </h3>
        ) : b.kind === "pair" ? (
          <div
            key={i}
            className={cn(
              "grid gap-x-4 gap-y-0.5 border-t border-slate-200/70 py-2 sm:grid-cols-[150px_minmax(0,1fr)]",
              blocks[i - 1]?.kind === "title" && "mt-3",
            )}
          >
            <span className="font-medium text-slate-600">{b.label}</span>
            <span className="leading-relaxed text-slate-900">
              {soften(b.value)}
            </span>
          </div>
        ) : b.kind === "list" ? (
          <div key={i} className="border-t border-slate-200/70 pt-3">
            <p className="font-medium text-slate-600">{b.heading}</p>
            {b.items.length ? (
              <ul className="mt-2 space-y-1.5">
                {b.items.map((item, j) => {
                  const pair = item.match(pairPattern);
                  return (
                    <li key={j} className="flex gap-2 leading-relaxed">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                      <span>
                        {pair ? (
                          <>
                            <span className="font-medium">{pair[1]}:</span>{" "}
                            {soften(pair[2])}
                          </>
                        ) : (
                          soften(item)
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={cn("mt-1", pendingText)}>Sin elementos.</p>
            )}
          </div>
        ) : (
          <p key={i} className="py-2 leading-relaxed">
            {soften(b.text)}
          </p>
        ),
      )}
    </article>
  );
}
