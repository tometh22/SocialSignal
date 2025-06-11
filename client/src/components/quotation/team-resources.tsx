import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQuoteContext, TeamMember } from "@/context/quote-context";
import { Role, Personnel } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import CostBreakdown from "./cost-breakdown";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

export default function TeamResources({ onPrevious, onNext }: { onPrevious: () => void; onNext: () => void }) {
  const { toast } = useToast();
  const {
    teamMembers,
    recommendedRoleIds,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    setTeamMembers, // Importamos explícitamente esta función 
    calculateTotalCost,
    quoteOption,
    updateQuoteOption,
    addRecommendedRoles,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount
  } = useQuoteContext();

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
    } else {
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
            onClick={() => updateQuoteOption("roles")}
            className="flex-1"
          >
            Por Roles (Tarifas Estándar)
          </Button>
          <Button
            type="button"
            variant={quoteOption === "team" ? "default" : "outline"}
            onClick={() => updateQuoteOption("team")}
            className="flex-1"
          >
            Por Miembros Específicos
          </Button>
        </div>
      </div>
      
      {/* Team roles or personnel selection */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-neutral-800 mb-4">
          {quoteOption === "roles" ? "Roles del Equipo" : "Miembros del Equipo"}
        </h4>
        <p className="text-sm text-neutral-600 mb-4">
          {quoteOption === "roles" 
            ? "Selecciona los roles necesarios para este proyecto y especifica las horas estimadas."
            : "Selecciona personas específicas para este proyecto y ajusta sus horas y tarifas."}
        </p>
        
        {quoteOption === "team" && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <h5 className="text-base font-medium text-blue-700">Modo de cotización personalizada</h5>
            <p className="text-sm text-blue-600 mt-1">
              Estás en modo de selección de miembros específicos. Selecciona directamente las personas que 
              trabajarán en el proyecto y ajusta sus tarifas individuales según sea necesario.
            </p>
          </div>
        )}
        
        {quoteOption === "roles" && recommendedRoleIds.length > 0 && teamMembers.length === 0 && (
          <div className="mb-4">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-3">
              <h5 className="text-base font-medium text-blue-700">Roles Recomendados Disponibles</h5>
              <p className="text-sm text-blue-600 mt-1">
                Basado en la plantilla seleccionada, tenemos {recommendedRoleIds.length} roles recomendados para este proyecto.
              </p>
            </div>
            <Button 
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                addRecommendedRoles();
                toast({
                  title: "Roles Recomendados Aplicados",
                  description: `Se han añadido ${recommendedRoleIds.length} roles recomendados a tu equipo.`,
                });
              }}
            >
              <span className="mr-1">✓</span>
              Aplicar Roles Recomendados
            </Button>
          </div>
        )}

        {/* VISTA DE ROLES - Muestra la lista de roles disponibles */}
        {quoteOption === "roles" && (
          <div className="space-y-4">
            {roles?.map(role => {
              // Check if this role is currently selected
              const isSelected = teamMembers.some(member => member.roleId === role.id);
              
              // Check if this role is recommended
              const isRecommended = recommendedRoleIds.includes(role.id);
              
              // Debugging: log recomendaciones para este rol
              
              // Find the team member for this role if it exists
              const teamMember = teamMembers.find(member => member.roleId === role.id);
              
              return (
                <div
                  key={role.id}
                  className={cn(
                    "card-select p-4 border rounded-lg hover:bg-neutral-50 cursor-pointer transition-all",
                    isSelected ? "selected border-green-400 bg-green-50 hover:bg-green-50" : "border-neutral-300",
                    isRecommended && !isSelected && "border-blue-400 border-dashed border-2"
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
                        <div className="flex items-center">
                          <h5 className="text-base font-medium text-neutral-800">{role.name}</h5>
                          {isRecommended && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Recomendado
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-mono text-neutral-600">${role.defaultRate.toFixed(2)}/hr</span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">{role.description}</p>
                      
                      {isSelected && teamMember && (
                        <div className="mt-3">
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
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VISTA DE MIEMBROS ESPECÍFICOS */}
        {quoteOption === "team" && (
          <>
            {/* Botón para agregar miembro personalizado */}
            <div className="mb-4">
              <Button 
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center border-dashed border-2"
                onClick={(e) => {
                  e.preventDefault();
                  // Abre un diálogo o modal para crear un nuevo miembro personalizado
                  if (roles && roles.length > 0) {
                    const defaultRole = roles[0];
                    addTeamMember({
                      roleId: defaultRole.id,
                      personnelId: null,
                      hours: 10,
                      rate: defaultRole.defaultRate,
                      cost: 10 * defaultRole.defaultRate
                    });
                    toast({
                      title: "Miembro Personalizado Añadido",
                      description: "Se ha añadido un nuevo miembro al equipo. Personaliza sus detalles.",
                    });
                  }
                }}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="mr-2"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Agregar Miembro Personalizado
              </Button>
            </div>

            {/* Lista de personal disponible por rol */}
            <div className="space-y-6">
              {roles?.map(role => (
                <div key={role.id} className="bg-neutral-50 p-4 rounded-lg">
                  <h4 className="text-base font-medium text-neutral-800 mb-2">
                    Personal del rol: {role.name}
                  </h4>
                  
                  <div className="space-y-3 mt-4">
                    {getPersonnelByRole(role.id).length > 0 ? (
                      getPersonnelByRole(role.id).map(person => {
                        // Check if this person is currently selected
                        const isSelected = teamMembers.some(member => 
                          member.personnelId === person.id && member.roleId === role.id
                        );
                        
                        // Find the team member for this person if it exists
                        const teamMember = teamMembers.find(member => 
                          member.personnelId === person.id && member.roleId === role.id
                        );
                        
                        return (
                          <div
                            key={person.id}
                            className={cn(
                              "p-3 border rounded-lg cursor-pointer transition-all",
                              isSelected 
                                ? "border-green-400 bg-green-50 hover:bg-green-50" 
                                : "border-neutral-300 hover:bg-neutral-100"
                            )}
                            onClick={() => {
                              if (isSelected) {
                                // Remove this person
                                if (teamMember) {
                                  removeTeamMember(teamMember.id);
                                }
                              } else {
                                // Add this person
                                addTeamMember({
                                  roleId: role.id,
                                  personnelId: person.id,
                                  hours: 10, // Default hours
                                  rate: person.hourlyRate,
                                  cost: 10 * person.hourlyRate
                                });
                              }
                            }}
                          >
                            <div className="flex items-start">
                              <div className="flex-shrink-0">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    if (checked && !isSelected) {
                                      // Add this person
                                      addTeamMember({
                                        roleId: role.id,
                                        personnelId: person.id,
                                        hours: 10, // Default hours
                                        rate: person.hourlyRate,
                                        cost: 10 * person.hourlyRate
                                      });
                                    } else if (!checked && isSelected && teamMember) {
                                      // Remove this person
                                      removeTeamMember(teamMember.id);
                                    }
                                  }}
                                  className="h-5 w-5"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="ml-3 flex-1">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-base font-medium text-neutral-800">{person.name}</h5>
                                  <span className="text-sm font-mono text-neutral-600">${person.hourlyRate.toFixed(2)}/hr</span>
                                </div>
                                
                                {isSelected && teamMember && (
                                  <div className="mt-3 grid grid-cols-2 gap-4">
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
                                    <div>
                                      <Label className="block text-sm font-medium text-neutral-700 mb-1">Tarifa Aplicada</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={teamMember.rate}
                                        onChange={(e) => {
                                          const newRate = parseFloat(e.target.value) || 0;
                                          updateTeamMember(teamMember.id, {
                                            ...teamMember,
                                            rate: newRate,
                                            cost: teamMember.hours * newRate
                                          });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full text-right"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 border border-neutral-300 rounded-lg text-neutral-500 text-sm">
                        No hay personal disponible para este rol
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      <div className="pt-4 border-t border-neutral-200">
        <div className="flex items-center justify-between mb-4">
          <Button type="button" variant="outline" onClick={onPrevious} className="flex items-center">
            <span className="mr-1">←</span>
            Atrás
          </Button>

          <div className="flex gap-3">
            {recommendedRoleIds.length > 0 && teamMembers.length === 0 && (
              <Button
                type="button"
                variant="outline"
                className="bg-blue-600 border-blue-300 text-white hover:bg-blue-700 shadow-sm font-medium"
                onClick={() => {
                  
                  try {
                    // Implementación directa para añadir roles recomendados
                    if (!roles || roles.length === 0) {
                      console.error("No hay roles disponibles");
                      toast({
                        title: "Error",
                        description: "No hay roles disponibles en el sistema",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    if (!recommendedRoleIds || recommendedRoleIds.length === 0) {
                      console.error("No hay roles recomendados para esta plantilla");
                      toast({
                        title: "Sin roles recomendados",
                        description: "Esta plantilla no tiene roles recomendados definidos",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    // Obtener roles únicos
                    const uniqueRoleIds = Array.from(new Set(recommendedRoleIds));
                    
                    // Crear array de nuevos miembros
                    const newTeamMembers: TeamMember[] = [];
                    
                    uniqueRoleIds.forEach(roleId => {
                      const role = roles.find(r => r.id === roleId);
                      
                      if (!role) {
                        console.warn(`Rol ID ${roleId} no encontrado`);
                        return;
                      }
                      
                      // Usar 40 horas por defecto
                      const hours = 40;
                      
                      newTeamMembers.push({
                        id: uuidv4(),
                        roleId: role.id,
                        personnelId: null,
                        hours: hours,
                        rate: role.defaultRate,
                        cost: hours * role.defaultRate
                      });
                    });
                    
                    // Actualizar miembros del equipo
                    if (setTeamMembers) {
                      // Primero limpiamos
                      setTeamMembers([]);
                      // Luego añadimos los nuevos
                      setTeamMembers(newTeamMembers);
                    } else {
                      console.error("setTeamMembers no está disponible");
                    }
                    
                    
                    // Recalcular costos
                    calculateTotalCost();
                    
                    // Mensaje al usuario
                    toast({
                      title: "Roles Recomendados Añadidos",
                      description: `Se han añadido ${newTeamMembers.length} roles recomendados a tu equipo.`,
                    });
                  } catch (error) {
                    console.error("Error al aplicar roles recomendados:", error);
                    toast({
                      title: "Error al aplicar roles",
                      description: "Ocurrió un error al aplicar los roles recomendados",
                      variant: "destructive"
                    });
                  }
                }}
              >
                <span className="mr-1">✓</span>
                Aplicar {recommendedRoleIds.length} Roles Recomendados
              </Button>
            )}
            <Button 
              type="button" 
              onClick={handleContinue} 
              className="flex items-center bg-primary text-white hover:bg-primary/90 font-medium"
            >
              Continuar
              <span className="ml-1">→</span>
            </Button>
          </div>
        </div>
        
        {recommendedRoleIds.length > 0 && teamMembers.length === 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <h5 className="text-base font-medium text-blue-700">Roles Recomendados Disponibles</h5>
            <p className="text-sm text-blue-600 mt-1">
              Hay {recommendedRoleIds.length} roles recomendados para este proyecto basados en la plantilla seleccionada.
              Puedes aplicarlos automáticamente o configurar el equipo manualmente.
            </p>
          </div>
        )}
      </div>

      {/* Cost breakdown */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-neutral-800">Estimación Preliminar de Costos</h3>
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Actualizado
            </span>
          </div>
        </div>

        {/* Costos detallados */}
        <div className="mb-6">
          <h4 className="text-base font-medium text-neutral-700 mb-3">Desglose de Costos del Equipo</h4>
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Rol</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {quoteOption === "team" ? "Miembro del Equipo" : "No asignado"}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Tarifa</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Horas</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Costo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {teamMembers.map(member => {
                  // Encontrar datos del personal/rol
                  const roleName = getRoleName(member.roleId);
                  const personnelName = member.personnelId 
                    ? allPersonnel?.find(p => p.id === member.personnelId)?.name || "No asignado" 
                    : "No asignado";
                  
                  return (
                    <tr key={member.id}>
                      <td className="px-4 py-2 text-sm text-neutral-900">{roleName}</td>
                      <td className="px-4 py-2 text-sm text-neutral-900">
                        {quoteOption === "team" 
                          ? personnelName 
                          : <span className="text-neutral-400">No asignado</span>}
                      </td>
                      <td className="px-4 py-2 text-sm text-neutral-900">${member.rate.toFixed(2)}/hr</td>
                      <td className="px-4 py-2 text-sm text-neutral-900">{member.hours}</td>
                      <td className="px-4 py-2 text-sm font-medium text-neutral-900 flex justify-between items-center">
                        <span>${member.cost.toFixed(2)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            removeTeamMember(member.id);
                            toast({
                              title: "Miembro Eliminado",
                              description: "El miembro del equipo ha sido eliminado de la cotización.",
                            });
                          }}
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                          </svg>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-neutral-50 font-medium">
                  <td colSpan={4} className="px-4 py-2 text-sm text-right">Costo Base Total</td>
                  <td className="px-4 py-2 text-sm">${baseCost.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen de costos */}
        <div className="mb-6">
          <h4 className="text-base font-medium text-neutral-700 mb-3">Desglose de Cotización</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
              <div className="flex justify-between items-center">
                <h5 className="text-sm font-medium text-neutral-700">Costo Base (Horas de Equipo)</h5>
                <p className="text-lg font-mono font-semibold">${baseCost.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
              <div className="flex justify-between items-center">
                <h5 className="text-sm font-medium text-neutral-700">
                  Ajustes por Complejidad {complexityAdjustment > 0 && `(+${(complexityAdjustment/baseCost*100).toFixed(0)}%)`}
                </h5>
                <p className="text-lg font-mono font-semibold">${complexityAdjustment.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
              <div className="flex justify-between items-center">
                <h5 className="text-sm font-medium text-neutral-700">Costo Base Ajustado</h5>
                <p className="text-lg font-mono font-semibold">${(baseCost + complexityAdjustment).toFixed(2)}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
              <div className="flex justify-between items-center">
                <h5 className="text-sm font-medium text-neutral-700">Margen Estándar (2×)</h5>
                <p className="text-lg font-mono font-semibold">${markupAmount.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="col-span-2 bg-primary bg-opacity-10 p-4 rounded-lg border border-primary shadow-sm">
              <div className="flex justify-between items-center">
                <h5 className="text-base font-medium text-primary">Cotización Total</h5>
                <p className="text-xl font-mono font-semibold text-primary">${totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}