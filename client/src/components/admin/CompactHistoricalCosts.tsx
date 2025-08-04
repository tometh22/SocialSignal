import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Personnel } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CompactHistoricalCostsProps {
  personnel: Personnel[];
}

export function CompactHistoricalCosts({ personnel }: CompactHistoricalCostsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedPersonnel, setExpandedPersonnel] = useState<Set<number>>(new Set());
  const [editingCells, setEditingCells] = useState<Record<string, string>>({});

  if (personnel.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 text-center">
        <p className="text-gray-500 text-sm">
          Añada personal primero para configurar costos históricos mensuales.
        </p>
      </div>
    );
  }

  const months = [
    { key: "jan2025", label: "Ene" }, { key: "feb2025", label: "Feb" },
    { key: "mar2025", label: "Mar" }, { key: "apr2025", label: "Abr" },
    { key: "may2025", label: "May" }, { key: "jun2025", label: "Jun" },
    { key: "jul2025", label: "Jul" }, { key: "aug2025", label: "Ago" },
    { key: "sep2025", label: "Sep" }, { key: "oct2025", label: "Oct" },
    { key: "nov2025", label: "Nov" }, { key: "dec2025", label: "Dic" },
  ];

  const updateCostMutation = useMutation({
    mutationFn: async (data: { 
      personnelId: number; 
      updates: Record<string, number | null> 
    }) => {
      return apiRequest(`/api/personnel/${data.personnelId}`, {
        method: "PATCH",
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      toast({
        title: "Costos actualizados",
        description: "Los costos históricos se han guardado correctamente.",
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

  const togglePersonnel = (personnelId: number) => {
    const newExpanded = new Set(expandedPersonnel);
    if (newExpanded.has(personnelId)) {
      newExpanded.delete(personnelId);
    } else {
      newExpanded.add(personnelId);
    }
    setExpandedPersonnel(newExpanded);
  };

  const getCellValue = (person: any, field: string): string => {
    const value = person[field];
    return value !== undefined && value !== null ? value.toString() : "";
  };

  const handleCellChange = (personnelId: number, field: string, value: string) => {
    const cellKey = `${personnelId}-${field}`;
    setEditingCells(prev => ({ ...prev, [cellKey]: value }));
  };

  const handleCellBlur = (personnelId: number, field: string) => {
    const cellKey = `${personnelId}-${field}`;
    const value = editingCells[cellKey];
    
    if (value !== undefined) {
      const numericValue = value === "" ? null : parseFloat(value);
      
      if (numericValue !== null && !isNaN(numericValue)) {
        updateCostMutation.mutate({
          personnelId,
          updates: { [field]: numericValue }
        });
      }
      
      // Remove from editing state
      setEditingCells(prev => {
        const newState = { ...prev };
        delete newState[cellKey];
        return newState;
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-3 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Costos Históricos 2025 ({personnel.length} personas)
            </h3>
            <div className="text-xs text-gray-500">
              Expandir para editar • Valores en ARS
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {personnel.map((person) => (
            <div key={person.id} className="p-3">
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
                onClick={() => togglePersonnel(person.id)}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{person.name}</span>
                  <span className="text-xs text-gray-500">
                    Tarifa actual: ${person.hourlyRate}/hr
                  </span>
                </div>
                {expandedPersonnel.has(person.id) ? 
                  <ChevronUp className="h-4 w-4 text-gray-400" /> : 
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                }
              </div>

              {expandedPersonnel.has(person.id) && (
                <div className="mt-3 space-y-2">
                  {/* Tarifa por hora */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Tarifa por Hora (ARS)</h4>
                    <div className="grid grid-cols-6 gap-2">
                      {months.map((month) => {
                        const field = `${month.key}HourlyRateARS`;
                        const cellKey = `${person.id}-${field}`;
                        
                        return (
                          <div key={field} className="space-y-1">
                            <label className="text-xs text-gray-500">{month.label}</label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getCellValue(person, field)}
                              onChange={(e) => handleCellChange(person.id, field, e.target.value)}
                              onBlur={() => handleCellBlur(person.id, field)}
                              className="text-center text-xs h-8"
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Salario mensual */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Salario Mensual (ARS)</h4>
                    <div className="grid grid-cols-6 gap-2">
                      {months.map((month) => {
                        const field = `${month.key}MonthlySalaryARS`;
                        
                        return (
                          <div key={field} className="space-y-1">
                            <label className="text-xs text-gray-500">{month.label}</label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={getCellValue(person, field)}
                              onChange={(e) => handleCellChange(person.id, field, e.target.value)}
                              onBlur={() => handleCellBlur(person.id, field)}
                              className="text-center text-xs h-8"
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-xs text-blue-700">
          <strong>¿Cómo funciona?</strong>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li><strong>Tabla superior:</strong> Datos actuales para nuevas cotizaciones</li>
            <li><strong>Esta sección:</strong> Costos históricos para análisis de rentabilidad</li>
            <li>Los datos se guardan automáticamente al cambiar de campo</li>
          </ul>
        </div>
      </div>
    </div>
  );
}