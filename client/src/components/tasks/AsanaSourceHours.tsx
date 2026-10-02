import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetchJson } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
type Data = { summary: { records: number; minutes: number; unresolved_people: number; unavailable_tasks: number }; entries: { gid: string; task_id: number | null; source_task_gid: string | null; source_task_name: string | null; author_name: string | null; personnel_name: string | null; date: string; minutes: number; description: string | null }[] };
export default function AsanaSourceHours({ projectId, taskId }: { projectId: number; taskId?: number }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState(0), [month, setMonth] = useState("");
  useEffect(() => { setPage(0); }, [projectId, taskId]);
  const { data, isError, isFetching } = useQuery<Data>({
    queryKey: ["asana-source-hours", projectId, taskId, page, month], enabled: open,
    queryFn: () => authFetchJson(`/api/tasks/projects/${projectId}/asana-time?page=${page}${taskId ? `&taskId=${taskId}` : ""}${month ? `&month=${month}` : ""}`),
  });
  return <div className="space-y-2">
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(!open)}>{open ? "Ocultar" : "Ver"} horas originales de Asana</Button>
    {open && <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-2 text-sm">Mes (opcional)<input type="month" className="rounded border px-2 py-1 bg-background" value={month} onChange={event => { setMonth(event.target.value); setPage(0); }} /></label>
      {isError && <p className="text-sm text-destructive">No se pudieron consultar las horas.</p>}
      {isFetching && <p className="text-sm text-muted-foreground">Cargando horas…</p>}
      {data && <>
        <p className="text-sm">{data.summary.records} registros · {(data.summary.minutes / 60).toLocaleString("es-AR", { maximumFractionDigits: 2 })} h</p>
        <p className="text-xs text-muted-foreground">Historial original con fecha y autor{taskId ? ", incluidas las subtareas" : ""}. Sus costos requieren conciliación con el historial financiero existente.</p>
        {data.summary.unresolved_people > 0 && <p className="text-xs text-amber-700">{data.summary.unresolved_people} registros conservan el autor original pendiente de vincular a Personal.</p>}
        {data.summary.unavailable_tasks > 0 && <p className="text-xs text-amber-700">{data.summary.unavailable_tasks} registros corresponden a tareas eliminadas o fuera de este proyecto en Asana.</p>}
        <div className="max-h-80 overflow-auto rounded border"><table className="w-full text-xs"><thead><tr className="border-b text-left"><th className="p-2">Fecha</th><th className="p-2">Persona</th><th className="p-2">Tarea original</th><th className="p-2 text-right">Tiempo</th></tr></thead><tbody>{data.entries.map(entry => <tr key={entry.gid} className="border-b align-top">
          <td className="p-2 whitespace-nowrap">{entry.date.split("-").reverse().join("/")}</td><td className="p-2">{entry.personnel_name || entry.author_name || "Autor no disponible"}{entry.personnel_name && entry.author_name !== entry.personnel_name && <span className="block text-muted-foreground">Asana: {entry.author_name}</span>}</td>
          <td className="p-2 break-words">{entry.source_task_gid ? <a href={`https://app.asana.com/0/0/${entry.source_task_gid}`} target="_blank" rel="noopener noreferrer" className="underline">{entry.source_task_name || "Abrir original"}</a> : "Tarea no disponible"}{entry.description && <span className="block text-muted-foreground">{entry.description}</span>}</td>
          <td className="p-2 whitespace-nowrap text-right">{Math.floor(entry.minutes / 60)}:{String(entry.minutes % 60).padStart(2, "0")}</td>
        </tr>)}</tbody></table></div>
        <div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={!page || isFetching} onClick={() => setPage(page - 1)}>Anterior</Button><span className="text-xs">Página {page + 1}</span><Button type="button" size="sm" variant="outline" disabled={(page + 1) * 25 >= data.summary.records || isFetching} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
      </>}
    </div>}
  </div>;
}
