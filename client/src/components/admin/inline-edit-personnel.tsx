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
  };
  roles: any[];
}

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
  const [editedHourlyRate, setEditedHourlyRate] = useState(person.hourlyRate.toString());
  const [editedContractType, setEditedContractType] = useState(person.contractType || 'full-time');
  const [editedMonthlyFixedSalary, setEditedMonthlyFixedSalary] = useState(person.monthlyFixedSalary?.toString() || '');
  const [editedIncludeInRealCosts, setEditedIncludeInRealCosts] = useState(person.includeInRealCosts ?? true);
  const [editedMonthlyHours, setEditedMonthlyHours] = useState(person.monthlyHours?.toString() || '');
  const [editingCells, setEditingCells] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sincronizar estados locales con datos de la persona cuando cambien
  useEffect(() => {
    setEditedName(person.name);
    setEditedEmail(person.email);
    setEditedRoleId(person.roleId.toString());
    setEditedHourlyRate(person.hourlyRate.toString());
    setEditedContractType(person.contractType || 'full-time');
    setEditedMonthlyFixedSalary(person.monthlyFixedSalary?.toString() || '');
    setEditedIncludeInRealCosts(person.includeInRealCosts ?? true);
    setEditedMonthlyHours(person.monthlyHours?.toString() || '0');
  }, [person.id, person.name, person.email, person.roleId, person.hourlyRate, person.contractType, person.monthlyFixedSalary, person.includeInRealCosts, person.monthlyHours]);

  // Función para obtener el último sueldo histórico
  const getLatestHistoricalSalary = (): number | null => {
    const salaryFields = [
      'dec2025MonthlySalaryARS', 'nov2025MonthlySalaryARS', 'oct2025MonthlySalaryARS',
      'sep2025MonthlySalaryARS', 'aug2025MonthlySalaryARS', 'jul2025MonthlySalaryARS',
      'jun2025MonthlySalaryARS', 'may2025MonthlySalaryARS', 'apr2025MonthlySalaryARS',
      'mar2025MonthlySalaryARS', 'feb2025MonthlySalaryARS', 'jan2025MonthlySalaryARS'
    ];

    // Buscar el último valor histórico no nulo, comenzando desde diciembre hacia atrás
    for (const field of salaryFields) {
      const value = (person as any)[field];
      if (value && value > 0) {
        return value;
      }
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

  const months = [
    { key: "jan2025", label: "Ene" }, { key: "feb2025", label: "Feb" },
    { key: "mar2025", label: "Mar" }, { key: "apr2025", label: "Abr" },
    { key: "may2025", label: "May" }, { key: "jun2025", label: "Jun" },
    { key: "jul2025", label: "Jul" }, { key: "aug2025", label: "Ago" },
    { key: "sep2025", label: "Sep" }, { key: "oct2025", label: "Oct" },
    { key: "nov2025", label: "Nov" }, { key: "dec2025", label: "Dic" },
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
      
      // LIMPIAR TODO EL CACHE antes de actualizar
      queryClient.clear();
      
      // Actualizar estados locales inmediatamente con datos del servidor
      setEditedName(updatedPerson.name);
      setEditedEmail(updatedPerson.email);
      setEditedRoleId(updatedPerson.roleId.toString());
      setEditedHourlyRate(updatedPerson.hourlyRate.toString());
      setEditedContractType(updatedPerson.contractType || 'full-time');
      setEditedMonthlyFixedSalary(updatedPerson.monthlyFixedSalary?.toString() || '');
      setEditedIncludeInRealCosts(updatedPerson.includeInRealCosts ?? true);
      setEditedMonthlyHours(updatedPerson.monthlyHours?.toString() || '');

      console.log(`🔧 [${person.name}] Local state FORCED - editedMonthlyHours: ${updatedPerson.monthlyHours?.toString() || 'undefined'}`);

      // RECARGAR TODOS LOS DATOS desde el servidor
      setTimeout(() => {
        console.log(`🔄 [${person.name}] RELOADING ALL PERSONNEL DATA...`);
        queryClient.refetchQueries({ queryKey: ["/api/personnel"] });
      }, 50);

      // FORZAR segundo reload
      setTimeout(() => {
        console.log(`🔄 [${person.name}] FORCE SECOND RELOAD...`);
        queryClient.invalidateQueries();
        queryClient.refetchQueries({ queryKey: ["/api/personnel"] });
      }, 200);

      toast({
        title: "Éxito",
        description: `${person.name} actualizado. Horas mensuales: ${updatedPerson.monthlyHours}h`
      });
      
      // FORZAR re-render completo del componente padre
      // setTimeout(() => {
      //   window.location.reload();
      // }, 1000);
      
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
    onError: (err) => {
      console.error("Error deleting personnel:", err);
      toast({
        title: "Error",
        description: "No se pudo eliminar el personal",
        variant: "destructive"
      });
      setIsDeleting(false);
    }
  });

  const handleDelete = () => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar a "${person.name}"? Esta acción no se puede deshacer.`)) {
      setIsDeleting(true);
      deletePersonnelMutation.mutate();
    }
  };

  const updateHistoricalCostMutation = useMutation({
    mutationFn: async (data: { field: string; value: number | null | string }) => {
      return apiRequest(`/api/personnel/${person.id}`, "PATCH", { [data.field]: data.value });
    },
    onSuccess: (data, variables) => {
      // Actualizar cache inmediatamente
      queryClient.setQueryData(["/api/personnel"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((p: any) => 
          p.id === person.id ? { ...p, ...data } : p
        );
      });

      // Invalidar cache para forzar recarga
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });

      toast({
        title: "Costo histórico actualizado",
        description: "El valor ha sido guardado correctamente.",
      });
    },
    onError: (error: any) => {
      console.error("Error al actualizar:", error);
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

  const handleHistoricalCostSave = (field: string) => {
    const value = editingCells[field] || '';
    
    // Si es un campo de tipo de contrato, manejarlo como string
    if (field.includes('ContractType')) {
      if (value && ['full-time', 'part-time', 'freelance'].includes(value)) {
        // Guardar el campo mensual
        updateHistoricalCostMutation.mutate({ field, value: value });
        
        // Actualizar el campo principal si este es el mes más reciente con datos
        const currentPersonData = { ...person, ...Object.fromEntries(
          Object.entries(editingCells).map(([k, v]) => [k, v])
        )};
        
        // Determinar el mes más reciente con tipo de contrato
        const months = [
          'dec2025', 'nov2025', 'oct2025', 'sep2025', 'aug2025', 'jul2025',
          'jun2025', 'may2025', 'apr2025', 'mar2025', 'feb2025', 'jan2025'
        ];
        
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
          updateHistoricalCostMutation.mutate({ field: 'contractType', value: latestContractType });
          
          toast({
            title: "Campo principal actualizado",
            description: `Tipo de contrato principal actualizado a: ${latestContractType}`,
          });
        }
        
        // Remover del estado de edición después de guardar
        setEditingCells(prev => {
          const newState = { ...prev };
          delete newState[field];
          return newState;
        });
      }
      return;
    }
    
    // Para campos numéricos (tarifas y salarios)
    const numericValue = value === '' ? null : parseFloat(value);

    if (value === '' || (!isNaN(numericValue!) && numericValue! >= 0)) {
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
        // Determinar el mes más reciente con datos de tarifa/salario
        const months = [
          'dec2025', 'nov2025', 'oct2025', 'sep2025', 'aug2025', 'jul2025',
          'jun2025', 'may2025', 'apr2025', 'mar2025', 'feb2025', 'jan2025'
        ];
        
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
        if (latestRateValue && latestRateValue !== person.hourlyRateARS) {
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
    if (editingCells[field] !== undefined) {
      return editingCells[field];
    }
    const value = (person as any)[field];
    return (value !== null && value !== undefined) ? value.toString() : '';
  };

  const handleSave = () => {
    const hourlyRate = parseFloat(editedHourlyRate);
    const roleId = parseInt(editedRoleId);
    const monthlyHours = editedMonthlyHours ? parseFloat(editedMonthlyHours) : null;

    console.log(`🔧 Validating data before save:`, {
      name: editedName,
      hourlyRate,
      roleId,
      monthlyHours,
      contractType: editedContractType
    });

    if (isNaN(hourlyRate) || hourlyRate < 0) {
      toast({
        title: "Error",
        description: "La tarifa por hora debe ser un número válido",
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
      monthlyFixedSalary: editedMonthlyFixedSalary ? parseFloat(editedMonthlyFixedSalary) : undefined,
      includeInRealCosts: editedIncludeInRealCosts
    };

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
    setEditedHourlyRate(person.hourlyRate.toString());
    setEditedContractType(person.contractType || 'full-time');
    setEditedMonthlyFixedSalary(person.monthlyFixedSalary?.toString() || '');
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
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600">ARS</span>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={editedHourlyRate}
              onChange={(e) => setEditedHourlyRate(e.target.value)}
              className="h-9 w-24 border-blue-200 focus:border-blue-400"
              disabled={updatePersonnelMutation.isPending}
              placeholder="0.0"
            />
            <span className="text-sm text-muted-foreground">/hr</span>
          </div>
        </td>
        <td className="px-6 py-4">
          {editedContractType === 'full-time' ? (
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-600">ARS</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editedMonthlyFixedSalary}
                onChange={(e) => setEditedMonthlyFixedSalary(e.target.value)}
                className="h-9 w-28 border-blue-200 focus:border-blue-400"
                disabled={updatePersonnelMutation.isPending}
                placeholder="0.00"
              />
              {getLatestHistoricalSalary() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={updateSalaryFromHistorical}
                  disabled={updatePersonnelMutation.isPending}
                  className="h-9 px-2 text-xs"
                  title="Actualizar con último valor histórico"
                >
                  ↻
                </Button>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Sueldo fijo mensual para empleados full-time. Este es un costo de oportunidad 
                      (no se resta de las ganancias reales).
                      {getLatestHistoricalSalary() && (
                        <>
                          <br /><br />
                          <strong>Último valor histórico:</strong> ${getLatestHistoricalSalary()?.toLocaleString()} ARS
                          <br />Haz clic en ↻ para actualizarlo automáticamente.
                        </>
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="text-xs text-gray-400">-</span>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Se paga por horas
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
          <span className="text-sm font-semibold text-green-700">
            ${person.hourlyRate.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          <span className="text-xs text-muted-foreground">ARS/hr</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col items-start gap-1">
          {person.contractType === 'full-time' ? (
            person.monthlyFixedSalary ? (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-blue-700">
                    ${person.monthlyFixedSalary.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs text-muted-foreground">ARS/mes</span>
                  {getLatestHistoricalSalary() && getLatestHistoricalSalary() !== person.monthlyFixedSalary && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full cursor-help">
                            ⚠
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">
                            <strong>Desactualizado:</strong><br />
                            Último valor histórico: ${getLatestHistoricalSalary()?.toLocaleString()} ARS<br />
                            Haz clic en "Editar" para actualizarlo.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Costo fijo mensual
                </span>
              </>
            ) : getLatestHistoricalSalary() ? (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">Sin configurar</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full cursor-help">
                          ↻
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>Datos disponibles:</strong><br />
                          Último valor histórico: ${getLatestHistoricalSalary()?.toLocaleString()} ARS<br />
                          Haz clic en "Editar" para configurarlo.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                  variant="ghost"
                  onClick={() => setShowHistoricalCosts(!showHistoricalCosts)}
                  className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600 transition-colors"
                >
                  {showHistoricalCosts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ver costos históricos mensuales</p>
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
                    return (
                      <div key={fieldName} className="space-y-2">
                        <label className="text-xs font-medium text-gray-600 block text-center">
                          {month.label} 2025
                        </label>
                        <Select
                          value={getCellValue(fieldName) || ''}
                          onValueChange={(value) => {
                            handleHistoricalCostChange(fieldName, value);
                            // Guardar automáticamente el cambio
                            setTimeout(() => handleHistoricalCostSave(fieldName), 100);
                          }}
                          disabled={updateHistoricalCostMutation.isPending}
                        >
                          <SelectTrigger className="h-9 text-xs border-gray-200 focus:border-purple-400 focus:ring-purple-400/20">
                            <SelectValue placeholder="Tipo" />
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
                    return (
                      <div key={fieldName} className="space-y-2">
                        <label className="text-xs font-medium text-gray-600 block text-center">
                          {month.label} 2025
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
                          className="h-9 text-sm text-center border-gray-200 focus:border-green-400 focus:ring-green-400/20"
                          placeholder="0"
                          disabled={updateHistoricalCostMutation.isPending}
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
                    
                    return (
                      <div key={fieldName} className="space-y-2">
                        <label className="text-xs font-medium text-gray-600 block text-center">
                          {month.label} 2025
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
                            className="h-9 text-sm text-center border-gray-200 focus:border-blue-400 focus:ring-blue-400/20"
                            placeholder="0"
                            disabled={updateHistoricalCostMutation.isPending}
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