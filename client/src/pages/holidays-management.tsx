import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, Plus, Loader2 } from "lucide-react";

export default function HolidaysManagement() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: holidays, isLoading } = useQuery<any[]>({
    queryKey: ["/api/holidays", year],
    queryFn: () =>
      fetch(`/api/holidays?year=${year}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/holidays", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setNewDate("");
      setNewName("");
      toast({ title: "Feriado agregado" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/holidays/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      toast({ title: "Feriado eliminado" });
    },
  });

  const handleAdd = () => {
    if (!newDate || !newName.trim()) return;
    addMutation.mutate({
      date: newDate,
      name: newName.trim(),
      year: new Date(newDate).getFullYear(),
      isNational: true,
    });
  };

  const sorted = (holidays || []).sort((a: any, b: any) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestión de Feriados</h1>
        <Input
          type="number"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value) || now.getFullYear())}
          className="w-24"
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Agregar Feriado</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-44"
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del feriado"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={addMutation.isPending}>
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Agregar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Feriados {year} ({sorted.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Cargando...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No hay feriados cargados para {year}</div>
          ) : (
            <div className="space-y-2">
              {sorted.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/30 border">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground">
                      {new Date(h.date).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                    </span>
                    <span className="font-medium">{h.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(h.id)}
                    disabled={deleteMutation.isPending}
                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
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
