import { Fragment, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Personnel, PersonnelHistoricalCost } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface HistoricalCostsTableProps {
  personnel: Personnel[];
}

type EditableField = "hourlyRateARS" | "monthlySalaryARS" | "hourlyRateUSD" | "monthlySalaryUSD";

const MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function HistoricalCostsTable({ personnel }: HistoricalCostsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [editingCells, setEditingCells] = useState<Record<string, string>>({});

  const { data: historicalCosts = [] } = useQuery<PersonnelHistoricalCost[]>({
    queryKey: ["/api/personnel-historical-costs"],
  });

  const availableYears = useMemo(() => Array.from(new Set([
    2025,
    currentYear - 1,
    currentYear,
    currentYear + 1,
    ...historicalCosts.map((cost) => cost.year),
  ])).sort((left, right) => right - left), [currentYear, historicalCosts]);

  const costByPersonAndMonth = useMemo(() => new Map(
    historicalCosts
      .filter((cost) => cost.year === selectedYear)
      .map((cost) => [`${cost.personnelId}-${cost.month}`, cost]),
  ), [historicalCosts, selectedYear]);

  const updateCostMutation = useMutation({
    mutationFn: async (data: {
      personnelId: number;
      year: number;
      month: number;
      field: EditableField;
      value: number | null;
    }) => {
      const existing = historicalCosts.find((cost) =>
        cost.personnelId === data.personnelId &&
        cost.month === data.month &&
        cost.year === data.year,
      );
      if (!existing && data.value == null) return null;

      const monthlyHours = personnel.find((person) => person.id === data.personnelId)?.monthlyHours ?? null;
      const payload = { [data.field]: data.value, monthlyHours };
      return existing
        ? apiRequest(`/api/personnel-historical-costs/${existing.id}`, { method: "PATCH", body: payload })
        : apiRequest("/api/personnel-historical-costs", {
            method: "POST",
            body: {
              personnelId: data.personnelId,
              year: data.year,
              month: data.month,
              ...payload,
            },
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personnel-historical-costs"] });
      toast({
        title: "Costos actualizados",
        description: `La grilla de ${selectedYear} se guardó correctamente.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron guardar los costos históricos.",
        variant: "destructive",
      });
    },
  });

  const cellKey = (personnelId: number, month: number, field: EditableField) =>
    `${personnelId}-${selectedYear}-${month}-${field}`;

  const getCellValue = (personnelId: number, month: number, field: EditableField) => {
    const key = cellKey(personnelId, month, field);
    if (key in editingCells) return editingCells[key];
    const value = costByPersonAndMonth.get(`${personnelId}-${month}`)?.[field];
    return value == null ? "" : String(value);
  };

  const handleCellChange = (personnelId: number, month: number, field: EditableField, value: string) => {
    setEditingCells((current) => ({ ...current, [cellKey(personnelId, month, field)]: value }));
  };

  const handleCellBlur = (personnelId: number, month: number, field: EditableField) => {
    const key = cellKey(personnelId, month, field);
    if (!(key in editingCells)) return;
    const rawValue = editingCells[key];
    const value = rawValue === "" ? null : Number(rawValue);
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      toast({
        title: "Valor inválido",
        description: "Ingresá un número mayor o igual a cero.",
        variant: "destructive",
      });
      return;
    }
    updateCostMutation.mutate({ personnelId, year: selectedYear, month, field, value });
    setEditingCells((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  if (personnel.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-gray-500">Añadí personal primero para configurar costos mensuales.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-900">Costos mensuales - {selectedYear}</h3>
            <p className="text-xs text-gray-500">{personnel.length} personas · moneda contractual por persona · guardado al salir de la celda</p>
          </div>
          <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
            <SelectTrigger className="w-36 bg-white" aria-label="Año de costos mensuales">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[32rem] overflow-auto">
          <table className="min-w-[1520px] text-xs">
            <thead className="sticky top-0 z-20 bg-gray-100">
              <tr>
                <th className="sticky left-0 z-30 min-w-52 border-r bg-gray-100 px-3 py-2 text-left font-medium text-gray-700">Personal</th>
                <th className="w-20 border-r px-2 py-2 text-center font-medium text-gray-700">Tipo</th>
                {MONTHS.map((month, index) => (
                  <th key={month} className="min-w-24 border-r px-2 py-2 text-center font-medium text-gray-700">{month} {selectedYear}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {personnel.map((person) => {
                const usesUSD = (person as any).billingCurrency === "USD";
                const hourlyField: EditableField = usesUSD ? "hourlyRateUSD" : "hourlyRateARS";
                const salaryField: EditableField = usesUSD ? "monthlySalaryUSD" : "monthlySalaryARS";
                const currency = usesUSD ? "USD" : "ARS";
                return (
                <Fragment key={person.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 border-r bg-white px-3 py-2">
                      <p className="text-sm font-medium text-gray-900">{person.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {((person as any).contractType === "freelance" ? (person as any).legacyRole : (person as any).currentRole)
                          || (person as any).roleName
                          || "Rol pendiente"}
                        {(person as any).sublevel ? ` · ${(person as any).sublevel}` : ""}
                      </p>
                    </td>
                    <td className="border-r px-2 py-1 text-center text-gray-600">{currency}/h</td>
                    {MONTHS.map((_, index) => {
                      const month = index + 1;
                      const key = cellKey(person.id, month, hourlyField);
                      return (
                        <td key={key} className="border-r px-1 py-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={getCellValue(person.id, month, hourlyField)}
                            onChange={(event) => handleCellChange(person.id, month, hourlyField, event.target.value)}
                            onBlur={() => handleCellBlur(person.id, month, hourlyField)}
                            className="h-8 border-0 text-center text-xs hover:bg-gray-50 focus:border focus:border-primary"
                            placeholder="-"
                          />
                        </td>
                      );
                    })}
                  </tr>
                  {person.contractType !== "freelance" && (
                    <tr className="border-b-2 border-gray-200 hover:bg-gray-50">
                      <td className="sticky left-0 z-10 border-r bg-white px-3 py-2 text-[11px] text-gray-500">Sueldo mensual</td>
                      <td className="border-r px-2 py-1 text-center text-gray-600">{currency}/mes</td>
                      {MONTHS.map((_, index) => {
                        const month = index + 1;
                        const key = cellKey(person.id, month, salaryField);
                        return (
                          <td key={key} className="border-r px-1 py-1.5">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getCellValue(person.id, month, salaryField)}
                              onChange={(event) => handleCellChange(person.id, month, salaryField, event.target.value)}
                              onBlur={() => handleCellBlur(person.id, month, salaryField)}
                              className="h-8 border-0 text-center text-xs hover:bg-gray-50 focus:border focus:border-primary"
                              placeholder="-"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        La misma grilla permite consultar y editar años pasados, el año actual y períodos futuros. La tarifa vigente se resuelve desde este historial para cotizaciones, capacidad y cierre mensual.
      </div>
    </div>
  );
}
