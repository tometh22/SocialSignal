import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/hooks/use-currency";
import { Loader2, Check, Pencil, X } from "lucide-react";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Default contractual base hours by contract type
function defaultBaseHours(person: any): number {
  const type = (person.contractType || "full-time").toLowerCase();
  if (type === "part-time") return 120;
  if (type === "freelance") return person.monthlyHours || 0;
  return 160; // full-time
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

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { exchangeRate } = useCurrency();

  const { data: personnel } = useQuery<any[]>({ queryKey: ["/api/personnel"] });
  const { data: closings } = useQuery<any[]>({
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
  });

  const getClosing = (personnelId: number) =>
    closings?.find((c: any) => c.personnelId === personnelId);

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

  const handleClose = (person: any) => {
    const hrs = effectiveBaseHours(person);
    const rate = person.hourlyRate || 0;
    const existing = getClosing(person.id);
    closeMutation.mutate({
      personnelId: person.id,
      year,
      month: month + 1,
      actualHours: existing?.actualHours || hrs,
      adjustedHours: hrs,
      hourlyRate: rate,
      totalCost: hrs * rate,
    });
  };

  // Billing currency helpers
  const getBillingCurrency = (person: any): string => person.billingCurrency ?? "ARS";
  const getUsdFraction = (person: any): number => person.usdBillingFraction ?? 0;

  // Cost display: returns {arsText, usdText} based on billing modality
  const getCostDisplay = (person: any) => {
    const hrs = effectiveBaseHours(person);
    const rate = person.hourlyRate || 0; // ARS or USD depending on billingCurrency
    const billing = getBillingCurrency(person);

    if (billing === "USD") {
      const costUSD = hrs * rate;
      const costARS = costUSD * exchangeRate;
      return {
        primary: `USD ${costUSD.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        secondary: `≈ ARS ${costARS.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      };
    }

    if (billing === "mixed") {
      const usdFraction = getUsdFraction(person);
      const costTotal = hrs * rate;
      const costUSD = costTotal * usdFraction;
      const costARS = costTotal * (1 - usdFraction);
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

  const getRateDisplay = (person: any): string => {
    const billing = getBillingCurrency(person);
    const rate = person.hourlyRate || 0;
    if (billing === "USD") return `USD ${rate.toLocaleString("en-US")}`;
    if (billing === "mixed") return `USD ${rate.toLocaleString("en-US")} (mixto)`;
    return `ARS ${rate.toLocaleString("es-AR")}`;
  };

  // Filter personnel
  const filteredPersonnel = (personnel || []).filter((p: any) => {
    if (contractFilter === "all") return true;
    const type = (p.contractType || "full-time").toLowerCase();
    return type === contractFilter;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cierre Mensual de Horas</h1>
          <p className="text-muted-foreground">
            Reconciliación: ajustar horas reales a horas contractuales para facturación
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={contractFilter} onValueChange={setContractFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo de contrato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los contratos</SelectItem>
              <SelectItem value="full-time">Full-time (160h)</SelectItem>
              <SelectItem value="part-time">Part-time (120h)</SelectItem>
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
              {filteredPersonnel.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-muted-foreground">
                    No hay personal para el filtro seleccionado.
                  </td>
                </tr>
              )}
              {filteredPersonnel.map((p: any) => {
                const closing = getClosing(p.id);
                const baseHrs = effectiveBaseHours(p);
                const hasOverride = hoursOverrides[p.id] !== undefined && hoursOverrides[p.id] !== "";
                const cost = getCostDisplay(p);
                const billing = getBillingCurrency(p);
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{p.name}</td>
                    <td className="text-center py-2 px-3 capitalize">
                      {p.contractType || "full-time"}
                    </td>
                    <td className="text-center py-2 px-3">
                      <Badge
                        variant="outline"
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
                    <td className="text-center py-2 px-3">{getRateDisplay(p)}</td>
                    <td className="text-center py-2 px-3 font-semibold">
                      <div>{cost.primary}</div>
                      {cost.secondary && (
                        <div className="text-xs text-muted-foreground font-normal">{cost.secondary}</div>
                      )}
                    </td>
                    <td className="text-center py-2 px-3">
                      {closing ? (
                        <span className="text-green-600 flex items-center justify-center gap-1">
                          <Check className="h-4 w-4" /> Cerrado
                        </span>
                      ) : (
                        <span className="text-amber-600">Pendiente</span>
                      )}
                    </td>
                    <td className="text-center py-2 px-3">
                      <Button
                        size="sm"
                        variant={closing ? "outline" : "default"}
                        onClick={() => handleClose(p)}
                        disabled={closeMutation.isPending}
                      >
                        {closeMutation.isPending ? (
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
        </CardContent>
      </Card>
    </div>
  );
}
