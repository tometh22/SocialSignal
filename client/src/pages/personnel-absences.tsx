import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest } from "@/lib/queryClient";
import { CalendarDays, Check, Loader2, ShieldAlert, UserX, X } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  vacation: "Vacaciones", sick: "Enfermedad", other: "Otro", epical_day: "Día Epical",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada",
  cancellation_requested: "Cancelación pendiente", cancelled: "Cancelada",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary", approved: "default", rejected: "destructive",
  cancellation_requested: "outline", cancelled: "outline",
};

type Person = { id: number; name: string; email?: string | null };
type Absence = {
  id: number; personnelId: number; personName: string; startDate: string; endDate: string;
  type: string; status: string; businessDays: number; notes?: string | null; reviewReason?: string | null;
};
type Balance = {
  configured: boolean; vacationDays: number | null; epicalDays: number | null;
  used: { vacation: number; epical: number };
};

export default function PersonnelAbsencesPage() {
  const { user } = useAuth();
  const { isOperations } = usePermissions();
  const isAdmin = Boolean((user as any)?.isAdmin);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [teamPersonId, setTeamPersonId] = useState<string>("");
  const [form, setForm] = useState({ startDate: "", endDate: "", type: "vacation", notes: "" });
  const [allowanceDraft, setAllowanceDraft] = useState({ vacationDays: "", epicalDays: "" });

  const { data: personnel = [] } = useQuery<Person[]>({ queryKey: ["/api/personnel"] });
  const myPerson = personnel.find((person) => person.id === (user as any)?.personnelId)
    ?? personnel.find((person) => person.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase());
  const balancePersonId = isOperations && teamPersonId ? Number(teamPersonId) : myPerson?.id;

  const { data: mine = [], isLoading: mineLoading } = useQuery<Absence[]>({
    queryKey: ["/api/absence-requests", "mine", year],
    queryFn: () => apiRequest(`/api/absence-requests?scope=mine&year=${year}`, "GET"),
    enabled: Boolean(myPerson),
  });
  const { data: team = [], isLoading: teamLoading } = useQuery<Absence[]>({
    queryKey: ["/api/absence-requests", "team", year],
    queryFn: () => apiRequest(`/api/absence-requests?scope=team&year=${year}`, "GET"),
    enabled: isOperations,
  });
  const { data: balance } = useQuery<Balance>({
    queryKey: ["/api/absence-allowances", balancePersonId, year],
    queryFn: () => apiRequest(`/api/absence-allowances/${balancePersonId}/${year}`, "GET"),
    enabled: Boolean(balancePersonId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/absence-requests"] });
    queryClient.invalidateQueries({ queryKey: ["/api/absence-allowances"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/capacity/weekly"] });
  };
  const createMutation = useMutation({
    mutationFn: () => apiRequest("/api/absence-requests", "POST", { ...form, notes: form.notes.trim() || null }),
    onSuccess: () => { refresh(); setForm({ startDate: "", endDate: "", type: "vacation", notes: "" }); toast({ title: "Solicitud enviada" }); },
    onError: (error: Error) => toast({ title: "No se pudo enviar", description: error.message, variant: "destructive" }),
  });
  const actionMutation = useMutation({
    mutationFn: ({ id, action, reason, allowNegativeBalance = false }: { id: number; action: string; reason?: string; allowNegativeBalance?: boolean }) =>
      apiRequest(`/api/absence-requests/${id}/actions`, "POST", { action, reason, allowNegativeBalance }),
    onSuccess: () => { refresh(); toast({ title: "Solicitud actualizada" }); },
    onError: (error: Error) => toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }),
  });
  const allowanceMutation = useMutation({
    mutationFn: () => apiRequest(`/api/absence-allowances/${balancePersonId}/${year}`, "PUT", {
      vacationDays: Number(allowanceDraft.vacationDays), epicalDays: Number(allowanceDraft.epicalDays),
    }),
    onSuccess: () => { refresh(); toast({ title: "Cupo anual guardado" }); },
    onError: (error: Error) => toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" }),
  });

  const pendingTeam = useMemo(() => team.filter((absence) => ["pending", "cancellation_requested"].includes(absence.status)), [team]);
  const requestAction = (absence: Absence, action: string) => {
    const needsReason = ["reject", "request_cancellation", "approve_cancellation", "reject_cancellation"].includes(action);
    const reason = needsReason ? window.prompt("Motivo o comentario:") ?? undefined : undefined;
    if (needsReason && reason === undefined) return;
    actionMutation.mutate({ id: absence.id, action, reason });
  };

  const AbsenceList = ({ rows, loading, teamMode = false }: { rows: Absence[]; loading: boolean; teamMode?: boolean }) => (
    <Card>
      <CardContent className="p-0">
        {loading ? <div className="grid min-h-36 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : rows.length === 0 ? <div className="grid min-h-36 place-items-center text-sm text-muted-foreground">No hay solicitudes para {year}.</div>
          : <div className="divide-y">
            {rows.map((absence) => (
              <div key={absence.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {teamMode && <span className="font-medium">{absence.personName}</span>}
                    <span className="text-sm">{TYPE_LABELS[absence.type] || absence.type}</span>
                    <Badge variant={STATUS_VARIANTS[absence.status] || "outline"}>{STATUS_LABELS[absence.status] || absence.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{absence.startDate} → {absence.endDate} · {absence.businessDays} día(s) hábil(es)</p>
                  {absence.notes && <p className="mt-1 text-xs text-slate-600">{absence.notes}</p>}
                  {absence.reviewReason && <p className="mt-1 text-xs text-muted-foreground">Respuesta: {absence.reviewReason}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!teamMode && absence.status === "pending" && <Button size="sm" variant="outline" onClick={() => requestAction(absence, "cancel_pending")}>Cancelar</Button>}
                  {!teamMode && absence.status === "approved" && <Button size="sm" variant="outline" onClick={() => requestAction(absence, "request_cancellation")}>Pedir cancelación</Button>}
                  {teamMode && absence.status === "pending" && <>
                    <Button size="sm" onClick={() => requestAction(absence, "approve")}><Check className="mr-1 h-3.5 w-3.5" />Aprobar</Button>
                    <Button size="sm" variant="destructive" onClick={() => requestAction(absence, "reject")}><X className="mr-1 h-3.5 w-3.5" />Rechazar</Button>
                    {isAdmin && <Button size="sm" variant="outline" onClick={() => {
                      const reason = window.prompt("Motivo obligatorio del override:");
                      if (reason?.trim()) actionMutation.mutate({ id: absence.id, action: "approve", reason, allowNegativeBalance: true });
                    }}><ShieldAlert className="mr-1 h-3.5 w-3.5" />Override</Button>}
                  </>}
                  {teamMode && absence.status === "cancellation_requested" && <>
                    <Button size="sm" onClick={() => requestAction(absence, "approve_cancellation")}>Confirmar cancelación</Button>
                    <Button size="sm" variant="outline" onClick={() => requestAction(absence, "reject_cancellation")}>Mantener aprobada</Button>
                  </>}
                </div>
              </div>
            ))}
          </div>}
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><UserX className="h-5 w-5" />Ausencias</h1><p className="text-sm text-muted-foreground">Solicitudes, saldos y disponibilidad del equipo.</p></div>
        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{[year - 1, year, year + 1].map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent></Select>
      </div>

      <Tabs defaultValue="mine">
        <TabsList><TabsTrigger value="mine">Mis solicitudes</TabsTrigger>{isOperations && <TabsTrigger value="team">Equipo {pendingTeam.length > 0 && `(${pendingTeam.length})`}</TabsTrigger>}{isOperations && <TabsTrigger value="allowances">Cupos</TabsTrigger>}</TabsList>
        <TabsContent value="mine" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vacaciones</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{balance?.configured ? `${Math.max(0, (balance.vacationDays || 0) - balance.used.vacation)} días` : "Sin cupo configurado"}</p><p className="text-xs text-muted-foreground">Usados: {balance?.used.vacation ?? 0}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Días Epical</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{balance?.configured ? `${Math.max(0, (balance.epicalDays || 0) - balance.used.epical)} días` : "Sin cupo configurado"}</p><p className="text-xs text-muted-foreground">Usados: {balance?.used.epical ?? 0}</p></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle className="text-sm">Nueva solicitud</CardTitle></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
            <div><Label>Desde</Label><Input type="date" required value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></div>
            <div><Label>Hasta</Label><Input type="date" required value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></div>
            <div><Label>Tipo</Label><Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Notas privadas</Label><Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Opcional" /></div>
            <div className="sm:col-span-2"><Button disabled={createMutation.isPending || !myPerson}><CalendarDays className="mr-2 h-4 w-4" />Enviar solicitud</Button>{!myPerson && <p className="mt-2 text-xs text-destructive">Tu email no está vinculado con Personal.</p>}</div>
          </form></CardContent></Card>
          <AbsenceList rows={mine} loading={mineLoading} />
        </TabsContent>
        {isOperations && <TabsContent value="team" className="space-y-4"><AbsenceList rows={team} loading={teamLoading} teamMode /></TabsContent>}
        {isOperations && <TabsContent value="allowances"><Card><CardHeader><CardTitle className="text-sm">Cupo anual por persona</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2"><Label>Persona</Label><Select value={teamPersonId} onValueChange={(value) => { setTeamPersonId(value); setAllowanceDraft({ vacationDays: "", epicalDays: "" }); }}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{personnel.map((person) => <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Vacaciones</Label><Input type="number" min={0} value={allowanceDraft.vacationDays} placeholder={balance?.vacationDays == null ? "Sin configurar" : String(balance.vacationDays)} onChange={(event) => setAllowanceDraft({ ...allowanceDraft, vacationDays: event.target.value })} /></div>
          <div><Label>Días Epical</Label><Input type="number" min={0} value={allowanceDraft.epicalDays} placeholder={balance?.epicalDays == null ? "Sin configurar" : String(balance.epicalDays)} onChange={(event) => setAllowanceDraft({ ...allowanceDraft, epicalDays: event.target.value })} /></div>
          <div className="sm:col-span-4"><Button disabled={!teamPersonId || allowanceDraft.vacationDays === "" || allowanceDraft.epicalDays === "" || allowanceMutation.isPending} onClick={() => allowanceMutation.mutate()}>Guardar cupo {year}</Button></div>
        </CardContent></Card></TabsContent>}
      </Tabs>
    </div>
  );
}
