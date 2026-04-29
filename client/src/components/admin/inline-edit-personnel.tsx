import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Edit, Check, X, Loader2, Trash2, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface InlineEditPersonnelProps {
  person: {
    id: number;
    name: string;
    email: string;
    roleId: number;
    roleName: string;
    hourlyRate: number;
    contractType?: string;
    monthlyFixedSalary?: number;
    includeInRealCosts?: boolean;
    monthlyHours?: number;
    // Historical contract types
    jan2025ContractType?: string;
    feb2025ContractType?: string;
    mar2025ContractType?: string;
    apr2025ContractType?: string;
    may2025ContractType?: string;
    jun2025ContractType?: string;
    jul2025ContractType?: string;
    aug2025ContractType?: string;
    sep2025ContractType?: string;
    oct2025ContractType?: string;
    nov2025ContractType?: string;
    dec2025ContractType?: string;
    // Historical costs fields
    jan2025HourlyRateARS?: number;
    feb2025HourlyRateARS?: number;
    mar2025HourlyRateARS?: number;
    apr2025HourlyRateARS?: number;
    may2025HourlyRateARS?: number;
    jun2025HourlyRateARS?: number;
    jul2025HourlyRateARS?: number;
    aug2025HourlyRateARS?: number;
    sep2025HourlyRateARS?: number;
    oct2025HourlyRateARS?: number;
    nov2025HourlyRateARS?: number;
    dec2025HourlyRateARS?: number;
    jan2025MonthlySalaryARS?: number;
    feb2025MonthlySalaryARS?: number;
    mar2025MonthlySalaryARS?: number;
    apr2025MonthlySalaryARS?: number;
    may2025MonthlySalaryARS?: number;
    jun2025MonthlySalaryARS?: number;
    jul2025MonthlySalaryARS?: number;
    aug2025MonthlySalaryARS?: number;
    sep2025MonthlySalaryARS?: number;
    oct2025MonthlySalaryARS?: number;
    nov2025MonthlySalaryARS?: number;
    dec2025MonthlySalaryARS?: number;
    // Historical contract types 2026
    jan2026ContractType?: string;
    feb2026ContractType?: string;
    mar2026ContractType?: string;
    apr2026ContractType?: string;
    may2026ContractType?: string;
    jun2026ContractType?: string;
    jul2026ContractType?: string;
    aug2026ContractType?: string;
    sep2026ContractType?: string;
    oct2026ContractType?: string;
    nov2026ContractType?: string;
    dec2026ContractType?: string;
    // Historical hourly rates 2026
    jan2026HourlyRateARS?: number;
    feb2026HourlyRateARS?: number;
    mar2026HourlyRateARS?: number;
    apr2026HourlyRateARS?: number;
    may2026HourlyRateARS?: number;
    jun2026HourlyRateARS?: number;
    jul2026HourlyRateARS?: number;
    aug2026HourlyRateARS?: number;
    sep2026HourlyRateARS?: number;
    oct2026HourlyRateARS?: number;
    nov2026HourlyRateARS?: number;
    dec2026HourlyRateARS?: number;
    // Historical monthly salaries 2026
    jan2026MonthlySalaryARS?: number;
    feb2026MonthlySalaryARS?: number;
    mar2026MonthlySalaryARS?: number;
    apr2026MonthlySalaryARS?: number;
    may2026MonthlySalaryARS?: number;
    jun2026MonthlySalaryARS?: number;
    jul2026MonthlySalaryARS?: number;
    aug2026MonthlySalaryARS?: number;
    sep2026MonthlySalaryARS?: number;
    oct2026MonthlySalaryARS?: number;
    nov2026MonthlySalaryARS?: number;
    dec2026MonthlySalaryARS?: number;
  };
  roles: any[];
}

// Order: newest → oldest. Used for "find latest historical value" lookups
// and for "future month" detection in the costs grid.
const HISTORICAL_MONTHS_DESC = [
  'dec2026', 'nov2026', 'oct2026', 'sep2026', 'aug2026', 'jul2026',
  'jun2026', 'may2026', 'apr2026', 'mar2026', 'feb2026', 'jan2026',
  'dec2025', 'nov2025', 'oct2025', 'sep2025', 'aug2025', 'jul2025',
  'jun2025', 'may2025', 'apr2025', 'mar2025', 'feb2025', 'jan2025',
];

export default function InlineEditPersonnel({ person, roles }: InlineEditPersonnelProps) {
  // DEBUG: Log person data on every render
  console.log(`🔍 [${person.name}] RENDER - monthlyHours from props:`, person.monthlyHours, `(type: ${typeof person.monthlyHours})`);
  console.log(`🔍 [${person.name}] FULL PERSON DATA:`, person);
  
  // Función para obtener el color del rol basado en el nombre
  const getRoleColor = (roleName: string) => {
    const roleColorMap: Record<string, string> = {
      'CEO': 'bg-purple-100 text-purple-800',
      'COO': 'bg-indigo-100 text-indigo-800',
      'Operations Lead': 'bg-blue-100 text-blue-800',
      'Analista Semi Senior': 'bg-teal-100 text-teal-800',
      'Analista Senior': 'bg-cyan-100 text-cyan-800',
      'Data Senior': 'bg-emerald-100 text-emerald-800',
      'Lead Project Manager': 'bg-green-100 text-green-800',
      'Graficador/a': 'bg-lime-100 text-lime-800',
      'Project Manager': 'bg-yellow-100 text-yellow-800',
      'Analista Junior': 'bg-orange-100 text-orange-800',
      'Analista Junior Member': 'bg-red-100 text-red-800',
    };
    
    return roleColorMap[roleName] || 'bg-gray-100 text-gray-800';
  };
  
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showHistoricalCosts, setShowHistoricalCosts] = useState(false);
  const [editedName, setEditedName] = useState(person.name);
  const [editedEmail, setEditedEmail] = useState(person.email);
  const [editedRoleId, setEditedRoleId] = useState(person.roleId.toString());
  const getInitialHourlyRate = () => {
    for (const month of HISTORICAL_MONTHS_DESC) {
      const value = (person as any)[`${month}HourlyRateARS`];
      if (value && value > 0) return value.toString();
    }
    return person.hourlyRate.toString();
  };
  const getInitialSalary = () => {
    for (const month of HISTORICAL_MONTHS_DESC) {
      const value = (person as any)[`${month}MonthlySalaryARS`];
      if (value && value > 0) return value.toString();
    }
    return person.monthlyFixedSalary?.toString() || '';
  };
  const [editedHourlyRate, setEditedHourlyRate] = useState(getInitialHourlyRate());
  const [editedContractType, setEditedContractType] = useState(person.contractType || 'full-time');
  const [editedMonthlyFixedSalary, setEditedMonthlyFixedSalary] = useState(getInitialSalary());
  const [editedIncludeInRealCosts, setEditedIncludeInRealCosts] = useState(person.includeInRealCosts ?? true);
  const [editedMonthlyHours, setEditedMonthlyHours] = useState(person.monthlyHours?.toString() || '');
  const [editingCells, setEditingCells] = useState<Record<string, string>>({});
  const [savingFields, setSavingFields] = useState<Record<string, boolean>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setEditedName(person.name);
    setEditedEmail(person.email);
    setEditedRoleId(person.roleId.toString());
    setEditedHourlyRate(getInitialHourlyRate());
    setEditedContractType(person.contractType || 'full-time');
    setEditedMonthlyFixedSalary(getInitialSalary());
    setEditedIncludeInRealCosts(person.includeInRealCosts ?? true);
    setEditedMonthlyHours(person.monthlyHours?.toString() || '0');
  }, [person.id, person.name, person.email, person.roleId, person.hourlyRate, person.contractType, person.monthlyFixedSalary, person.includeInRealCosts, person.monthlyHours]);

  // Función para obtener el último sueldo histórico
  const getLatestHistoricalSalary = (): number | null => {
    for (const month of HISTORICAL_MONTHS_DESC) {
      const value = (person as any)[`${month}MonthlySalaryARS`];
      if (value && value > 0) return value;
    }
    return null;
  };

  // Función para obtener la última tarifa por hora histórica
  const getLatestHistoricalHourlyRate = (): number | null => {
    for (const month of HISTORICAL_MONTHS_DESC) {
      const value = (person as any)[`${month}HourlyRateARS`];
      if (value && value > 0) return value;
    }
    return null;
  };

  // Función para actualizar el sueldo fijo con el último valor histórico
  const updateSalaryFromHistorical = () => {
    const latestSalary = getLatestHistoricalSalary();
    if (latestSalary) {
      setEditedMonthlyFixedSalary(latestSalary.toString());
      toast({
        title: "Sueldo actualizado",
        description: `Sueldo fijo actualizado a $${latestSalary.toLocaleString()} ARS (último valor histórico)`,
      });
    } else {
      toast({
        title: "Sin datos históricos",
        description: "No se encontraron datos históricos de sueldo para esta persona",
        variant: "destructive"
      });
    }
  };

  const months: { key: string; label: string; year: number }[] = [
    { key: "jan2025", label: "Ene", year: 2025 }, { key: "feb2025", label: "Feb", year: 2025 },
    { key: "mar2025", label: "Mar", year: 2025 }, { key: "apr2025", label: "Abr", year: 2025 },
    { key: "may2025", label: "May", year: 2025 }, { key: "jun2025", label: "Jun", year: 2025 },
    { key: "jul2025", label: "Jul", year: 2025 }, { key: "aug2025", label: "Ago", year: 2025 },
    { key: "sep2025", label: "Sep", year: 2025 }, { key: "oct2025", label: "Oct", year: 2025 },
    { key: "nov2025", label: "Nov", year: 2025 }, { key: "dec2025", label: "Dic", year: 2025 },
    { key: "jan2026", label: "Ene", year: 2026 }, { key: "feb2026", label: "Feb", year: 2026 },
    { key: "mar2026", label: "Mar", year: 2026 }, { key: "apr2026", label: "Abr", year: 2026 },
    { key: "may2026", label: "May", year: 2026 }, { key: "jun2026", label: "Jun", year: 2026 },
    { key: "jul2026", label: "Jul", year: 2026 }, { key: "aug2026", label: "Ago", year: 2026 },
    { key: "sep2026", label: "Sep", year: 2026 }, { key: "oct2026", label: "Oct", year: 2026 },
    { key: "nov2026", label: "Nov", year: 2026 }, { key: "dec2026", label: "Dic", year: 2026 },
  ];

  const updatePersonnelMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      email: string; 
      roleId: number; 
      hourlyRate: number;
      contractType: string;
      monthlyFixedSalary?: number;
      includeInRealCosts: boolean;
      monthlyHours?: number;
    }) => {
      console.log(`🔧 [${person.name}] Sending PATCH request for personnel ${person.id}:`, data);
      console.log(`🔧 [${person.name}] Monthly hours being sent: ${data.monthlyHours} (type: ${typeof data.monthlyHours})`);
      
      const response = await apiRequest(`/api/personnel/${person.id}`, "PATCH", data);
      console.log(`🔧 [${person.name}] Server response:`, response);
      console.log(`🔧 [${person.name}] Monthly hours in response: ${response.monthlyHours} (type: ${typeof response.monthlyHours})`);
      
      return response;
    },
    onSuccess: (updatedPerson) => {
      console.log(`✅ [${person.name}] Personnel ${person.id} updated successfully:`, updatedPerson);
      console.log(`📊 [${person.name}] Final monthly hours: ${updatedPerson.monthlyHours}`);
      
      // Actualizar estados locales inmediatamente con datos del servidor
      setEditedName(updatedPerson.name);
      setEditedEmail(updatedPerson.email);
      setEditedRoleId(updatedPerson.roleId.toString());
      setEditedHourlyRate(updatedPerson.hourlyRate.toString());
      setEditedContractType(updatedPerson.contractType || 'full-time');
      setEditedMonthlyFixedSalary(updatedPerson.monthlyFixedSalary?.toString() || '');
      setEditedIncludeInRealCosts(updatedPerson.includeInRealCosts ?? true);
      setEditedMonthlyHours(updatedPerson.monthlyHours?.toString() || '');

      console.log(`🔧 [${person.name}] Local state updated - monthlyHours: ${updatedPerson.monthlyHours}`);

      // Actualizar el cache optimistamente y luego invalidar para refetch
      queryClient.setQueryData(["/api/personnel"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((p: any) => p.id === person.id ? updatedPerson : p);
      });
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });

      toast({
        title: "Éxito",
        description: `${person.name} actualizado correctamente`
      });

      setIsEditing(false);
    },
    onError: (err) => {
      console.error(`❌ [${person.name}] Error updating personnel:`, err);
      toast({
        title: "Error",
        description: `No se pudo actualizar a ${person.name}`,
        variant: "destructive"
      });
    }
  });

  const deletePersonnelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/personnel/${person.id}`, "DELETE");
    },
    onSuccess: () => {
      // Actualizar cache de forma optimista eliminando el personal
      queryClient.setQueryData(["/api/personnel"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((p: any) => p.id !== person.id);
      });

      // Invalidar queries para forzar actualización
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });

      toast({
        title: "Éxito",
        description: "Personal eliminado correctamente"
      });
    },
    onError: (err: any) => {
      console.error("Error deleting personnel:", err);
      const errorMessage = err?.response?.data?.message || err?.message || "No se pudo eliminar el personal";
      
      toast({
        title: "No se puede eliminar",
        description: errorMessage,
        variant: "destructive"
      });
      setIsDeleting(false);
    }
  });

  const handleDelete = async () => {
    // Primero verificar dependencias antes de intentar eliminar
    try {
      const dependencies = await apiRequest(`/api/personnel/${person.id}/dependencies`, "GET");
      
      if (dependencies.timeEntries > 0 || dependencies.quotations.length > 0 || dependencies.projects.length > 0) {
        let warningMessage = `⚠️ No se puede eliminar a "${person.name}" porque está siendo usado en:\n\n`;
        
        if (dependencies.timeEntries > 0) {
          warningMessage += `• ${dependencies.timeEntries} entradas de tiempo registradas\n`;
        }
        
        if (dependencies.quotations.length > 0) {
          warningMessage += `• Cotizaciones: ${dependencies.quotations.map((q: any) => q.projectName).join(', ')}\n`;
        }
        
        if (dependencies.projects.length > 0) {
          warningMessage += `• Proyectos activos: ${dependencies.projects.map((p: any) => p.name).join(', ')}\n`;
        }
        
        warningMessage += `\n📋 Para eliminarlo, primero debes removerlo de estas cotizaciones y proyectos.`;
        
        alert(warningMessage);
        return;
      }
    } catch (error) {
      console.error("Error checking dependencies:", error);
    }
    
    if (window.confirm(`¿Estás seguro de que quieres eliminar a "${person.name}"? Esta acción no se puede deshacer.`)) {
      setIsDeleting(true);
      deletePersonnelMutation.mutate();
    }
  };

  const updateHistoricalCostMutation = useMutation({
    mutationFn: async (data: { field: string; value: number | null | string }) => {
      console.log(`🚀 Mutation starting: ${data.field} = ${data.value}`);
      const result = await apiRequest(`/api/personnel/${person.id}`, "PATCH", { [data.field]: data.value });
      console.log(`✅ Mutation completed: ${data.field} = ${data.value}, result:`, result);
      return { result, fieldName: data.field };
    },
    onMutate: (variables) => {
      console.log(`⏳ Starting mutation for field: ${variables.field}`);
      // Marcar que este campo se está guardando al inicio de la mutation
      setSavingFields(prev => ({ ...prev, [variables.field]: true }));
    },
    onSuccess: (data, variables) => {
      console.log(`🎉 Mutation onSuccess: ${variables.field} = ${variables.value}`);
      
      // Quitar el estado de guardado para este campo específico
      setSavingFields(prev => {
        const newState = { ...prev };
        delete newState[variables.field];
        return newState;
      });
      
      // Limpiar el estado local de edición para este campo
      setEditingCells(prev => {
        const newState = { ...prev };
        delete newState[variables.field];
        return newState;
      });
      
      // Solo invalidar el cache para forzar una recarga completa desde la base de datos
      // Esto asegura que el valor guardado se mantenga persistente
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });

      console.log(`✅ Successfully saved: ${variables.field} = ${variables.value}`);
    },
    onError: (error: any, variables) => {
      console.error("❌ Mutation error:", error);
      
      // Quitar el estado de guardado para este campo específico
      setSavingFields(prev => {
        const newState = { ...prev };
        delete newState[variables.field];
        return newState;
      });
      
      // Revertir el valor en caso de error
      setEditingCells(prev => {
        const newState = { ...prev };
        delete newState[variables.field];
        return newState;
      });
      
      toast({
        title: "Error",
        description: error.message || "Hubo un error al actualizar el valor.",
        variant: "destructive",
      });
    },
  });

  const handleHistoricalCostChange = (field: string, value: string) => {
    // Solo actualizar el estado local, no guardar todavía
    setEditingCells(prev => ({ ...prev, [field]: value }));
  };

  // Función para obtener el mes actual (hasta cuál mes buscar valores "actuales")
  const getCurrentMonth = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    const monthNames = [
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];

    if (currentYear === 2025 || currentYear === 2026) {
      return monthNames[currentMonth - 1] + currentYear;
    }

    if (currentYear > 2026) {
      return 'dec2026';
    }

    // Antes de 2025: no hay datos "actuales" aún
    return null;
  };

  const handleHistoricalCostSave = async (field: string) => {
    const value = editingCells[field] || '';
    console.log(`💾 Saving field ${field} with value:`, value);
    
    // Si es un campo de tipo de contrato, manejarlo como string
    if (field.includes('ContractType')) {
      if (value && ['full-time', 'part-time', 'freelance'].includes(value)) {
        try {
          // Guardar el campo mensual primero
          console.log(`💾 Saving monthly contract type: ${field} = ${value}`);
          await updateHistoricalCostMutation.mutateAsync({ field, value: value });
          console.log(`✅ Monthly contract type saved successfully: ${field} = ${value}`);
          
          // Actualizar el campo principal si este es el mes más reciente con datos
          const currentPersonData = { ...person, ...Object.fromEntries(
            Object.entries(editingCells).map(([k, v]) => [k, v])
          )};
          
          // Determinar el mes más reciente con tipo de contrato (solo hasta el mes actual)
          const currentMonth = getCurrentMonth();
          const allMonths = HISTORICAL_MONTHS_DESC;
          
          // Filtrar solo los meses hasta el actual (inclusive)
          let months = allMonths;
          if (currentMonth) {
            const currentIndex = allMonths.indexOf(currentMonth);
            if (currentIndex !== -1) {
              months = allMonths.slice(currentIndex); // Desde el mes actual hacia atrás
            }
          }
          
          let latestContractType = null;
          for (const month of months) {
            const contractField = `${month}ContractType`;
            let contractValue = null;
            
            // Si estamos editando este campo, usar el nuevo valor
            if (contractField === field) {
              contractValue = value;
            } else {
              // Usar el valor existente
              contractValue = (currentPersonData as any)[contractField];
            }
            
            if (contractValue) {
              latestContractType = contractValue;
              break;
            }
          }
          
          // Si encontramos un tipo de contrato más reciente, actualizar el campo principal
          if (latestContractType && latestContractType !== person.contractType) {
            console.log(`🔄 Updating main contractType to: ${latestContractType}`);
            await updateHistoricalCostMutation.mutateAsync({ field: 'contractType', value: latestContractType });
            
            toast({
              title: "Campo principal actualizado",
              description: `Tipo de contrato principal actualizado a: ${latestContractType}`,
            });
          }
          
          // El estado de edición se limpiará automáticamente en onSuccess de la mutación
          
        } catch (error) {
          console.error(`❌ Error saving contract type ${field}:`, error);
          toast({
            title: "Error al guardar",
            description: "No se pudo guardar el tipo de contrato",
            variant: "destructive",
          });
        }
      }
      return;
    }
    
    // Para campos numéricos (tarifas y salarios)
    const numericValue = value === '' ? null : parseFloat(value);

    if (value === '' || (numericValue !== null && !isNaN(numericValue) && numericValue >= 0)) {
      // Si es un campo de sueldo mensual para full-time, calcular tarifa por hora automáticamente usando las horas mensuales asignadas
      if (field.includes('MonthlySalaryARS') && person.contractType === 'full-time' && numericValue) {
        const monthlyHours = person.monthlyHours || 160; // Usar horas mensuales asignadas, defaultear a 160
        const hourlyRate = numericValue / monthlyHours;
        const hourlyRateField = field.replace('MonthlySalaryARS', 'HourlyRateARS');

        // Guardar tanto el sueldo como la tarifa calculada
        updateHistoricalCostMutation.mutate({ field, value: numericValue });
        updateHistoricalCostMutation.mutate({ field: hourlyRateField, value: Math.round(hourlyRate) });

        toast({
          title: "Cálculo automático",
          description: `Tarifa por hora calculada: $${Math.round(hourlyRate).toLocaleString()} ARS (${numericValue.toLocaleString()} ÷ ${Math.round(monthlyHours)} horas)`
        });
      } else {
        updateHistoricalCostMutation.mutate({ field, value: numericValue });
      }

      // Actualizar campos principales si este es el último mes con datos
      const isRateField = field.includes('HourlyRateARS');
      const isSalaryField = field.includes('MonthlySalaryARS');
      
      if (isRateField || isSalaryField) {
        // Determinar el mes más reciente con datos de tarifa/salario (solo hasta el mes actual)
        const currentMonth = getCurrentMonth();
        const allMonths = HISTORICAL_MONTHS_DESC;
        
        // Filtrar solo los meses hasta el actual (inclusive)
        let months = allMonths;
        if (currentMonth) {
          const currentIndex = allMonths.indexOf(currentMonth);
          if (currentIndex !== -1) {
            months = allMonths.slice(currentIndex); // Desde el mes actual hacia atrás
          }
        }
        
        let latestRateValue = null;
        let latestSalaryValue = null;
        
        for (const month of months) {
          const rateField = `${month}HourlyRateARS`;
          const salaryField = `${month}MonthlySalaryARS`;
          
          // Obtener valor actual o editado
          let currentRateValue = field === rateField ? numericValue : (person as any)[rateField];
          let currentSalaryValue = field === salaryField ? numericValue : (person as any)[salaryField];
          
          if (currentRateValue && !latestRateValue) {
            latestRateValue = currentRateValue;
          }
          if (currentSalaryValue && !latestSalaryValue) {
            latestSalaryValue = currentSalaryValue;
          }
          
          // Si encontramos ambos valores, parar la búsqueda
          if (latestRateValue && latestSalaryValue) break;
        }
        
        // Actualizar campo principal de tarifa ARS si es diferente
        if (latestRateValue && latestRateValue !== (person as any).hourlyRateARS) {
          updateHistoricalCostMutation.mutate({ field: 'hourlyRateARS', value: latestRateValue });
          
          toast({
            title: "Tarifa principal actualizada",
            description: `Tarifa por hora ARS principal actualizada: $${latestRateValue.toLocaleString()}`,
          });
        }
        
        // Actualizar campo principal de salario si es diferente
        if (latestSalaryValue && latestSalaryValue !== person.monthlyFixedSalary) {
          updateHistoricalCostMutation.mutate({ field: 'monthlyFixedSalary', value: latestSalaryValue });
          
          toast({
            title: "Salario principal actualizado",
            description: `Salario mensual principal actualizado: $${latestSalaryValue.toLocaleString()}`,
          });
        }
      }

      // Remover del estado de edición después de guardar
      setEditingCells(prev => {
        const newState = { ...prev };
        delete newState[field];
        return newState;
      });
    } else {
      // Si el valor no es válido, revertir al valor original
      setEditingCells(prev => {
        const newState = { ...prev };
        delete newState[field];
        return newState;
      });
    }
  };

  const getCellValue = (field: string) => {
    // Priorizar siempre el estado local de edición para mostrar cambios inmediatos
    if (editingCells[field] !== undefined) {
      return editingCells[field];
    }
    const value = (person as any)[field];
    return (value !== null && value !== undefined) ? value.toString() : '';
  };

  const handleSave = () => {
    const parsedHourlyRate = parseFloat(editedHourlyRate);
    const hourlyRate = !isNaN(parsedHourlyRate) ? parsedHourlyRate : (getLatestHistoricalHourlyRate() ?? person.hourlyRate);
    const parsedSalary = parseFloat(editedMonthlyFixedSalary);
    const monthlyFixedSalary = !isNaN(parsedSalary) ? parsedSalary : (getLatestHistoricalSalary() ?? person.monthlyFixedSalary ?? null);
    const roleId = parseInt(editedRoleId);
    const parsedHours = editedMonthlyHours ? parseFloat(editedMonthlyHours) : null;
    const monthlyHours = parsedHours !== null && !isNaN(parsedHours) ? parsedHours : null;

    console.log(`🔧 Validating data before save:`, {
      name: editedName,
      hourlyRate,
      monthlyFixedSalary,
      roleId,
      monthlyHours,
      contractType: editedContractType
    });

    if (isNaN(hourlyRate) || hourlyRate < 0) {
      toast({
        title: "Error",
        description: "Ingrese una tarifa por hora válida",
        variant: "destructive"
      });
      return;
    }

    if (!editedName.trim()) {
      toast({
        title: "Error",
        description: "El nombre es requerido",
        variant: "destructive"
      });
      return;
    }

    // Solo validar horas mensuales para empleados full-time y part-time, no para freelancers
    if (editedContractType !== 'freelance') {
      if (!monthlyHours || isNaN(monthlyHours) || monthlyHours <= 0) {
        toast({
          title: "Error",
          description: "Las horas mensuales son requeridas para empleados full-time y part-time",
          variant: "destructive"
        });
        return;
      }

      // Validación específica: horas mensuales entre 40 y 300 (rango razonable)
      if (monthlyHours < 40 || monthlyHours > 300) {
        toast({
          title: "Error",
          description: "Las horas mensuales deben estar entre 40 y 300 horas",
          variant: "destructive"
        });
        return;
      }
    }

    const dataToSend: any = {
      name: editedName.trim(),
      email: editedEmail.trim(),
      roleId: roleId,
      hourlyRate: hourlyRate,
      contractType: editedContractType,
      includeInRealCosts: editedIncludeInRealCosts
    };

    // Solo incluir monthlyFixedSalary cuando tiene un valor numérico válido
    if (monthlyFixedSalary !== null && monthlyFixedSalary !== undefined) {
      dataToSend.monthlyFixedSalary = monthlyFixedSalary;
    }

    // Solo incluir monthlyHours para empleados no-freelance
    if (editedContractType !== 'freelance' && monthlyHours) {
      dataToSend.monthlyHours = monthlyHours;
    }

    console.log(`🚀 Sending update request:`, dataToSend);
    updatePersonnelMutation.mutate(dataToSend);
  };

  const handleCancel = () => {
    setEditedName(person.name);
    setEditedEmail(person.email);
    setEditedRoleId(person.roleId.toString());
    setEditedHourlyRate(getInitialHourlyRate());
    setEditedContractType(person.contractType || 'full-time');
    setEditedMonthlyFixedSalary(getInitialSalary());
    setEditedIncludeInRealCosts(person.includeInRealCosts ?? true);
    setEditedMonthlyHours(person.monthlyHours?.toString() || '0');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr className="border-b bg-blue-50/30">
        <td className="px-6 py-4">
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="h-9 border-blue-200 focus:border-blue-400"
            disabled={updatePersonnelMutation.isPending}
            placeholder="Nombre completo"
          />
        </td>
        <td className="px-6 py-4">
          <Input
            type="email"
            value={editedEmail}
            onChange={(e) => setEditedEmail(e.target.value)}
            className="h-9 border-blue-200 focus:border-blue-400"
            disabled={updatePersonnelMutation.isPending}
            placeholder="email@ejemplo.com (opcional)"
          />
        </td>
        <td className="px-6 py-4">
          <Select
            value={editedRoleId}
            onValueChange={setEditedRoleId}
            disabled={updatePersonnelMutation.isPending}
          >
            <SelectTrigger className="h-9 border-purple-200 focus:border-purple-400">
              <SelectValue placeholder="Seleccionar rol" />
            </SelectTrigger>
            <SelectContent>
              {roles?.map((role: any) => (
                <SelectItem key={role.id} value={role.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>{role.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-1">
            <Select
              value={editedContractType}
              onValueChange={setEditedContractType}
              disabled={updatePersonnelMutation.isPending}
            >
              <SelectTrigger className="h-9 border-blue-200 focus:border-blue-400">
                <SelectValue placeholder="Tipo contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full-time">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Full-time</span>
                  </div>
                </SelectItem>
                <SelectItem value="part-time">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span>Part-time</span>
                  </div>
                </SelectItem>
                <SelectItem value="freelance">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Freelance</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    <strong>Full-time:</strong> Empleado con sueldo fijo mensual (costo de oportunidad)<br/>
                    <strong>Part-time:</strong> Empleado a tiempo parcial con costo real por hora<br/>
                    <strong>Freelance:</strong> Colaborador externo con costo real por hora
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-600">$</span>
              <Input
                type="number"
                step="1"
                min="0"
                value={editedHourlyRate}
                onChange={(e) => {
                  setEditedHourlyRate(e.target.value);
                }}
                className="h-9 w-24 border-green-200 focus:border-green-400 text-center"
                disabled={updatePersonnelMutation.isPending}
                placeholder="0"
              />
              <span className="text-xs text-muted-foreground">ARS/hr</span>
            </div>
            {getLatestHistoricalHourlyRate() && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Histórico: ${getLatestHistoricalHourlyRate()!.toLocaleString('es-AR')}
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          {editedContractType === 'full-time' ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-gray-600">$</span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={editedMonthlyFixedSalary}
                  onChange={(e) => {
                    setEditedMonthlyFixedSalary(e.target.value);
                  }}
                  className="h-9 w-28 border-blue-200 focus:border-blue-400 text-center"
                  disabled={updatePersonnelMutation.isPending}
                  placeholder="0"
                />
                <span className="text-xs text-muted-foreground">ARS/mes</span>
              </div>
              {getLatestHistoricalSalary() && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Histórico: ${getLatestHistoricalSalary()!.toLocaleString('es-AR')}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 p-3 bg-gray-50 rounded-lg border-2 border-gray-300">
              <span className="text-xs text-gray-400">-</span>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Se paga por horas
              </span>
              <span className="text-xs text-gray-400 italic mt-1">
                (No aplica)
              </span>
            </div>
          )}
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col items-center justify-center gap-1 min-h-[3rem]">
            {editedContractType === 'freelance' ? (
              <>
                <span className="text-xs text-gray-400">-</span>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Se paga por horas
                </span>
              </>
            ) : (
              <div className="flex items-center justify-center gap-1">
                <Input
                  type="number"
                  step="1"
                  min="40"
                  max="300"
                  value={editedMonthlyHours}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditedMonthlyHours(value);
                    console.log(`📝 Monthly hours changed to: ${value}`);
                  }}
                  className="h-9 w-20 border-blue-200 focus:border-blue-400 text-center"
                  disabled={updatePersonnelMutation.isPending}
                  placeholder="160"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        <strong>Horas Mensuales:</strong> Cantidad de horas estimadas que esta persona 
                        trabaja por mes. Rango válido: 40-300 horas.<br/>
                        <strong>Estándar:</strong> 160h (full-time), 80h (part-time).<br/>
                        Se usa para calcular automáticamente la tarifa por hora basada en el sueldo fijo.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center justify-center gap-1">
            <input
              type="checkbox"
              checked={editedIncludeInRealCosts}
              onChange={(e) => setEditedIncludeInRealCosts(e.target.checked)}
              disabled={updatePersonnelMutation.isPending}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    <strong>Incluir en Costos Reales:</strong> Si está marcado, los costos de esta persona 
                    se incluyen en el cálculo de costos reales del proyecto (gastos de dinero efectivo).
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center justify-center gap-1">
            <input
              type="checkbox"
              checked={editedIncludeInRealCosts}
              onChange={(e) => setEditedIncludeInRealCosts(e.target.checked)}
              disabled={updatePersonnelMutation.isPending}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    <strong>Incluir en Costos Reales:</strong> Determina si los costos de esta persona 
                    se incluyen en cálculos financieros reales (EBITDA, análisis de costos, etc.). 
                    Para empleados full-time, generalmente es un costo de oportunidad, no un costo real.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={updatePersonnelMutation.isPending}
              className="h-9 w-9 p-0 hover:bg-green-100 hover:text-green-700"
            >
              {updatePersonnelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              ) : (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={updatePersonnelMutation.isPending}
              className="h-9 w-9 p-0 hover:bg-red-100 hover:text-red-700"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="px-6 py-4">
        <div className="font-medium text-gray-900">{person.name}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-muted-foreground">{person.email}</div>
      </td>
      <td className="px-6 py-4">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRoleColor(person.roleName)}`}>
          {person.roleName}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          person.contractType === 'full-time' ? 'bg-blue-100 text-blue-800' : 
          person.contractType === 'part-time' ? 'bg-orange-100 text-orange-800' : 
          person.contractType === 'freelance' ? 'bg-green-100 text-green-800' : 
          'bg-blue-100 text-blue-800'
        }`}>
          {person.contractType === 'full-time' ? 'Full-time' : 
           person.contractType === 'part-time' ? 'Part-time' : 
           person.contractType === 'freelance' ? 'Freelance' : 'Full-time'}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          {getLatestHistoricalHourlyRate() ? (
            <>
              <span className="text-sm font-semibold text-green-700">
                ${getLatestHistoricalHourlyRate()!.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-muted-foreground">ARS/hr</span>
              <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full ml-1" title="Valor del último mes cargado">
                ✓
              </span>
            </>
          ) : person.hourlyRate > 0 ? (
            <>
              <span className="text-sm font-semibold text-orange-600">
                ${person.hourlyRate.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-muted-foreground">ARS/hr</span>
              <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full ml-1" title="Valor desactualizado - configurar en datos históricos">
                ⚠
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-400">Sin configurar</span>
          )}
        </div>
        {person.hourlyRate > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-sm font-semibold text-blue-700">
              ${person.hourlyRate.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-blue-500">USD/hr</span>
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col items-start gap-1">
          {person.contractType === 'full-time' ? (
            getLatestHistoricalSalary() ? (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-blue-700">
                    ${getLatestHistoricalSalary()!.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs text-muted-foreground">ARS/mes</span>
                  <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full ml-1" title="Valor del último mes cargado">
                    ✓
                  </span>
                </div>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Costo fijo mensual
                </span>
              </>
            ) : person.monthlyFixedSalary ? (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-orange-600">
                    ${person.monthlyFixedSalary.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs text-muted-foreground">ARS/mes</span>
                  <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full ml-1" title="Valor desactualizado - configurar en datos históricos">
                    ⚠
                  </span>
                </div>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Costo fijo mensual
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-gray-400">Sin configurar</span>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Costo fijo mensual
                </span>
              </>
            )
          ) : (
            <>
              <span className="text-xs text-gray-400">-</span>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Se paga por horas
              </span>
            </>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col items-center justify-center gap-1 min-h-[3rem]">
          {person.contractType === 'freelance' ? (
            <>
              <span className="text-xs text-gray-400">-</span>
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Se paga por horas
              </span>
            </>
          ) : (
            <div className="flex items-center justify-center gap-1">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                person.contractType === 'full-time' ? 'bg-blue-100 text-blue-800' : 
                person.contractType === 'part-time' ? 'bg-orange-100 text-orange-800' : 
                'bg-blue-100 text-blue-800'
              }`} key={`${person.id}-${person.monthlyHours}`}>
                {person.monthlyHours}h/mes
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      <strong>Horas Mensuales:</strong> {Math.round(person.monthlyHours || 160)} horas por mes<br/>
                      {person.contractType === 'full-time' && person.monthlyFixedSalary && (
                        <>
                          <strong>Tarifa calculada:</strong> ${Math.round((person.monthlyFixedSalary / (person.monthlyHours || 160))).toLocaleString()} ARS/hora<br/>
                          <small>({person.monthlyFixedSalary.toLocaleString()} ÷ {Math.round(person.monthlyHours || 160)}h)</small>
                        </>
                      )}
                      {Math.round(person.monthlyHours || 160) !== 160 && (
                        <><br/><strong>Nota:</strong> Horario personalizado según contrato</>
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-center">
          {person.includeInRealCosts !== false ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <X className="h-4 w-4 text-red-600" />
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={showHistoricalCosts ? "default" : "outline"}
                  onClick={() => setShowHistoricalCosts(!showHistoricalCosts)}
                  className={`h-8 px-3 transition-all ${
                    showHistoricalCosts 
                      ? "bg-green-600 text-white hover:bg-green-700" 
                      : "border-green-300 text-green-600 hover:bg-green-50 hover:border-green-400"
                  }`}
                >
                  {showHistoricalCosts ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                  <span className="text-xs font-medium">Datos</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">Gestionar datos históricos mensuales</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Aquí se configuran las tarifas y sueldos que se muestran en la tabla
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            disabled={isDeleting}
            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={isDeleting || deletePersonnelMutation.isPending}
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            {isDeleting || deletePersonnelMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </td>
    </tr>
    {showHistoricalCosts && (
      <tr className="border-b bg-green-50/20">
        <td colSpan={7} className="px-6 py-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-green-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <h4 className="font-semibold text-gray-900 text-lg">Costos Históricos - {person.name}</h4>
              </div>
              <div className="text-xs text-gray-600 bg-green-100 px-3 py-1.5 rounded-full font-medium">
                Valores en ARS • Análisis de rentabilidad
              </div>
            </div>

            <div className="space-y-6">
              {/* Información del Mes Actual */}
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <h5 className="font-semibold text-blue-900">Sincronización Automática</h5>
                </div>
                <div className="text-sm text-blue-800 space-y-2">
                  <p>
                    <strong>Mes actual del sistema:</strong> {getCurrentMonth() || 'Antes de 2025 - Sin datos actuales'}
                  </p>
                  <p>
                    Los <strong>campos principales</strong> (arriba) se actualizan automáticamente con los valores del 
                    <strong> último mes registrado</strong> (desde {getCurrentMonth() || 'enero'} hacia atrás).
                  </p>
                  <div className="text-xs bg-blue-100 p-2 rounded border-l-4 border-blue-400">
                    <strong>Ejemplo:</strong> Si configuras mayo como "full-time" con sueldo, el campo principal mostrará "full-time" 
                    porque mayo es posterior a enero-abril freelance.
                  </div>
                </div>
              </div>

              {/* Tipo de Contrato por Mes */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <h5 className="font-semibold text-gray-800">Tipo de Contrato por Mes</h5>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Controla qué campos están disponibles por mes</span>
                </div>
                <div className="grid grid-cols-6 gap-3">
                  {months.map((month) => {
                    const fieldName = `${month.key}ContractType`;
                    const currentMonth = getCurrentMonth();
                    const isCurrentMonth = currentMonth === month.key;
                    const allMonths = HISTORICAL_MONTHS_DESC;
                    const currentIndex = currentMonth ? allMonths.indexOf(currentMonth) : -1;
                    const monthIndex = allMonths.indexOf(month.key);
                    const isAfterCurrent = currentIndex !== -1 && monthIndex < currentIndex;
                    
                    return (
                      <div key={fieldName} className="space-y-2">
                        <label className={`text-xs font-medium block text-center ${
                          isCurrentMonth ? 'text-blue-600 font-bold' : 
                          isAfterCurrent ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {month.label} {month.year}
                          {isCurrentMonth && <span className="block text-[10px] text-blue-500">• ACTUAL</span>}
                          {isAfterCurrent && <span className="block text-[10px] text-gray-400">• FUTURO</span>}
                        </label>
                        <Select
                          value={(person as any)[fieldName] || ''}
                          onValueChange={(value) => {
                            console.log(`🔧 [${person.name}] Contract type changed for ${fieldName}: ${value}`);
                            updateHistoricalCostMutation.mutate({ field: fieldName, value: value });
                          }}
                          disabled={savingFields[fieldName] || isAfterCurrent}
                        >
                          <SelectTrigger className={`h-9 text-xs border-gray-200 focus:border-purple-400 focus:ring-purple-400/20 ${
                            savingFields[fieldName] ? 'bg-yellow-50 border-yellow-300' : ''
                          }`}>
                            <SelectValue placeholder={savingFields[fieldName] ? "Guardando..." : "Tipo"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full-time">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-xs">Full-time</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="part-time">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                <span className="text-xs">Part-time</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="freelance">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-xs">Freelance</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tarifa por Hora ARS */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <h5 className="font-semibold text-gray-800">Tarifa por Hora (ARS)</h5>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Para análisis operacional</span>
                </div>
                <div className="grid grid-cols-6 gap-3">
                  {months.map((month) => {
                    const fieldName = `${month.key}HourlyRateARS`;
                    const currentMonth = getCurrentMonth();
                    const isCurrentMonth = currentMonth === month.key;
                    const allMonths = HISTORICAL_MONTHS_DESC;
                    const currentIndex = currentMonth ? allMonths.indexOf(currentMonth) : -1;
                    const monthIndex = allMonths.indexOf(month.key);
                    const isAfterCurrent = currentIndex !== -1 && monthIndex < currentIndex;
                    
                    return (
                      <div key={fieldName} className="space-y-2">
                        <label className={`text-xs font-medium block text-center ${
                          isCurrentMonth ? 'text-blue-600 font-bold' : 
                          isAfterCurrent ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {month.label} {month.year}
                          {isCurrentMonth && <span className="block text-[10px] text-blue-500">• ACTUAL</span>}
                          {isAfterCurrent && <span className="block text-[10px] text-gray-400">• FUTURO</span>}
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={getCellValue(fieldName)}
                          onChange={(e) => handleHistoricalCostChange(fieldName, e.target.value)}
                          onBlur={() => handleHistoricalCostSave(fieldName)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          className={`h-9 text-sm text-center border-gray-200 focus:border-green-400 focus:ring-green-400/20 ${
                            isAfterCurrent ? 'bg-gray-50 text-gray-400' : ''
                          }`}
                          placeholder={isAfterCurrent ? "Futuro" : "0"}
                          disabled={updateHistoricalCostMutation.isPending || isAfterCurrent}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sueldo Mensual ARS - condicional por mes */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <h5 className="font-semibold text-gray-800">Sueldo Mensual (ARS)</h5>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Solo para meses con contrato full-time o part-time</span>
                  <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">Se usa {Math.round(person.monthlyHours || 160)}h para calcular tarifa/hora</span>
                </div>
                <div className="grid grid-cols-6 gap-3">
                  {months.map((month) => {
                    const fieldName = `${month.key}MonthlySalaryARS`;
                    const contractTypeFieldName = `${month.key}ContractType`;
                    const contractTypeForMonth = getCellValue(contractTypeFieldName);
                    const isFreelanceMonth = contractTypeForMonth === 'freelance';
                    
                    const currentMonth = getCurrentMonth();
                    const isCurrentMonth = currentMonth === month.key;
                    const allMonths = HISTORICAL_MONTHS_DESC;
                    const currentIndex = currentMonth ? allMonths.indexOf(currentMonth) : -1;
                    const monthIndex = allMonths.indexOf(month.key);
                    const isAfterCurrent = currentIndex !== -1 && monthIndex < currentIndex;
                    
                    return (
                      <div key={fieldName} className="space-y-2">
                        <label className={`text-xs font-medium block text-center ${
                          isCurrentMonth ? 'text-blue-600 font-bold' : 
                          isAfterCurrent ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {month.label} {month.year}
                          {isCurrentMonth && <span className="block text-[10px] text-blue-500">• ACTUAL</span>}
                          {isAfterCurrent && <span className="block text-[10px] text-gray-400">• FUTURO</span>}
                        </label>
                        {isFreelanceMonth ? (
                          <div className="h-9 flex items-center justify-center text-xs text-gray-400 bg-gray-50 rounded border border-gray-200">
                            N/A (Freelance)
                          </div>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={getCellValue(fieldName)}
                            onChange={(e) => handleHistoricalCostChange(fieldName, e.target.value)}
                            onBlur={() => handleHistoricalCostSave(fieldName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            className={`h-9 text-sm text-center border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 ${
                              isAfterCurrent ? 'bg-gray-50 text-gray-400' : ''
                            }`}
                            placeholder={isAfterCurrent ? "Futuro" : "0"}
                            disabled={updateHistoricalCostMutation.isPending || isAfterCurrent}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h6 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                Cómo se Usan Estos Valores
              </h6>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="font-medium text-blue-800 mb-1">Análisis Operacional</div>
                  <div className="text-blue-700">Se registran automáticamente en cada entrada de tiempo para analizar productividad</div>
                </div>

                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <div className="font-medium text-purple-800 mb-1">Análisis Económico</div>
                  <div className="text-purple-700">
                    <strong>Full-time:</strong> Sueldo fijo mensual<br/>
                    <strong>Freelance:</strong> Horas × tarifa histórica
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="font-medium text-green-800 mb-1">Nuevas Cotizaciones</div>
                  <div className="text-green-700">Los valores actuales (tabla superior) se usan para proyectos futuros</div>
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )}
    </>
  );
}