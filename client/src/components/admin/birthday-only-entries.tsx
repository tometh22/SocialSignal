import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type BirthdayEntryRow = { id: number; name: string; birthday: string };

/**
 * Cumpleaños de personas que no son personal (no tienen costos, capacidad ni ausencias).
 * Se suman a los del personal en el Inicio; sólo se guarda nombre y fecha.
 */
export function BirthdayOnlyEntries() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const { data: entries = [] } = useQuery<BirthdayEntryRow[]>({ queryKey: ["/api/birthday-entries"] });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/birthday-entries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/birthdays"] });
  };
  const create = useMutation({
    mutationFn: () => apiRequest("/api/birthday-entries", "POST", { name, birthday }),
    onSuccess: () => { refresh(); setName(""); setBirthday(""); toast({ title: "Cumpleaños agregado" }); },
    onError: (error: Error) => toast({ title: "No se pudo agregar", description: error.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/birthday-entries/${id}`, "DELETE"),
    onSuccess: () => { refresh(); toast({ title: "Cumpleaños eliminado" }); },
    onError: (error: Error) => toast({ title: "No se pudo eliminar", description: error.message, variant: "destructive" }),
  });

  return (
    <Card className="standard-card mt-6" data-testid="birthday-only-entries">
      <CardHeader>
        <CardTitle className="heading-card">Solo cumpleaños</CardTitle>
        <CardDescription>Personas que no forman parte del personal pero cuyo cumpleaños se muestra en el Inicio. No generan costos, capacidad ni ausencias.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <div className="min-w-[200px] flex-1">
            <label className="text-sm font-medium" htmlFor="birthday-only-name">Nombre</label>
            <Input id="birthday-only-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre y apellido" required minLength={2} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="birthday-only-date">Cumpleaños</label>
            <Input id="birthday-only-date" type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} required />
          </div>
          <Button type="submit" disabled={create.isPending || !name.trim() || !birthday}>Agregar</Button>
        </form>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay cumpleaños sueltos cargados.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="font-medium">{entry.name}</span>
                <span className="ml-auto text-muted-foreground">{entry.birthday.slice(8, 10)}/{entry.birthday.slice(5, 7)}</span>
                <Button size="icon" variant="ghost" aria-label={`Eliminar cumpleaños de ${entry.name}`} onClick={() => remove.mutate(entry.id)} disabled={remove.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
