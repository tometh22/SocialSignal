import { useEffect, useMemo, useState } from "react";
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

import { AbsenceTimeline } from "@/components/tasks/AbsenceTimeline";

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
  allowanceExempt?: boolean; id: number; personnelId: number; personName: string; startDate: string; endDate: string;
  type: string; status: string; planningStatus?: "tentative" | "confirmed"; businessDays: number; notes?: string | null; reviewReason?: string | null;
};
type Balance = {
  allowanceExempt?: boolean;
  configured: boolean; vacationDays: number | null; vacationCarryoverDays?: number; vacationAdvanceDebtDays?: number;
  vacationAvailableDays?: number; vacationBalanceDays?: number; epicalDays: number | null;
  used: { vacation: number; epical: number };
};

type TeamBalance = {
  allowanceExempt?: boolean;
  personnelId: number; name: string; configured: boolean; dataError?: boolean;
  vacation: { quota: number | null; carryover: number; advanceDebt: number; available: number; used: number; balance: number; pending: number };
  epical: { quota: number | null; used: number; balance: number | null; pending: number };
  notCounted: { sick: number; other: number };
};

/** Saldo de la persona al decidir: qué consume la solicitud y cuánto queda si se aprueba. */
function BalanceStrip({ person, absence }: { person?: TeamBalance; absence: Absence }) {
  if (!person) return null;
  if (person.allowanceExempt) return <p className="mt-2 text-xs text-muted-foreground">Sin cupo — freelance</p>;
  if (person.dataError) return <p className="mt-2 text-xs text-destructive">Hay una ausencia de esta persona con fechas inválidas: no se pudo calcular el saldo.</p>;
  // Enfermedad y Otros no descuentan cupo: el aviso de cupo sólo aplica a vacaciones y días Epical.
  if (!["vacation", "epical_day"].includes(absence.type)) return null;
  if (!person.configured) return <p className="mt-2 text-xs text-amber-700">Sin cupo configurado para este año.</p>;
  const sameYear = absence.startDate.slice(0, 4) === absence.endDate.slice(0, 4);
  const deciding = ["pending"].includes(absence.status) && sameYear;
  const after = (balance: number) => balance - absence.businessDays;
  const vacationLeft = absence.type === "vacation" && deciding ? after(person.vacation.balance) : null;
  // Sin clamp: si ya se pasó del cupo (override previo), el saldo restante tiene que verse negativo.
  const epicalLeft = absence.type === "epical_day" && deciding && person.epical.quota != null ? after(person.epical.quota - person.epical.used) : null;
  const tone = (left: number | null) => (left != null && left < 0 ? "font-semibold text-destructive" : "font-medium");
  return (
    <div className="mt-2 grid gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:grid-cols-3" data-testid="absence-balance-strip">
      <div>
        <span className="font-medium text-foreground">Vacaciones:</span> {person.vacation.balance} disp.
        <span className="block">Cupo {person.vacation.quota ?? 0} + traslado {person.vacation.carryover}{person.vacation.advanceDebt ? ` − adelanto ${person.vacation.advanceDebt}` : ""} − usados {person.vacation.used}{person.vacation.pending ? ` · pendientes ${person.vacation.pending}` : ""}</span>
        {vacationLeft != null && <span className={`block ${tone(vacationLeft)}`}>Si aprobás: quedan {vacationLeft}{vacationLeft < 0 ? " (excede el cupo)" : ""}</span>}
      </div>
      <div>
        <span className="font-medium text-foreground">Días Epical:</span> {person.epical.balance ?? "sin cupo"} disp.
        <span className="block">Cupo {person.epical.quota ?? 0} − usados {person.epical.used}{person.epical.pending ? ` · pendientes ${person.epical.pending}` : ""}</span>
        {epicalLeft != null && <span className={`block ${tone(epicalLeft)}`}>Si aprobás: quedan {epicalLeft}{epicalLeft < 0 ? " (excede el cupo)" : ""}</span>}
      </div>
      <div>
        <span className="font-medium text-foreground">No descuentan cupo:</span>
        <span className="block">Enfermedad {person.notCounted.sick} · Otros {person.notCounted.other}</span>
      </div>
    </div>
  );
}

export default function PersonnelAbsencesPage({ defaultTab = "mine" }: { defaultTab?: "mine" | "team" }) {
  const { user } = useAuth();
  const { isOperations } = usePermissions();
  const isManagement = defaultTab === "team" && isOperations;
  const isAdmin = Boolean((user as any)?.isAdmin);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [teamPersonId, setTeamPersonId] = useState<string>("");
  const [teamFilterId, setTeamFilterId] = useState<string>("all");
  const [form, setForm] = useState({ startDate: "", endDate: "", type: "vacation", notes: "", planningStatus: "tentative", personnelId: "" });
  const [allowanceDraft, setAllowanceDraft] = useState({ vacationDays: "", vacationCarryoverDays: "", epicalDays: "" });
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [editDraft, setEditDraft] = useState({ startDate: "", endDate: "", type: "vacation", notes: "", planningStatus: "tentative" });

  const { data: personnel = [] } = useQuery<Person[]>({ queryKey: ["/api/personnel"] });
  const myPerson = personnel.find((person) => person.id === (user as any)?.personnelId)
    ?? personnel.find((person) => person.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase());
  const balancePersonId = isManagement ? (teamPersonId ? Number(teamPersonId) : undefined) : myPerson?.id;

  const { data: mine = [], isLoading: mineLoading } = useQuery<Absence[]>({
    queryKey: ["/api/absence-requests", "mine", year],
    queryFn: () => apiRequest(`/api/absence-requests?scope=mine&year=${year}`, "GET"),
    enabled: Boolean(myPerson),
  });
  const { data: team = [], isLoading: teamLoading } = useQuery<Absence[]>({
    queryKey: ["/api/absence-requests", "team", year],
    queryFn: () => apiRequest(`/api/absence-requests?scope=team&year=${year}`, "GET"),
    enabled: isManagement,
  });
  const { data: balance, isFetching: balanceLoading } = useQuery<Balance>({
    queryKey: ["/api/absence-allowances", balancePersonId, year],
    queryFn: () => apiRequest(`/api/absence-allowances/${balancePersonId}/${year}`, "GET"),
    enabled: Boolean(balancePersonId),
  });

  const { data: teamBalances } = useQuery<{ year: number; people: TeamBalance[] }>({
    queryKey: ["/api/absence-allowances", "summary", year],
    queryFn: () => apiRequest(`/api/absence-allowances/summary?year=${year}`, "GET"),
    enabled: isManagement,
  });
  const balanceByPerson = useMemo(() => new Map((teamBalances?.people ?? []).map((person) => [person.personnelId, person])), [teamBalances]);

  useEffect(() => { setAllowanceDraft({ vacationDays: "", vacationCarryoverDays: "", epicalDays: "" }); setEditingAbsence(null); }, [year, teamPersonId]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/absence-requests"] });
    queryClient.invalidateQueries({ queryKey: ["/api/absence-allowances"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/capacity/weekly"] });
  };
  const createMutation = useMutation({
    mutationFn: () => apiRequest("/api/absence-requests", "POST", { ...form, personnelId: isManagement && form.personnelId ? Number(form.personnelId) : undefined, notes: form.notes.trim() || null }),
    onSuccess: () => { refresh(); setForm({ startDate: "", endDate: "", type: "vacation", notes: "", planningStatus: "tentative", personnelId: "" }); toast({ title: "Solicitud enviada" }); },
    onError: (error: Error) => toast({ title: "No se pudo enviar", description: error.message, variant: "destructive" }),
  });
  const actionMutation = useMutation({
    mutationFn: ({ id, action, reason, allowNegativeBalance = false }: { id: number; action: string; reason?: string; allowNegativeBalance?: boolean }) =>
      apiRequest(`/api/absence-requests/${id}/actions`, "POST", { action, reason, allowNegativeBalance }),
    onSuccess: () => { refresh(); toast({ title: "Solicitud actualizada" }); },
    onError: (error: Error) => toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }),
  });
  const editMutation = useMutation({
    mutationFn: () => apiRequest(`/api/absence-requests/${editingAbsence?.id}`, "PATCH", editDraft),
    onSuccess: () => { refresh(); setEditingAbsence(null); toast({ title: "Ausencia actualizada" }); },
    onError: (error: Error) => toast({ title: "No se pudo editar", description: error.message, variant: "destructive" }),
  });
  const allowanceMutation = useMutation({
    mutationFn: () => apiRequest(`/api/absence-allowances/${balancePersonId}/${year}`, "PUT", {
      vacationDays: Number(allowanceDraft.vacationDays || balance?.vacationDays || 0), vacationCarryoverDays: Number(allowanceDraft.vacationCarryoverDays || balance?.vacationCarryoverDays || 0), epicalDays: Number(allowanceDraft.epicalDays || balance?.epicalDays || 0),
    }),
    onSuccess: () => { refresh(); toast({ title: "Cupo anual guardado" }); },
    onError: (error: Error) => toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" }),
  });

  const pendingTeam = useMemo(() => team.filter((absence) => ["pending", "cancellation_requested"].includes(absence.status)), [team]);
  const visibleTeam = team.filter((absence) => teamFilterId === "all" || String(absence.personnelId) === teamFilterId);
  const requestAction = (absence: Absence, action: string) => {
    const needsReason = ["reject", "request_cancellation", "approve_cancellation", "reject_cancellation"].includes(action);
    const reason = needsReason ? window.prompt("Motivo o comentario:") ?? undefined : undefined;
    if (needsReason && reason === undefined) return;
    actionMutation.mutate({ id: absence.id, action, reason });
  };

  const renderAbsenceList = ({ rows, loading, teamMode = false }: { rows: Absence[]; loading: boolean; teamMode?: boolean }) => (
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
                    {absence.allowanceExempt && <span className="text-xs text-muted-foreground">Sin cupo — freelance</span>}
                    <Badge variant={STATUS_VARIANTS[absence.status] || "outline"}>{STATUS_LABELS[absence.status] || absence.status}</Badge>
                    <Badge variant="outline">{absence.planningStatus === "confirmed" ? "Confirmada" : "Tentativa"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{absence.startDate} → {absence.endDate} · {absence.businessDays} día(s) hábil(es)</p>
                  {absence.notes && <p className="mt-1 text-xs text-slate-600">{absence.notes}</p>}
                  {absence.reviewReason && <p className="mt-1 text-xs text-muted-foreground">Respuesta: {absence.reviewReason}</p>}
                  {teamMode && ["pending", "cancellation_requested"].includes(absence.status) && <BalanceStrip person={balanceByPerson.get(absence.personnelId)} absence={absence} />}
                  {editingAbsence?.id === absence.id && <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Input type="date" value={editDraft.startDate} onChange={(e) => setEditDraft({ ...editDraft, startDate: e.target.value })} />
                    <Input type="date" value={editDraft.endDate} onChange={(e) => setEditDraft({ ...editDraft, endDate: e.target.value })} />
                    <Select value={editDraft.type} onValueChange={(type) => setEditDraft({ ...editDraft, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                    <Select value={editDraft.planningStatus} onValueChange={(planningStatus) => setEditDraft({ ...editDraft, planningStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tentative">Tentativa</SelectItem><SelectItem value="confirmed">Confirmada</SelectItem></SelectContent></Select>
                    <Input className="sm:col-span-2" value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} placeholder="Notas" />
                    <div className="flex gap-2 sm:col-span-2"><Button size="sm" disabled={editMutation.isPending} onClick={() => editMutation.mutate()}>Guardar cambios</Button><Button size="sm" variant="outline" onClick={() => setEditingAbsence(null)}>Cancelar</Button></div>
                  </div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(teamMode || ["pending", "approved"].includes(absence.status)) && <Button size="sm" variant="outline" onClick={() => { setEditingAbsence(absence); setEditDraft({ startDate: absence.startDate, endDate: absence.endDate, type: absence.type, notes: absence.notes || "", planningStatus: absence.planningStatus || "tentative" }); }}>Editar</Button>}
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

  const requestForm = (
          <Card><CardHeader><CardTitle className="text-sm">{isManagement ? "Registrar ausencia" : "Nueva solicitud"}</CardTitle></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
            {isManagement && <div><Label>Persona</Label><Select value={form.personnelId} onValueChange={(personnelId) => setForm({ ...form, personnelId })}><SelectTrigger><SelectValue placeholder="Seleccionar persona" /></SelectTrigger><SelectContent>{personnel.map((person) => <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}</SelectContent></Select></div>}
            <div><Label>Desde</Label><Input type="date" required value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></div>
            <div><Label>Hasta</Label><Input type="date" required value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></div>
            <div><Label>Tipo</Label><Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-end text-xs text-muted-foreground">Se registra como pendiente y tentativa; después podés confirmarla.</div>
            <div><Label>Notas privadas</Label><Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Opcional" /></div>
            <div className="sm:col-span-2"><Button disabled={createMutation.isPending || (!isManagement && !myPerson) || (isManagement && !form.personnelId)}><CalendarDays className="mr-2 h-4 w-4" />{isManagement ? "Registrar ausencia" : "Enviar solicitud"}</Button>{!isManagement && !myPerson && <p className="mt-2 text-xs text-destructive">Tu email no está vinculado con Personal.</p>}</div>
          </form></CardContent></Card>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><UserX className="h-5 w-5" />{isManagement ? "Gestión de ausencias" : "Mis ausencias"}</h1><p className="text-sm text-muted-foreground">{isManagement ? "Gestión de Operaciones: aprobá solicitudes, administrá cupos y planificá las ausencias del equipo." : "Solicitá tus días y consultá el estado de tus ausencias."}</p></div>
        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{[year - 1, year, year + 1].map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent></Select>
      </div>

      <Tabs defaultValue={isManagement ? "team" : "mine"} key={isManagement ? "management" : "personal"}>
        <TabsList>{isManagement ? <><TabsTrigger value="team">Equipo {pendingTeam.length > 0 && `(${pendingTeam.length})`}</TabsTrigger><TabsTrigger value="allowances">Cupos</TabsTrigger></> : <TabsTrigger value="mine">Mis solicitudes</TabsTrigger>}</TabsList>
        {!isManagement && <TabsContent value="mine" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vacaciones</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{balance?.allowanceExempt ? "Sin cupo — freelance" : balance?.configured ? `${balance.vacationBalanceDays ?? 0} días` : "Sin cupo configurado"}</p><p className="text-xs text-muted-foreground">Cupo: {balance?.vacationDays ?? 0} · Trasladados: {balance?.vacationCarryoverDays ?? 0} · Adelanto de años anteriores: {balance?.vacationAdvanceDebtDays ?? 0} · Usados: {balance?.used.vacation ?? 0}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Días Epical</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{balance?.allowanceExempt ? "Sin cupo — freelance" : balance?.configured ? `${Math.max(0, (balance.epicalDays || 0) - balance.used.epical)} días` : "Sin cupo configurado"}</p><p className="text-xs text-muted-foreground">Usados: {balance?.used.epical ?? 0}</p></CardContent></Card>
          </div>
          {requestForm}

          {renderAbsenceList({ rows: mine, loading: mineLoading })}
        </TabsContent>}
        {isManagement && <TabsContent value="team" className="space-y-4">
          {requestForm}
          <div className="max-w-sm"><Label>Filtrar persona</Label><Select value={teamFilterId} onValueChange={setTeamFilterId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todo el equipo</SelectItem>{personnel.map((person) => <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}</SelectContent></Select></div>
          <AbsenceTimeline rows={visibleTeam} year={year} />
          {renderAbsenceList({ rows: visibleTeam, loading: teamLoading, teamMode: true })}
        </TabsContent>}
        {isManagement && <TabsContent value="allowances" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-sm">Saldos del equipo · {year}</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <table className="w-full text-xs" data-testid="team-balances-table">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="px-4 py-2 font-medium">Persona</th><th className="px-2 py-2 font-medium">Vac. cupo</th><th className="px-2 py-2 font-medium">Traslado</th><th className="px-2 py-2 font-medium">Adelanto</th><th className="px-2 py-2 font-medium">Usados</th><th className="px-2 py-2 font-medium">Disponible</th><th className="px-2 py-2 font-medium">Epical disp.</th><th className="px-2 py-2 font-medium">Enferm.</th><th className="px-2 py-2 font-medium">Otros</th></tr></thead>
              <tbody>{(teamBalances?.people ?? []).map((person) => (
                <tr key={person.personnelId} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{person.name}</td>
                  {person.dataError ? <td colSpan={6} className="px-2 py-2 text-destructive">Revisar ausencias (fechas inválidas)</td> : person.allowanceExempt ? <td colSpan={6} className="px-2 py-2 text-muted-foreground">Sin cupo — freelance</td> : person.configured ? <>
                    <td className="px-2 py-2 tabular-nums">{person.vacation.quota ?? 0}</td>
                    <td className="px-2 py-2 tabular-nums">{person.vacation.carryover}</td>
                    <td className="px-2 py-2 tabular-nums">{person.vacation.advanceDebt}</td>
                    <td className="px-2 py-2 tabular-nums">{person.vacation.used}</td>
                    <td className={`px-2 py-2 font-semibold tabular-nums ${person.vacation.balance < 0 ? "text-destructive" : ""}`}>{person.vacation.balance}</td>
                    <td className="px-2 py-2 tabular-nums">{person.epical.balance ?? "—"}</td>
                  </> : <td colSpan={6} className="px-2 py-2 text-amber-700">Sin cupo configurado</td>}
                  <td className="px-2 py-2 tabular-nums">{person.notCounted.sick}</td>
                  <td className="px-2 py-2 tabular-nums">{person.notCounted.other}</td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Cupo anual por persona</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2"><Label>Persona</Label><Select value={teamPersonId} onValueChange={(value) => { setTeamPersonId(value); setAllowanceDraft({ vacationDays: "", vacationCarryoverDays: "", epicalDays: "" }); }}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{personnel.map((person) => <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Vacaciones</Label><Input type="number" min={0} value={allowanceDraft.vacationDays} placeholder={balance?.vacationDays == null ? "Sin configurar" : String(balance.vacationDays)} onChange={(event) => setAllowanceDraft({ ...allowanceDraft, vacationDays: event.target.value })} /></div>
          <div><Label>Traslado</Label><Input type="number" min={0} value={allowanceDraft.vacationCarryoverDays} placeholder={String(balance?.vacationCarryoverDays ?? 0)} onChange={(event) => setAllowanceDraft({ ...allowanceDraft, vacationCarryoverDays: event.target.value })} /></div>
          <div><Label>Días Epical</Label><Input type="number" min={0} value={allowanceDraft.epicalDays} placeholder={balance?.epicalDays == null ? "Sin configurar" : String(balance.epicalDays)} onChange={(event) => setAllowanceDraft({ ...allowanceDraft, epicalDays: event.target.value })} /></div>
          <div className="sm:col-span-4"><p className="mb-2 text-xs text-muted-foreground">{teamPersonId ? `${balance?.allowanceExempt ? "Sin cupo — freelance" : "Cupo de"} ${personnel.find(person => String(person.id) === teamPersonId)?.name ?? "la persona seleccionada"} · ${year}${balance?.vacationAdvanceDebtDays ? ` · Adelantos anteriores: ${balance.vacationAdvanceDebtDays} día(s), descontados automáticamente del cupo` : ""}` : "Seleccioná una persona para consultar y editar su cupo."}</p><Button disabled={balance?.allowanceExempt || !teamPersonId || balanceLoading || (!balance?.configured && (allowanceDraft.vacationDays === "" || allowanceDraft.epicalDays === "")) || allowanceMutation.isPending} onClick={() => allowanceMutation.mutate()}>Guardar cupo {year}</Button></div>
        </CardContent></Card></TabsContent>}
      </Tabs>
    </div>
  );
}
