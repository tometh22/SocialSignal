import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw } from "lucide-react";

const IGNORE = "__ignore__";
const PENDING = "__pending__";

interface ProposedChange {
  field: string;
  current: number | null;
  next: number;
}

interface PreviewRow {
  sheetName: string;
  match:
    | { personnelId: number; source: "exact" | "alias" }
    | { ignored: true }
    | null;
  proposedChanges: ProposedChange[];
  monthlyRates: Record<string, number>;
}

interface PreviewResponse {
  matched: PreviewRow[];
  unmatched: PreviewRow[];
  availablePersonnel: { id: number; name: string }[];
}

interface ApplyResponse {
  updatedPersonnel: number;
  cellsUpdated: number;
  skipped: string[];
}

const MONTH_LABELS: Record<string, string> = {
  jan2026HourlyRateARS: "Ene",
  feb2026HourlyRateARS: "Feb",
  mar2026HourlyRateARS: "Mar",
  apr2026HourlyRateARS: "Abr",
  may2026HourlyRateARS: "May",
  jun2026HourlyRateARS: "Jun",
  jul2026HourlyRateARS: "Jul",
  aug2026HourlyRateARS: "Ago",
  sep2026HourlyRateARS: "Sep",
  oct2026HourlyRateARS: "Oct",
  nov2026HourlyRateARS: "Nov",
  dec2026HourlyRateARS: "Dic",
};

function formatARS(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `$${Math.round(value).toLocaleString("es-AR")}`;
}

export function SheetsSyncDialog() {
  const [open, setOpen] = useState(false);
  const [aliasChoices, setAliasChoices] = useState<Record<string, string>>({});
  const [includedSheetNames, setIncludedSheetNames] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const previewQuery = useQuery<PreviewResponse>({
    queryKey: ["/api/personnel/sheets-sync/preview"],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  const applyMutation = useMutation<ApplyResponse, Error, void>({
    mutationFn: async () => {
      const aliases: Record<string, number | null> = {};
      for (const [sheetName, choice] of Object.entries(aliasChoices)) {
        if (choice === PENDING) continue;
        aliases[sheetName] = choice === IGNORE ? null : Number(choice);
      }
      return apiRequest("/api/personnel/sheets-sync/apply", "POST", {
        aliases,
        applyTo: Array.from(includedSheetNames),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Sincronización aplicada",
        description: `${data.updatedPersonnel} persona(s) actualizada(s), ${data.cellsUpdated} valores escritos.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      setOpen(false);
      setAliasChoices({});
      setIncludedSheetNames(new Set());
    },
    onError: (error) => {
      toast({
        title: "Error al sincronizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cuando llega el preview, marcar todos los matched como incluidos por defecto.
  const matchedSheetNames = useMemo(
    () => previewQuery.data?.matched.map((r) => r.sheetName) ?? [],
    [previewQuery.data],
  );
  if (
    previewQuery.data &&
    includedSheetNames.size === 0 &&
    matchedSheetNames.length > 0 &&
    !applyMutation.isPending
  ) {
    setIncludedSheetNames(new Set(matchedSheetNames));
  }

  const unmatched = previewQuery.data?.unmatched ?? [];
  const matched = previewQuery.data?.matched ?? [];
  const personnelOptions = previewQuery.data?.availablePersonnel ?? [];

  // El "Aplicar" se habilita cuando todas las filas sin match tienen una decisión
  // tomada (mapeo a persona o "ignorar").
  const allUnmatchedDecided = unmatched.every(
    (row) => aliasChoices[row.sheetName] && aliasChoices[row.sheetName] !== PENDING,
  );

  const toggleInclude = (sheetName: string) => {
    setIncludedSheetNames((prev) => {
      const next = new Set(prev);
      if (next.has(sheetName)) next.delete(sheetName);
      else next.add(sheetName);
      return next;
    });
  };

  const setAliasChoice = (sheetName: string, value: string) => {
    setAliasChoices((prev) => ({ ...prev, [sheetName]: value }));
    // Si se eligió una persona, agregar el row al "applyTo".
    if (value !== IGNORE && value !== PENDING) {
      setIncludedSheetNames((prev) => new Set(prev).add(sheetName));
    } else {
      setIncludedSheetNames((prev) => {
        const next = new Set(prev);
        next.delete(sheetName);
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Sincronizar con master
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sincronizar tarifas 2026 desde el master</DialogTitle>
          <DialogDescription>
            Lee la pestaña "Valor Hora Real y Estimada" y actualiza las tarifas mes-a-mes
            de 2026 en personnel. Los rows sin coincidencia los mapeás abajo o los ignorás.
          </DialogDescription>
        </DialogHeader>

        {previewQuery.isLoading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Leyendo el sheet…
          </div>
        )}

        {previewQuery.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Error leyendo el sheet: {(previewQuery.error as Error).message}
          </div>
        )}

        {previewQuery.data && (
          <div className="space-y-6">
            {unmatched.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Sin coincidencia ({unmatched.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Mapeá cada nombre del sheet a una persona o marcá "Ignorar"
                  para que no se vuelva a preguntar la próxima vez.
                </p>
                <div className="rounded-md border divide-y">
                  {unmatched.map((row) => {
                    const choice = aliasChoices[row.sheetName] ?? PENDING;
                    return (
                      <div
                        key={row.sheetName}
                        className="flex items-center justify-between gap-3 p-3"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium">{row.sheetName}</div>
                          <div className="text-xs text-muted-foreground">
                            {Object.keys(row.monthlyRates).length} meses con valor
                          </div>
                        </div>
                        <Select
                          value={choice}
                          onValueChange={(v) => setAliasChoice(row.sheetName, v)}
                        >
                          <SelectTrigger className="w-72">
                            <SelectValue placeholder="Elegir persona…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={PENDING} disabled>
                              Elegir persona…
                            </SelectItem>
                            <SelectItem value={IGNORE}>Ignorar este nombre</SelectItem>
                            {personnelOptions.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Listas para aplicar ({matched.length})
              </h3>
              {matched.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay matches automáticos. Mapeá los rows de arriba para incluirlos.
                </p>
              ) : (
                <div className="rounded-md border divide-y">
                  {matched.map((row) => {
                    const personnelName =
                      personnelOptions.find(
                        (p) =>
                          row.match && "personnelId" in row.match && p.id === row.match.personnelId,
                      )?.name ?? "?";
                    const sourceTag =
                      row.match && "source" in row.match
                        ? row.match.source === "alias"
                          ? "alias"
                          : "match exacto"
                        : "";
                    const included = includedSheetNames.has(row.sheetName);
                    return (
                      <div key={row.sheetName} className="p-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={included}
                            onCheckedChange={() => toggleInclude(row.sheetName)}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {row.sheetName}
                              <span className="ml-2 text-xs text-muted-foreground">
                                → {personnelName}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">{sourceTag}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.proposedChanges.length} cambios
                          </div>
                        </div>
                        {row.proposedChanges.length > 0 && (
                          <div className="ml-7 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                            {row.proposedChanges.map((c) => (
                              <div
                                key={c.field}
                                className="rounded border bg-slate-50 px-2 py-1"
                              >
                                <div className="font-medium">
                                  {MONTH_LABELS[c.field] ?? c.field}
                                </div>
                                <div className="text-muted-foreground">
                                  {formatARS(c.current)} → {" "}
                                  <span className="text-emerald-700 font-medium">
                                    {formatARS(c.next)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={
              !previewQuery.data ||
              applyMutation.isPending ||
              !allUnmatchedDecided ||
              includedSheetNames.size === 0
            }
          >
            {applyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Aplicar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
