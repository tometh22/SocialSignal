import AsanaSourceHours from "./AsanaSourceHours";
import { useQuery } from "@tanstack/react-query";
import { authFetchJson } from "@/lib/queryClient";

type Migration = {
  recoverySourceProjectId: number | null;
  time: { records: number; minutes: number; unresolved_people: number; unavailable_tasks: number };
  priorNativeTasks: number;
  retiredTasks: number;
  retiredTaskArchiveProjectId: number | null;
  gid: string;
  tasksAvailable: boolean;
  detailedHoursAvailable: boolean;
  clientConfirmed: boolean;
  counts: { imported_tasks: number; assigned_tasks: number; unresolved_parents: number };
  quotations: Array<{ id: number; name: string; relation: string }>;
  history: Array<{ legacy_project_id: number; relation: string; records: number; hours: number; first_period: string; last_period: string }>;
  reportedConsumedCost: { amount: number; currency?: string } | null;
};

export default function AsanaMigrationSummary({ projectId }: { projectId: number }) {
  const { data, isError } = useQuery<Migration | null>({
    queryKey: ["/api/tasks/projects", projectId, "migration"],
    queryFn: () => authFetchJson(`/api/tasks/projects/${projectId}/migration`),
    enabled: Boolean(projectId),
  });
  if (isError) return <p className="text-sm text-destructive">No se pudo consultar el estado de la migración desde Asana.</p>;
  if (!data) return null;
  return <section className="rounded-xl border p-4 space-y-2 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">{data.recoverySourceProjectId ? "Historial recuperable de Asana" : "Migración desde Asana"}</h3>
      <a className="text-primary underline" href={`https://app.asana.com/0/${data.gid}/list`} target="_blank" rel="noopener noreferrer">Abrir original</a>
    </div>
    {data.recoverySourceProjectId && <p>Se conserva la instantánea retirada de la vista activa, incluidas sus horas originales. <a className="underline text-primary" href={`/tasks/projects/${data.recoverySourceProjectId}`}>Abrir proyecto de origen</a>.</p>}
    <p>{data.tasksAvailable ? `${data.counts.imported_tasks} tareas importadas · ${data.counts.assigned_tasks} con responsable` : "Exportación de tareas pendiente. Se conserva la estructura cargada desde el Excel."}</p>
    {data.retiredTasks > 0 && <p className="text-amber-700">{data.retiredTasks} tareas ya retiradas de Mind se conservan en <a className="underline" href={`/tasks/projects/${data.retiredTaskArchiveProjectId}`}>historial recuperable</a>.</p>}
    {data.priorNativeTasks > 0 && <p className="text-muted-foreground">Se conservan {data.priorNativeTasks} tareas anteriores de Excel/Mind.</p>}
    {data.detailedHoursAvailable && <p>{data.time.records} entradas de tiempo originales · {(data.time.minutes / 60).toLocaleString("es-AR", { maximumFractionDigits: 2 })} h. Conciliación financiera pendiente.</p>}
    {data.detailedHoursAvailable && <AsanaSourceHours projectId={projectId} />}
    {!data.clientConfirmed && <p className="text-amber-700">Cliente y cotización pendientes de confirmar. La importación conserva el nombre de Asana.</p>}
    {data.counts.unresolved_parents > 0 && <p className="text-amber-700">{data.counts.unresolved_parents} relaciones de subtareas necesitan cotejo con el original.</p>}
    {!data.detailedHoursAvailable && <p className="text-amber-700">Pendiente: importar las entradas de tiempo con su fecha y autor. Los totales del CSV se muestran en cada tarea por separado.</p>}
    {data.quotations.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-1">
      {data.quotations.map(quote => <a className="text-primary underline" key={quote.id} href={`/quotations/${quote.id}`}>{quote.name}{quote.relation === "prior_credit" ? " (créditos anteriores)" : ""}</a>)}
    </div>}
    {data.history.map(item => <p key={item.legacy_project_id}>
      Historial {item.relation === "shared_contract" ? "del contrato compartido" : "del contrato"}: {Number(item.hours).toLocaleString("es-AR", { maximumFractionDigits: 2 })} h en {item.records} registros mensuales ({item.first_period}–{item.last_period}). Se conserva vinculado al registro original.
    </p>)}
    {data.reportedConsumedCost && <p>Saldo de costo informado en el Excel: {data.reportedConsumedCost.amount.toLocaleString("es-AR", { maximumFractionDigits: 2 })} {data.reportedConsumedCost.currency || "(moneda sin especificar)"}. Pendiente de conciliación con el detalle.</p>}
  </section>;
}
