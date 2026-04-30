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
import { Loader2, RefreshCw, UserPlus } from "lucide-react";
import type { Role } from "@shared/schema";

const IGNORE = "__ignore__";
const PENDING = "__pending__";
const CREATE_NEW = "__create_new__";

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

const CONTRACT_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "freelance", label: "Freelance" },
];

function formatARS(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `$${Math.round(value).toLocaleString("es-AR")}`;
}

interface CreateForm {
  roleId: string;
  contractType: string;
}

export function SheetsSyncDialog() {
  const [open, setOpen] = useState(false);
  const [aliasChoices, setAliasChoices] = useState<Record<string, string>>({});
  const [includedSheetNames, setIncludedSheetNames] = useState<Set<string>>(new Set());
  // Sheet name actualmente en modo "crear nueva persona" → muestra el form inline.
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  // Form de creación (compartido — solo hay uno abierto a la vez).
  const [createForm, setCreateForm] = useState<CreateForm>({
    roleId: "",
    contractType: "full-time",
  });
  // Personas creadas durante la sesión del dialog. Las merge-amos a las options
  // del dropdown sin tener que refetchear el preview (que reabriría el sheet).
  const [createdPersonnel, setCreatedPersonnel] = useState<{ id: number; name: string }[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const previewQuery = useQuery<PreviewResponse>({
    queryKey: ["/api/personnel/sheets-sync/preview"],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  const rolesQuery = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    enabled: open,
  });

  const createPersonMutation = useMutation<
    { id: number; name: string },
    Error,
    { sheetName: string; roleId: number; contractType: string }
  >({
    mutationFn: async ({ sheetName, roleId, contractType }) => {
      const payload: Record<string, unknown> = {
        name: sheetName,
        roleId,
        contractType,
        hourlyRate: 0, // USD; los valores ARS los carga el sync mes-a-mes.
        includeInRealCosts: true,
      };
      // monthlyHours es requerido por el server cuando no es freelance.
      if (contractType !== "freelance") {
        payload.monthlyHours = 160;
      }
      return apiRequest("/api/personnel", "POST", payload);
    },
    onSuccess: (newPerson, variables) => {
      toast({
        title: "Persona creada",
        description: `${newPerson.name} fue creada y mapeada al row del sheet.`,
      });
      // Sumar al pool local de options para que aparezca en otros dropdowns.
      setCreatedPersonnel((prev) => [...prev, { id: newPerson.id, name: newPerson.name }]);
      // Auto-mapear: el sheetName que disparó la creación ahora apunta a este id.
      setAliasChoices((prev) => ({ ...prev, [variables.sheetName]: String(newPerson.id) }));
      setIncludedSheetNames((prev) => new Set(prev).add(variables.sheetName));
      // Cerrar el form inline y resetear.
      setCreatingFor(null);
      setCreateForm({ roleId: "", contractType: "full-time" });
      // Invalidar el cache de personnel global así el resto del admin lo ve.
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
    },
    onError: (error) => {
      toast({
        title: "No se pudo crear la persona",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applyMutation = useMutation<ApplyResponse, Error, void>({
    mutationFn: async () => {
      const aliases: Record<string, number | null> = {};
      for (const [sheetName, choice] of Object.entries(aliasChoices)) {
        if (choice === PENDING || choice === CREATE_NEW) continue;
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
      setCreatedPersonnel([]);
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
  const personnelOptions = useMemo(
    () => [...(previewQuery.data?.availablePersonnel ?? []), ...createdPersonnel],
    [previewQuery.data, createdPersonnel],
  );
  const roles = rolesQuery.data ?? [];

  // El "Aplicar" se habilita cuando todas las filas sin match tienen una decisión
  // tomada (mapeo a persona o "ignorar"). Las que están en modo "crear" no
  // cuentan como decididas hasta que se confirme la creación.
  const allUnmatchedDecided = unmatched.every((row) => {
    const choice = aliasChoices[row.sheetName];
    return choice && choice !== PENDING && choice !== CREATE_NEW;
  });

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

    if (value === CREATE_NEW) {
      // Abrir form inline, no incluir todavía en el applyTo.
      setCreatingFor(sheetName);
      setCreateForm({ roleId: "", contractType: "full-time" });
      setIncludedSheetNames((prev) => {
        const next = new Set(prev);
        next.delete(sheetName);
        return next;
      });
      return;
    }

    // Si estábamos creando para este row y se eligió otra cosa, cerrar el form.
    if (creatingFor === sheetName) setCreatingFor(null);

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

  const submitCreatePerson = (sheetName: string) => {
    const roleIdNum = parseInt(createForm.roleId, 10);
    if (!roleIdNum) {
      toast({
        title: "Falta el rol",
        description: "Elegí un rol para la nueva persona.",
        variant: "destructive",
      });
      return;
    }
    createPersonMutation.mutate({
      sheetName,
      roleId: roleIdNum,
      contractType: createForm.contractType,
    });
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
            de 2026 en personnel. Los rows sin coincidencia los mapeás abajo, los creás como
            persona nueva o los ignorás.
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
                  Mapeá cada nombre del sheet a una persona, creala como nueva, o marcá
                  "Ignorar" para que no se vuelva a preguntar la próxima vez.
                </p>
                <div className="rounded-md border divide-y">
                  {unmatched.map((row) => {
                    const choice = aliasChoices[row.sheetName] ?? PENDING;
                    const isCreating = creatingFor === row.sheetName;
                    return (
                      <div key={row.sheetName} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
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
                              <SelectItem value={CREATE_NEW}>
                                <span className="flex items-center gap-2">
                                  <UserPlus className="h-3 w-3" />
                                  Crear como nueva persona
                                </span>
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

                        {isCreating && (
                          <div className="ml-0 rounded-md border bg-slate-50 p-3 space-y-3">
                            <div className="text-xs font-medium text-slate-700">
                              Crear nueva persona &quot;{row.sheetName}&quot;
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">
                                  Rol
                                </label>
                                <Select
                                  value={createForm.roleId}
                                  onValueChange={(v) =>
                                    setCreateForm((prev) => ({ ...prev, roleId: v }))
                                  }
                                >
                                  <SelectTrigger className="w-full bg-white">
                                    <SelectValue placeholder="Elegir rol…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roles.map((r) => (
                                      <SelectItem key={r.id} value={String(r.id)}>
                                        {r.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">
                                  Tipo de contrato
                                </label>
                                <Select
                                  value={createForm.contractType}
                                  onValueChange={(v) =>
                                    setCreateForm((prev) => ({ ...prev, contractType: v }))
                                  }
                                >
                                  <SelectTrigger className="w-full bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CONTRACT_TYPES.map((c) => (
                                      <SelectItem key={c.value} value={c.value}>
                                        {c.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Las tarifas mes-a-mes 2026 se cargan automáticamente desde el sheet
                              al aplicar. Otros datos (email, sueldo USD, etc.) los completás
                              después en Admin → Personal.
                            </p>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCreatingFor(null);
                                  setAliasChoices((prev) => {
                                    const next = { ...prev };
                                    delete next[row.sheetName];
                                    return next;
                                  });
                                }}
                                disabled={createPersonMutation.isPending}
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => submitCreatePerson(row.sheetName)}
                                disabled={createPersonMutation.isPending || !createForm.roleId}
                              >
                                {createPersonMutation.isPending && (
                                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                )}
                                Crear y mapear
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Listas para aplicar ({matched.length + Array.from(includedSheetNames).filter(n => !matchedSheetNames.includes(n)).length})
              </h3>
              {matched.length === 0 && includedSheetNames.size === 0 ? (
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
              includedSheetNames.size === 0 ||
              creatingFor !== null
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
