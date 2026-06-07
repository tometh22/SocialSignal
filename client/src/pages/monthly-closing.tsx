import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/hooks/use-currency";
import { Loader2, Check, Pencil, X, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Default contractual base hours by contract type
function defaultBaseHours(person: any): number {
  const type = (person.contractType || "full-time").toLowerCase();
  if (type === "freelance") return person.monthlyHours || 0;
  // Use configured monthlyHours when available; fall back to contract-type defaults
  if (person.monthlyHours) return person.monthlyHours;
  return type === "part-time" ? 120 : 160;
}

export default function MonthlyClosing() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [contractFilter, setContractFilter] = useState<string>("all");
  // hoursOverrides: personnelId → override string (empty = use default)
  const [hoursOverrides, setHoursOverrides] = useState<Record<number, string>>({});
  // editingHours: personnelId currently showing the inline input
  const [editingHours, setEditingHours] = useState<number | null>(null);
  const [editingInput, setEditingInput] = useState<string>("");
  // Per-row mutation tracking
  const [closingPersonnelId, setClosingPersonnelId] = useState<number | null>(null);
  // Re-close confirmation target
  const [reCloseTarget, setReCloseTarget] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { exchangeRate } = useCurrency();

  const { data: personnel, isLoading: personnelLoading } = useQuery<any[]>({ queryKey: ["/api/personnel"] });
  const { data: estimatedRates = [] } = useQuery<any[]>({
    queryKey: ["/api/estimated-rates", year],
    queryFn: () =>
      fetch(`/api/estimated-rates?year=${year}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });
  const { data: closings, isLoading: closingsLoading } = useQuery<any[]>({
    queryKey: ["/api/monthly-closings", year, month + 1],
    queryFn: () =>
      fetch(`/api/monthly-closings?year=${year}&month=${month + 1}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
  });

  const closeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/monthly-closings", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-closings"] });
      toast({ title: "Cierre guardado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar el cierre", variant: "destructive" });
    },
    onSettled: () => {
      setClosingPersonnelId(null);
    },
  });

  const getClosing = (personnelId: number) =>
    closings?.find((c: any) => c.personnelId === personnelId);

  // Returns the best available rate for the selected month: estimated > base by billing currency.
  // rate    = ARS rate (or USD rate for "USD" billing)
  // rateUSD = USD component (only meaningful for "USD" and "mixed" billing)
  const getEffectiveRate = (person: any): { rate: number; rateUSD: number; isEstimated: boolean } => {
    const est = estimatedRates.find(
      (r: any) => r.personnelId === person.id && r.month === month + 1
    );
    const billing = person.billingCurrency ?? "ARS";
    const usdRate = person.hourlyRate || 0;
    if (est?.estimatedRateARS && est.estimatedRateARS > 0) {
      return { rate: Number(est.estimatedRateARS), rateUSD: usdRate, isEstimated: true };
    }
    if (billing === "USD") {
      return { rate: usdRate, rateUSD: usdRate, isEstimated: false };
    }
    if (billing === "mixed") {
      // rate = ARS component, rateUSD = USD component
      return { rate: person.hourlyRateARS || 0, rateUSD: usdRate, isEstimated: false };
    }
    // ARS: prefer the ARS-specific rate, fall back to direct ARS field
    return { rate: person.hourlyRateARS || 0, rateUSD: 0, isEstimated: false };
  };

  // Effective base hours for a person: override > default by contract type
  const effectiveBaseHours = (person: any): number => {
    const override = hoursOverrides[person.id];
    if (override !== undefined && override !== "") {
      const parsed = parseFloat(override);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return defaultBaseHours(person);
  };

  const handleStartEditHours = (person: any) => {
    setEditingInput(String(effectiveBaseHours(person)));
    setEditingHours(person.id);
  };

  const handleConfirmHours = (personnelId: number) => {
    setHoursOverrides((prev) => ({ ...prev, [personnelId]: editingInput }));
    setEditingHours(null);
  };

  const handleCancelEditHours = () => {
    setEditingHours(null);
    setEditingInput("");
  };

  const handleResetHours = (personnelId: number) => {
    setHoursOverrides((prev) => {
      const next = { ...prev };
      delete next[personnelId];
      return next;
    });
  };

  const doClose = (person: any) => {
    const hrs = effectiveBaseHours(person);
    const { rate, rateUSD } = getEffectiveRate(person);
    const billing = getBillingCurrency(person);
    const hasRate = billing === "mixed" ? (rate > 0 || rateUSD > 0) : rate > 0;
    if (!hasRate) {
      toast({
        title: "Sin tarifa configurada",
        description: `${person.name} no tiene tarifa para ${MONTHS[month]} ${year}. Configurala en Valor Hora Estimada o en Admin → Personal.`,
        variant: "destructive",
      });
      return;
    }
    const existing = getClosing(person.id);
    setClosingPersonnelId(person.id);

    let hourlyRate: number;
    let totalCost: number;
    let hourlyRateCurrency: string;

    if (billing === "USD") {
      // Store USD rate; totalCost = ARS equivalent
      hourlyRate = rateUSD;
      totalCost = hrs * rateUSD * (exchangeRate || 1);
      hourlyRateCurrency = "USD";
    } else if (billing === "mixed") {
      const usdFraction = getUsdFraction(person);
      const costARS = hrs * rate * (1 - usdFraction);
      const costUSD = hrs * rateUSD * usdFraction;
      totalCost = costARS + costUSD * (exchangeRate || 1);
      hourlyRate = hrs > 0 ? totalCost / hrs : 0;
      hourlyRateCurrency = "mixed";
    } else {
      hourlyRate = rate;
      totalCost = hrs * rate;
      hourlyRateCurrency = "ARS";
    }

    closeMutation.mutate({
      personnelId: person.id,
      year,
      month: month + 1,
      actualHours: existing?.actualHours || hrs,
      adjustedHours: hrs,
      hourlyRate,
      hourlyRateCurrency,
      totalCost,
      exchangeRateAtClose: exchangeRate || null,
    });
  };

  const handleClose = (person: any) => {
    const closing = getClosing(person.id);
    if (closing) {
      // Re-close: ask for confirmation first
      setReCloseTarget(person);
    } else {
      doClose(person);
    }
  };

  const handleReCloseConfirm = () => {
    if (reCloseTarget) {
      doClose(reCloseTarget);
    }
    setReCloseTarget(null);
  };

  // Billing currency helpers
  const getBillingCurrency = (person: any): string => person.billingCurrency ?? "ARS";
  const getUsdFraction = (person: any): number => person.usdBillingFraction ?? 0;

  // Cost display: returns {primary, secondary} based on billing modality
  const getCostDisplay = (person: any) => {
    const hrs = effectiveBaseHours(person);
    const { rate, rateUSD } = getEffectiveRate(person);
    const billing = getBillingCurrency(person);

    if (billing === "USD") {
      const costUSD = hrs * rateUSD;
      const costARS = costUSD * exchangeRate;
      return {
        primary: `USD ${costUSD.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        secondary: `≈ ARS ${costARS.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      };
    }

    if (billing === "mixed") {
      const usdFraction = getUsdFraction(person);
      // rate = ARS component rate, rateUSD = USD component rate
      const costUSD = hrs * rateUSD * usdFraction;
      const costARS = hrs * rate * (1 - usdFraction);
      return {
        primary: `USD ${costUSD.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        secondary: `+ ARS ${costARS.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      };
    }

    // ARS
    const costARS = hrs * rate;
    return {
      primary: `ARS ${costARS.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      secondary: null,
    };
  };

  const getRateDisplay = (person: any): { text: string; isEstimated: boolean } => {
    const billing = getBillingCurrency(person);
    const { rate, rateUSD, isEstimated } = getEffectiveRate(person);
    let text: string;
    if (billing === "USD") text = `USD ${rateUSD.toLocaleString("en-US")}/hr`;
    else if (billing === "mixed") {
      const usdFraction = getUsdFraction(person);
      text = `USD ${rateUSD.toLocaleString("en-US")} (${Math.round(usdFraction * 100)}%) + ARS ${rate.toLocaleString("es-AR")} (${Math.round((1 - usdFraction) * 100)}%)`;
    }
    else text = `ARS ${rate.toLocaleString("es-AR")}/hr`;
    return { text, isEstimated };
  };

  // Filter personnel
  const filteredPersonnel = (personnel || []).filter((p: any) => {
    if (contractFilter === "all") return true;
    const type = (p.contractType || "full-time").toLowerCase();
    return type === contractFilter;
  });

  // Unsaved changes: any entry in hoursOverrides with a non-empty value
  const hasUnsavedChanges = Object.keys(hoursOverrides).length > 0;

  // Loading state
  const isLoading = personnelLoading || closingsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <Loader2 className="animate-spin h-8 w-8" />
        <span className="text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Re-close confirmation dialog */}
      <AlertDialog open={reCloseTarget !== null} onOpenChange={(open) => { if (!open) setReCloseTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Re-cerrar el mes?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Re-cerrar el mes de <strong>{reCloseTarget?.name}</strong>? Esto sobreescribirá el cierre anterior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReCloseConfirm}>Re-cerrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved changes banner */}
      {hasUnsavedChanges && (
        <div className="rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Tenés cambios manuales sin aplicar al cierre. Acordate de usar estos valores al cerrar.
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cierre Mensual de Horas</h1>
          <p className="text-muted-foreground">
            Reconciliación: ajustar horas reales a horas contractuales para facturación.{" "}
            <Link href="/operations/estimated-rates" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
              Gestionar tarifas proyectadas <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={contractFilter} onValueChange={setContractFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo de contrato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los contratos</SelectItem>
              <SelectItem value="full-time">Full-time</SelectItem>
              <SelectItem value="part-time">Part-time</SelectItem>
              <SelectItem value="freelance">Freelance (por hora)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value) || now.getFullYear())}
            className="w-24"
            min={2020}
            max={2030}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Cierre {MONTHS[month]} {year}
            {contractFilter !== "all" && (
              <Badge variant="outline" className="ml-2 capitalize">{contractFilter}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredPersonnel.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No hay personal para el filtro seleccionado
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Persona</th>
                  <th className="text-center py-2 px-3">Contrato</th>
                  <th className="text-center py-2 px-3">Facturación</th>
                  <th className="text-center py-2 px-3">Hs Base</th>
                  <th className="text-center py-2 px-3">Valor Hora</th>
                  <th className="text-center py-2 px-3">Costo Final</th>
                  <th className="text-center py-2 px-3">Estado</th>
                  <th className="text-center py-2 px-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredPersonnel.map((p: any) => {
                  const closing = getClosing(p.id);
                  const baseHrs = effectiveBaseHours(p);
                  const hasOverride = hoursOverrides[p.id] !== undefined && hoursOverrides[p.id] !== "";
                  const cost = getCostDisplay(p);
                  const billing = getBillingCurrency(p);
                  const isRowPending = closingPersonnelId === p.id && closeMutation.isPending;
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{p.name}</td>
                      <td className="text-center py-2 px-3 capitalize">
                        {p.contractType || "full-time"}
                      </td>
                      <td className="text-center py-2 px-3">
                        <Badge
                          variant="outline"
                          title={billing === "mixed" ? "Facturación Mixta" : `Facturación en ${billing}`}
                          className={
                            billing === "USD"
                              ? "border-green-400 text-green-700"
                              : billing === "mixed"
                              ? "border-amber-400 text-amber-700"
                              : "border-blue-400 text-blue-700"
                          }
                        >
                          {billing === "mixed" ? "Mixto" : billing}
                        </Badge>
                      </td>
                      <td className="text-center py-2 px-3">
                        {editingHours === p.id ? (
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              type="number"
                              value={editingInput}
                              onChange={(e) => setEditingInput(e.target.value)}
                              className="w-20 h-7 text-sm text-center"
                              min={0}
                              step={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleConfirmHours(p.id);
                                if (e.key === "Escape") handleCancelEditHours();
                              }}
                              autoFocus
                            />
                            <span className="text-xs text-muted-foreground">h</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleConfirmHours(p.id)}
                              className="h-6 w-6 p-0 text-green-600"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEditHours}
                              className="h-6 w-6 p-0 text-gray-500"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-center group">
                            <span className={hasOverride ? "font-semibold text-amber-700" : ""}>
                              {baseHrs}h
                            </span>
                            {hasOverride && (
                              <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 px-1 py-0">
                                Manual
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEditHours(p)}
                              className="h-5 w-5 p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {hasOverride && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleResetHours(p.id)}
                                className="h-5 w-5 p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                                title="Restaurar horas base"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-center py-2 px-3">
                        {(() => {
                          const { text, isEstimated } = getRateDisplay(p);
                          return (
                            <span className={isEstimated ? "text-blue-600" : ""} title={isEstimated ? "Tarifa proyectada del mes" : "Tarifa base de personal"}>
                              {text}{isEstimated && " *"}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="text-center py-2 px-3 font-semibold">
                        <div>{cost.primary}</div>
                        {cost.secondary && (
                          <div className="text-xs text-muted-foreground font-normal">{cost.secondary}</div>
                        )}
                      </td>
                      <td className="text-center py-2 px-3">
                        {closing ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-green-600 flex items-center gap-1 text-xs font-medium">
                              <Check className="h-3.5 w-3.5" /> Cerrado
                            </span>
                            {closing.closedAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(closing.closedAt), "d MMM, HH:mm", { locale: es })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-600">Pendiente</span>
                        )}
                      </td>
                      <td className="text-center py-2 px-3">
                        <Button
                          size="sm"
                          variant={closing ? "outline" : "default"}
                          onClick={() => handleClose(p)}
                          disabled={isRowPending}
                        >
                          {isRowPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : closing ? (
                            "Re-cerrar"
                          ) : (
                            "Cerrar"
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {estimatedRates.some((r: any) => r.month === month + 1) && (
            <p className="text-xs text-muted-foreground mt-2">
              * Tarifa proyectada para {MONTHS[month]} {year} (configurada en{" "}
              <Link href="/operations/estimated-rates" className="text-primary hover:underline">Valor Hora Estimada</Link>
              ). Los valores sin * usan la tarifa base del personal.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
