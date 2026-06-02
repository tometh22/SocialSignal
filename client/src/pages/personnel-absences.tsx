import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Trash2, UserX } from "lucide-react";

const ABSENCE_TYPES: Record<string, string> = {
  vacation: "Vacaciones",
  sick: "Enfermedad",
  other: "Otro",
};

export default function PersonnelAbsencesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    personnelId: "",
    startDate: "",
    endDate: "",
    type: "vacation",
    notes: "",
  });

  const { data: personnel = [] } = useQuery<any[]>({
    queryKey: ["/api/personnel"],
  });

  const { data: absences = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/personnel-absences"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/personnel-absences", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel-absences"] });
      toast({ title: "Ausencia registrada" });
      setForm({ personnelId: "", startDate: "", endDate: "", type: "vacation", notes: "" });
    },
    onError: () => toast({ title: "Error al registrar ausencia", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/personnel-absences/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel-absences"] });
      toast({ title: "Ausencia eliminada" });
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personnelId || !form.startDate || !form.endDate) {
      toast({ title: "Completá todos los campos requeridos", variant: "destructive" });
      return;
    }
    createMutation.mutate({ ...form, personnelId: parseInt(form.personnelId) });
  };

  const getPersonName = (id: number) => personnel.find((p: any) => p.id === id)?.name ?? `#${id}`;

  return (
    <div className="container mx-auto py-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <UserX className="h-5 w-5 text-slate-600" />
        <h1 className="text-xl font-semibold text-slate-900">Ausencias del personal</h1>
      </div>
      <p className="text-sm text-slate-500">
        Registrá vacaciones, licencias u otras ausencias. Impactan en la capacidad semanal del equipo.
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Nueva ausencia</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Persona *</Label>
              <Select value={form.personnelId} onValueChange={v => setForm(f => ({ ...f, personnelId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccioná una persona" /></SelectTrigger>
                <SelectContent>
                  {(personnel as any[]).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacaciones</SelectItem>
                  <SelectItem value="sick">Enfermedad</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha inicio *</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Fecha fin *</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>Notas (opcional)</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ej: vacaciones de verano" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar ausencia
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Ausencias registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : (absences as any[]).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No hay ausencias registradas.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(absences as any[]).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="font-medium text-sm text-slate-800">{getPersonName(a.personnelId)}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {ABSENCE_TYPES[a.type] ?? a.type} · {a.startDate} → {a.endDate}
                    </span>
                    {a.notes && <span className="ml-2 text-xs text-slate-400">· {a.notes}</span>}
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => deleteMutation.mutate(a.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
