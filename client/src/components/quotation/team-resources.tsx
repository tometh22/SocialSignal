import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQuoteContext } from "@/context/quote-context";
import { Role, Personnel } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import CostBreakdown from "./cost-breakdown";
import { cn } from "@/lib/utils";

export default function TeamResources({ onPrevious, onNext }: { onPrevious: () => void; onNext: () => void }) {
  const { toast } = useToast();
  const {
    teamMembers,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    calculateTotalCost
  } = useQuoteContext();
  
  // Estado para controlar la opción de cotización: "roles" o "miembros"
  const [quoteOption, setQuoteOption] = useState<"roles" | "team">("roles");

  // Get roles and personnel from API
  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: allPersonnel } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  // Update cost calculations when team members change
  useEffect(() => {
    calculateTotalCost();
  }, [teamMembers, calculateTotalCost]);

  // Helper to get personnel options by role
  const getPersonnelByRole = (roleId: number) => {
    if (!allPersonnel) return [];
    return allPersonnel.filter(person => person.roleId === roleId);
  };

  // Helper to get role name
  const getRoleName = (roleId: number) => {
    if (!roles) return "";
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : "";
  };

  // Helper to get default rate for a role
  const getRoleDefaultRate = (roleId: number) => {
    if (!roles) return 0;
    const role = roles.find(r => r.id === roleId);
    return role ? role.defaultRate : 0;
  };

  // Helper to get personnel hourly rate
  const getPersonnelRate = (personnelId: number) => {
    if (!allPersonnel) return 0;
    const person = allPersonnel.find(p => p.id === personnelId);
    return person ? person.hourlyRate : 0;
  };

  // Toggle role selection
  const toggleRoleSelection = (roleId: number, selected: boolean) => {
    if (selected) {
      // Check if this role is already in team members
      const existingMember = teamMembers.find(member => member.roleId === roleId);
      if (!existingMember) {
        // Add new team member with this role
        addTeamMember({
          roleId,
          personnelId: null,
          hours: 10, // Default hours
          rate: getRoleDefaultRate(roleId),
          cost: 10 * getRoleDefaultRate(roleId)
        });
      }
    } else {
      // Remove all team members with this role
      teamMembers
        .filter(member => member.roleId === roleId)
        .forEach(member => removeTeamMember(member.id));
    }
  };

  // Handle personnel selection
  const handlePersonnelChange = (memberId: string, personnelId: number) => {
    const rate = getPersonnelRate(personnelId);
    const member = teamMembers.find(m => m.id === memberId);
    
    if (member) {
      updateTeamMember(memberId, {
        ...member,
        personnelId,
        rate,
        cost: member.hours * rate
      });
    }
  };

  // Handle hours change
  const handleHoursChange = (memberId: string, hours: number) => {
    const member = teamMembers.find(m => m.id === memberId);
    
    if (member) {
      updateTeamMember(memberId, {
        ...member,
        hours,
        cost: hours * member.rate
      });
    }
  };

  // Check if form is valid
  const validateForm = () => {
    if (teamMembers.length === 0) {
      toast({
        title: "Equipo Requerido",
        description: "Por favor, selecciona al menos un rol para el equipo.",
        variant: "destructive",
      });
      return false;
    }

    // Si estamos cotizando por roles, no necesitamos verificar personal asignado
    if (quoteOption === "roles") {
      return true;
    }

    // Solo verificamos el personal si estamos cotizando por miembros del equipo
    if (quoteOption === "team") {
      // Check if all team members have personnel assigned
      const missingPersonnel = teamMembers.some(member => member.personnelId === null);
      if (missingPersonnel) {
        toast({
          title: "Miembro del Equipo Requerido",
          description: "Por favor, asigna un miembro del equipo a cada rol seleccionado.",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  // Handle continue button click
  const handleContinue = () => {
    if (validateForm()) {
      calculateTotalCost();
      onNext();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-semibold text-neutral-900 mb-6">Equipo y Recursos</h3>
      
      {/* Opciones de cotización */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-neutral-800 mb-4">Tipo de Cotización</h4>
        <p className="text-sm text-neutral-600 mb-4">Elige cómo quieres cotizar este proyecto:</p>
        
        <div className="flex space-x-4 mb-6">
          <Button
            type="button"
            variant={quoteOption === "roles" ? "default" : "outline"}
            onClick={() => setQuoteOption("roles")}
            className="flex-1"
          >
            Por Roles (Tarifas Estándar)
          </Button>
          <Button
            type="button"
            variant={quoteOption === "team" ? "default" : "outline"}
            onClick={() => setQuoteOption("team")}
            className="flex-1"
          >
            Por Miembros Específicos
          </Button>
        </div>
      </div>
      
      {/* Team roles selection */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-neutral-800 mb-4">Roles del Equipo</h4>
        <p className="text-sm text-neutral-600 mb-4">
          {quoteOption === "roles" 
            ? "Selecciona los roles necesarios para este proyecto y especifica las horas estimadas."
            : "Selecciona los roles y asigna miembros específicos del equipo para este proyecto."}
        </p>
        
        <div className="space-y-4">
          {roles?.map(role => {
            // Check if this role is currently selected
            const isSelected = teamMembers.some(member => member.roleId === role.id);
            
            // Find the team member for this role if it exists
            const teamMember = teamMembers.find(member => member.roleId === role.id);
            
            return (
              <div
                key={role.id}
                className={cn(
                  "card-select p-4 border border-neutral-300 rounded-lg hover:bg-neutral-50 cursor-pointer",
                  isSelected && "selected"
                )}
                onClick={() => toggleRoleSelection(role.id, !isSelected)}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleRoleSelection(role.id, !!checked)}
                      className="h-5 w-5"
                    />
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="text-base font-medium text-neutral-800">{role.name}</h5>
                      <span className="text-sm font-mono text-neutral-600">${role.defaultRate.toFixed(2)}/hr</span>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1">{role.description}</p>
                    
                    {isSelected && teamMember && (
                      <div className={`mt-3 grid ${quoteOption === "team" ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
                        <div>
                          <Label className="block text-sm font-medium text-neutral-700 mb-1">Horas Estimadas</Label>
                          <Input
                            type="number"
                            min="1"
                            value={teamMember.hours}
                            onChange={(e) => handleHoursChange(teamMember.id, parseInt(e.target.value) || 0)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full"
                          />
                        </div>
                        
                        {quoteOption === "team" && (
                          <div>
                            <Label className="block text-sm font-medium text-neutral-700 mb-1">Miembro del Equipo</Label>
                            <Select
                              value={teamMember.personnelId?.toString() || ""}
                              onValueChange={(value) => handlePersonnelChange(teamMember.id, parseInt(value))}
                            >
                              <SelectTrigger
                                onClick={(e) => e.stopPropagation()}
                                className="w-full"
                              >
                                <SelectValue placeholder="Seleccionar miembro" />
                              </SelectTrigger>
                              <SelectContent>
                                {getPersonnelByRole(role.id).map(person => (
                                  <SelectItem key={person.id} value={person.id.toString()}>
                                    {person.name} (${person.hourlyRate.toFixed(2)}/hr)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
        <Button type="button" variant="outline" onClick={onPrevious} className="flex items-center">
          <span className="material-icons mr-1">arrow_back</span>
          Atrás
        </Button>
        
        <Button type="button" onClick={handleContinue} className="flex items-center">
          Continuar
          <span className="material-icons ml-1">arrow_forward</span>
        </Button>
      </div>

      {/* Cost breakdown */}
      <div className="mt-6">
        <CostBreakdown teamMembers={teamMembers} />
      </div>
    </div>
  );
}
