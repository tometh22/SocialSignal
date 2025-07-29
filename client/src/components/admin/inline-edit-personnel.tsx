
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Edit, Check, X, Loader2, Trash2, HelpCircle } from "lucide-react";
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
  };
  roles: any[];
}

export default function InlineEditPersonnel({ person, roles }: InlineEditPersonnelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editedName, setEditedName] = useState(person.name);
  const [editedEmail, setEditedEmail] = useState(person.email);
  const [editedRoleId, setEditedRoleId] = useState(person.roleId.toString());
  const [editedHourlyRate, setEditedHourlyRate] = useState(person.hourlyRate.toString());
  const [editedContractType, setEditedContractType] = useState(person.contractType || 'full-time');
  const [editedMonthlyFixedSalary, setEditedMonthlyFixedSalary] = useState(person.monthlyFixedSalary?.toString() || '');
  const [editedIncludeInRealCosts, setEditedIncludeInRealCosts] = useState(person.includeInRealCosts ?? true);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updatePersonnelMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      email: string; 
      roleId: number; 
      hourlyRate: number;
      contractType: string;
      monthlyFixedSalary?: number;
      includeInRealCosts: boolean;
    }) => {
      return apiRequest(`/api/personnel/${person.id}`, "PATCH", data);
    },
    onSuccess: (updatedPerson) => {
      // Actualizar los valores locales inmediatamente
      setEditedName(updatedPerson.name);
      setEditedEmail(updatedPerson.email);
      setEditedRoleId(updatedPerson.roleId.toString());
      setEditedHourlyRate(updatedPerson.hourlyRate.toString());

      // Actualizar cache de forma optimista
      queryClient.setQueryData(["/api/personnel"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((p: any) => 
          p.id === person.id ? {
            ...updatedPerson,
            roleName: roles.find(r => r.id === updatedPerson.roleId)?.name || updatedPerson.roleName
          } : p
        );
      });

      // Invalidar queries para forzar actualización
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });

      toast({
        title: "Éxito",
        description: "Personal actualizado correctamente"
      });
      setIsEditing(false);
    },
    onError: (err) => {
      console.error("Error updating personnel:", err);
      toast({
        title: "Error",
        description: "No se pudo actualizar el personal",
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

  const handleSave = () => {
    const hourlyRate = parseFloat(editedHourlyRate);
    const roleId = parseInt(editedRoleId);

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

    updatePersonnelMutation.mutate({
      name: editedName.trim(),
      email: editedEmail.trim(),
      roleId: roleId,
      hourlyRate: hourlyRate,
      contractType: editedContractType,
      monthlyFixedSalary: editedMonthlyFixedSalary ? parseFloat(editedMonthlyFixedSalary) : undefined,
      includeInRealCosts: editedIncludeInRealCosts
    });
  };

  const handleCancel = () => {
    setEditedName(person.name);
    setEditedEmail(person.email);
    setEditedRoleId(person.roleId.toString());
    setEditedHourlyRate(person.hourlyRate.toString());
    setEditedContractType(person.contractType || 'full-time');
    setEditedMonthlyFixedSalary(person.monthlyFixedSalary?.toString() || '');
    setEditedIncludeInRealCosts(person.includeInRealCosts ?? true);
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
            <SelectTrigger className="h-9 border-blue-200 focus:border-blue-400">
              <SelectValue placeholder="Seleccionar rol" />
            </SelectTrigger>
            <SelectContent>
              {roles?.map((role: any) => (
                <SelectItem key={role.id} value={role.id.toString()}>
                  {role.name}
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
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="part-time">Part-time</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
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
            <span className="text-sm font-medium text-gray-600">$</span>
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
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={editedMonthlyFixedSalary}
              onChange={(e) => setEditedMonthlyFixedSalary(e.target.value)}
              className="h-9 w-28 border-blue-200 focus:border-blue-400"
              disabled={updatePersonnelMutation.isPending || editedContractType !== 'full-time'}
              placeholder="0.00"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Sueldo fijo mensual para empleados full-time. Este es un costo de oportunidad 
                    (no se resta de las ganancias reales). Solo habilitado para contratos Full-time.
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
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="px-6 py-4">
        <div className="font-medium text-gray-900">{person.name}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-muted-foreground">{person.email}</div>
      </td>
      <td className="px-6 py-4">
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
          {person.roleName}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full font-medium">
          {person.contractType === 'full-time' ? 'Full-time' : 
           person.contractType === 'part-time' ? 'Part-time' : 
           person.contractType === 'freelance' ? 'Freelance' : 'Full-time'}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-green-700">${person.hourlyRate.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">/hr</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          {person.contractType === 'full-time' && person.monthlyFixedSalary ? (
            <>
              <span className="text-sm font-semibold text-blue-700">${person.monthlyFixedSalary.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">/mes</span>
            </>
          ) : (
            <span className="text-xs text-gray-400">-</span>
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
  );
}
