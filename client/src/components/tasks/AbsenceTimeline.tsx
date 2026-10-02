import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { absenceTimelineRange, absenceTimelineBars } from "@shared/utils/absence-timeline";

type Row = { id: number; personnelId: number; personName: string; startDate: string; endDate: string; status: string; planningStatus?: string };
export function AbsenceTimeline({ rows, year }: { rows: Row[]; year: number }) {
  const [month, setMonth] = useState("all");
  const range = absenceTimelineRange(year, month === "all" ? null : Number(month));
  const activeRows = rows.filter(row => !["cancelled", "rejected"].includes(row.status) && row.startDate <= range.to && row.endDate >= range.from);
  const people = Array.from(new Map(activeRows.map(row => [row.personnelId, row.personName])).entries());
  const labels = month === "all" ? Array.from({ length: 12 }, (_, i) => new Date(year, i, 1).toLocaleDateString("es-AR", { month: "short" })) : Array.from({ length: range.days }, (_, i) => String(i + 1));
  return <Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <CardTitle className="text-sm">Planificación de ausencias · {year}</CardTitle>
    <Select value={month} onValueChange={setMonth}><SelectTrigger className="w-44" aria-label="Mes del Gantt"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todo el año</SelectItem>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i} value={String(i + 1)}>{new Date(year, i, 1).toLocaleDateString("es-AR", { month: "long" })}</SelectItem>)}</SelectContent></Select>
  </CardHeader><CardContent className="space-y-3">
    <p className="text-xs text-muted-foreground">Verde: aprobada · Ámbar: pendiente · Línea discontinua: tentativa. Las barras representan días exactos y las superposiciones se muestran en filas separadas.</p>
    <div className="overflow-x-auto"><div className="min-w-[820px]">
      <div className="grid grid-cols-[180px_1fr] text-[10px] text-muted-foreground"><span>Persona</span><div className="grid" style={{ gridTemplateColumns: month === "all" ? Array.from({ length: 12 }, (_, i) => `${absenceTimelineRange(year, i + 1).days}fr`).join(" ") : `repeat(${labels.length}, minmax(0, 1fr))` }}>{labels.map((label, i) => <span key={i} className="text-center">{label}</span>)}</div></div>
      {people.map(([id, name]) => {
        const bars = absenceTimelineBars(activeRows.filter(row => row.personnelId === id), range);
        return <div key={id} className="grid grid-cols-[180px_1fr] items-center border-t py-2 text-xs"><span className="truncate pr-2">{name}</span><div className="relative bg-muted/30" style={{ height: `${Math.max(1, ...bars.map(bar => bar.lane + 1)) * 28}px` }}>
          {bars.map(bar => <div key={bar.row.id} title={`${name}: ${bar.row.startDate} → ${bar.row.endDate} · ${bar.row.status === "approved" ? "Aprobada" : "Pendiente"} · ${bar.row.planningStatus === "confirmed" ? "Confirmada" : "Tentativa"}`}
            aria-label={`${name}: ${bar.row.startDate} a ${bar.row.endDate}`}
            className={`absolute h-5 rounded border-2 ${bar.row.planningStatus === "confirmed" ? "border-solid" : "border-dashed"} ${bar.row.status === "approved" ? "border-emerald-700 bg-emerald-300" : "border-amber-700 bg-amber-200"}`}
            style={{ left: `${bar.left}%`, width: `${bar.width}%`, minWidth: "3px", top: `${bar.lane * 28 + 4}px` }} />)}
        </div></div>;
      })}
      {!people.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay ausencias activas en este período.</p>}
    </div></div>
  </CardContent></Card>;
}
