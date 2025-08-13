import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Personnel } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface HistoricalCostsTableProps {
  personnel: Personnel[];
}

export function HistoricalCostsTable({ personnel }: HistoricalCostsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingCells, setEditingCells] = useState<Record<string, string>>({});

  console.log("HistoricalCostsTable rendering with personnel:", personnel?.length || 0);

  // Fetch historical costs from normalized table
  const { data: historicalCosts = [] } = useQuery<PersonnelHistoricalCost[]>({
    queryKey: ["/api/personnel-historical-costs"],
  });

  const months = [
    { key: 1, label: "Ene 2025" },
    { key: 2, label: "Feb 2025" },
    { key: 3, label: "Mar 2025" },
    { key: 4, label: "Abr 2025" },
    { key: 5, label: "May 2025" },
    { key: 6, label: "Jun 2025" },
    { key: 7, label: "Jul 2025" },
    { key: 8, label: "Ago 2025" },
    { key: 9, label: "Sep 2025" },
    { key: 10, label: "Oct 2025" },
    { key: 11, label: "Nov 2025" },
    { key: 12, label: "Dic 2025" },
  ];

  // Helper function to get historical cost for a person/month
  const getHistoricalCost = (personnelId: number, month: number, type: 'hourlyRate' | 'monthlySalary') => {
    const cost = historicalCosts.find(c => c.personnelId === personnelId && c.month === month && c.year === 2025);
    if (!cost) return null;
    return type === 'hourlyRate' ? cost.hourlyRateARS : cost.monthlySalaryARS;
  };

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
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudieron guardar los costos históricos.",
        variant: "destructive",
      });
    },
  });

  const handleCellChange = (personnelId: number, field: string, value: string) => {
    const cellKey = `${personnelId}-${field}`;
    setEditingCells({ ...editingCells, [cellKey]: value });
  };

  const handleCellBlur = (personnelId: number, field: string) => {
    const cellKey = `${personnelId}-${field}`;
    const value = editingCells[cellKey];
    
    if (value !== undefined) {
      const numericValue = value === "" ? null : parseFloat(value);
      if (value !== "" && (isNaN(numericValue!) || numericValue! < 0)) {
        toast({
          title: "Valor inválido",
          description: "Por favor ingrese un número válido mayor o igual a 0.",
          variant: "destructive",
        });
        return;
      }

      updateCostMutation.mutate({
        personnelId,
        updates: { [field]: numericValue }
      });
    }

    // Remove from editing state
    const newEditingCells = { ...editingCells };
    delete newEditingCells[cellKey];
    setEditingCells(newEditingCells);
  };

  const getCellValue = (person: Personnel, field: string) => {
    const cellKey = `${person.id}-${field}`;
    if (cellKey in editingCells) {
      return editingCells[cellKey];
    }
    const value = (person as any)[field];
    // Corrección crítica: mostrar valores numéricos reales, incluso 0
    // Solo mostrar cadena vacía para null o undefined
    return (value !== null && value !== undefined) ? value.toString() : "";
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (personnel.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
        <p className="text-gray-500">
          Añada personal primero para configurar costos históricos mensuales.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium text-gray-900">
              Año 2025 - {personnel.length} personas
            </h3>
            <div className="text-xs text-gray-500">
              Clic para editar • Valores en ARS
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto border rounded">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sticky left-0 bg-gray-100 border-r">
                  Personal
                </th>
                <th className="px-2 py-2 text-center font-medium text-gray-700 border-r w-16">
                  Tipo
                </th>
                {months.map((month) => (
                  <th key={month.key} className="px-2 py-2 text-center font-medium text-gray-700 border-r w-20">
                    {month.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {personnel.map((person) => (
                <>
                  {/* Fila de tarifa por hora */}
                  <tr key={`${person.id}-hourly`} className="hover:bg-gray-50">
                    <td className="px-3 py-1 text-sm font-medium text-gray-900 sticky left-0 bg-white border-r">
                      <div className="flex items-center gap-2">
                        <span>{person.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          person.contractType === 'full-time' ? 'bg-blue-100 text-blue-800' :
                          person.contractType === 'part-time' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {person.contractType === 'full-time' ? 'Full-time' : 
                           person.contractType === 'part-time' ? 'Part-time' : 
                           'Freelance'}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-600 text-center border-r">
                      $/hr
                    </td>
                    {months.map((month) => {
                      const field = `${month.key}HourlyRateARS`;
                      const cellKey = `${person.id}-${field}`;
                      const isEditing = cellKey in editingCells;
                      
                      return (
                        <td key={field} className="px-1 py-2 border-r">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={getCellValue(person, field)}
                            onChange={(e) => handleCellChange(person.id, field, e.target.value)}
                            onBlur={() => handleCellBlur(person.id, field)}
                            className={`text-center text-xs h-8 border-0 focus:border focus:border-blue-500 ${
                              isEditing ? "bg-blue-50" : "hover:bg-gray-50"
                            }`}
                            placeholder="0"
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Fila de salario mensual - solo para empleados full-time */}
                  {person.contractType === 'full-time' && (
                    <tr key={`${person.id}-monthly`} className="hover:bg-gray-50 border-b-2 border-gray-200">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 sticky left-0 bg-white border-r">
                        <span className="ml-4 text-xs">Salario Mensual (solo full-time)</span>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-600 text-center border-r">
                        $/mes
                      </td>
                      {months.map((month) => {
                        const field = `${month.key}MonthlySalaryARS`;
                        const cellKey = `${person.id}-${field}`;
                        const isEditing = cellKey in editingCells;
                        
                        return (
                          <td key={field} className="px-1 py-2 border-r">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getCellValue(person, field)}
                              onChange={(e) => handleCellChange(person.id, field, e.target.value)}
                              onBlur={() => handleCellBlur(person.id, field)}
                              className={`text-center text-xs h-8 border-0 focus:border focus:border-blue-500 ${
                                isEditing ? "bg-blue-50" : "hover:bg-gray-50"
                              }`}
                              placeholder="0"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {personnel.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay personal registrado.
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800">
              Información sobre costos históricos
            </h4>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Los costos se guardan automáticamente al salir de cada celda</li>
                <li>Todos los valores deben estar en pesos argentinos (ARS)</li>
                <li>Puede dejar celdas vacías para meses sin datos</li>
                <li>Los costos históricos se usan para análisis de rentabilidad temporal</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}