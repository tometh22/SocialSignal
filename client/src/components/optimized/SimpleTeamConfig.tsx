import React, { useState, useEffect } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Personnel, Role } from '@shared/schema';
import { parseDecimalInput } from '@/lib/number-utils';
import { Clock, UserPlus, Users, Edit, Check, X, Trash2 } from 'lucide-react';

const SimpleTeamConfig: React.FC = () => {
  const {
    quotationData,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    loadRoles,
    loadPersonnel,
    availableRoles,
    availablePersonnel,
    recommendedRoleIds
  } = useOptimizedQuote();

  // Estado local para el formulario de nuevo miembro
  const [newMember, setNewMember] = useState({
    roleId: 0,
    personnelId: null as number | null,
    hours: 10,
    rate: 0
  });

  // Estados para edición inline
  const [editingMember, setEditingMember] = useState<Record<string, {hours: number, rate: number}>>({});
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});

  // Cargar roles y personal al montar el componente
  useEffect(() => {
    // Cargar datos mediante llamada directa a la API
    const fetchData = async () => {
      try {

        // Primero intentamos usar las funciones proporcionadas por el contexto
        loadRoles();
        loadPersonnel();

        // Como respaldo, hacemos llamadas directas a la API
        const rolesResponse = await fetch('/api/roles');
        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json();
        }

        const personnelResponse = await fetch('/api/personnel');
        if (personnelResponse.ok) {
          const personnelData = await personnelResponse.json();
        }
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };

    fetchData();
  }, [loadRoles, loadPersonnel]);

  // Verificar si hay datos cargados
  useEffect(() => {

    if (availableRoles?.length) {
    }

    if (availablePersonnel?.length) {
    }
  }, [availableRoles, availablePersonnel]);

  // Actualizar tarifa cuando se selecciona un rol
  useEffect(() => {
    if (newMember.roleId > 0 && availableRoles) {
      const selectedRole = availableRoles.find(role => role.id === newMember.roleId);
      if (selectedRole) {
        setNewMember(prev => ({
          ...prev,
          rate: selectedRole.defaultRate
        }));
      }
    }
  }, [newMember.roleId, availableRoles]);

  // Verificar si un rol está recomendado
  const isRoleRecommended = (roleId: number) => {
    return recommendedRoleIds.includes(roleId);
  };

  const handleAddMember = () => {
    const selectedRole = availableRoles.find(r => r.id === newMember.roleId);
    const selectedPersonnel = newMember.personnelId 
      ? availablePersonnel.find(p => p.id === newMember.personnelId)
      : null;

    if (!selectedRole) {
      console.error('No role selected');
      return;
    }

    if (!newMember.hours || newMember.hours <= 0) {
      console.error('Hours must be greater than 0');
      return;
    }

    const rate = selectedPersonnel?.hourlyRate || selectedRole.defaultRate || 0;
    const hours = newMember.hours;
    const cost = hours * rate;

    console.log('Adding member with:', { 
      roleId: newMember.roleId, 
      personnelId: newMember.personnelId, 
      hours, 
      rate, 
      cost 
    });

    addTeamMember({
      roleId: newMember.roleId,
      personnelId: newMember.personnelId,
      hours: hours,
      rate: rate,
      cost: cost
    });

    // Reset form
    setNewMember({ roleId: 0, personnelId: null, hours: 10, rate: 0 });

    // Force recalculation
    setTimeout(() => {
      calculateTotalCost();
    }, 100);
  };

  // Funciones para edición inline
  const startEditing = (memberId: string, hours: number, rate: number) => {
    setEditingMember({
      ...editingMember, 
      [memberId]: { hours, rate }
    });
    setIsEditing({...isEditing, [memberId]: true});
  };

  const cancelEditing = (memberId: string) => {
    setIsEditing({...isEditing, [memberId]: false});
  };

  const saveEditing = (member: any) => {
    const memberId = String(member.id);
    if (editingMember[memberId]) {
      const hours = editingMember[memberId].hours;
      const rate = editingMember[memberId].rate;

      // VALIDACIÓN AUTOMÁTICA: Verificar si la tarifa editada coincide con la oficial
      if (member.personnelId && availablePersonnel) {
        const personnel = availablePersonnel.find(p => p.id === member.personnelId);
        if (personnel && personnel.hourlyRate !== rate) {
          const useOfficial = window.confirm(
            `⚠️ INCONSISTENCIA DE TARIFA DETECTADA\n\n` +
            `${personnel.name} tiene una tarifa oficial de $${personnel.hourlyRate}/hora\n` +
            `Pero estás intentando guardar $${rate}/hora\n\n` +
            `¿Deseas usar la tarifa oficial ($${personnel.hourlyRate}/hora)?`
          );

          if (useOfficial) {
            // Actualizar con la tarifa oficial
            setEditingMember({
              ...editingMember,
              [memberId]: { hours, rate: personnel.hourlyRate }
            });

            updateTeamMember(member.id, {
              ...member,
              hours,
              rate: personnel.hourlyRate,
              cost: hours * personnel.hourlyRate
            });
            setIsEditing({...isEditing, [memberId]: false});
            return;
          }
        }
      }

      // Proceder con la tarifa manual si el usuario lo confirma
      updateTeamMember(member.id, {
        ...member,
        hours,
        rate,
        cost: hours * rate
      });
      setIsEditing({...isEditing, [memberId]: false});
    }
  };

  const handleUpdateMember = (id: string, field: keyof any, value: any) => {
    const updates: Partial<any> = { [field]: value };

    // If updating hours or changing personnel, recalculate rate and cost
    if (field === 'hours' || field === 'personnelId') {
      const member = quotationData.teamMembers.find(m => m.id === id);
      if (member) {
        let rate = member.rate;

        if (field === 'personnelId') {
          const selectedPersonnel = value ? availablePersonnel.find(p => p.id === value) : null;
          const selectedRole = availableRoles.find(r => r.id === member.roleId);
          rate = selectedPersonnel?.hourlyRate || selectedRole?.defaultRate || 0;
          updates.rate = rate;
        }

        const hours = field === 'hours' ? value : member.hours;
        updates.cost = hours * rate;
      }
    }

    updateTeamMember(id, updates);

    // Force recalculation after a short delay
    setTimeout(() => {
      calculateTotalCost();
    }, 100);
  };

  const calculateTotalCost = () => {
    // Trigger a re-render or force recalculation of the total cost in the parent component
    // You might need to call a function from the context or update a state variable
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-white rounded-md border border-gray-200">
        <div className="flex items-center mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Configuración del Equipo</h2>
            <p className="text-xs text-neutral-500">
              Define los roles y personal que trabajarán en este proyecto
            </p>
          </div>
        </div>

        {/* Sección de Roles Recomendados */}
        {recommendedRoleIds && recommendedRoleIds.length > 0 && (
          <div className="bg-blue-50 rounded-md p-4 mb-4 border border-blue-200">
            <div className="mb-3">
              <h3 className="text-sm font-medium mb-2 text-blue-800 flex items-center">
                <UserPlus className="h-4 w-4 mr-2" />
                Equipo Recomendado para {quotationData.template?.name || 'este proyecto'}
              </h3>
              <p className="text-xs text-blue-600 mb-3">
                Estos roles son los más adecuados para este tipo de proyecto según nuestra experiencia.
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                {recommendedRoleIds.map(roleId => {
                  const role = availableRoles?.find(r => r.id === roleId);
                  return role ? (
                    <Badge key={roleId} variant="outline" className="bg-white border-blue-300 text-blue-700">
                      {role.name}
                    </Badge>
                  ) : null;
                })}
              </div>

              <Button 
                onClick={() => {
                  // Aplicar equipo recomendado - agregar cada rol recomendado
                  recommendedRoleIds.forEach(roleId => {
                    const role = availableRoles?.find(r => r.id === roleId);
                    if (role) {
                      addTeamMember({
                        roleId: role.id,
                        personnelId: null,
                        hours: 10, // Horas por defecto
                        rate: role.defaultRate,
                        cost: 10 * role.defaultRate
                      });
                    }
                  });
                }}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Aplicar Equipo Recomendado ({recommendedRoleIds.length} roles)
              </Button>
            </div>
          </div>
        )}

        <div className="bg-gray-50 rounded-md p-4 mb-4">
          <div className="mb-3">
            <h3 className="text-sm font-medium mb-2">Añadir Miembro al Equipo</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Selector de Rol */}
            <div>
              <Label htmlFor="role-selector" className="text-xs mb-1 inline-block">Rol</Label>
              <div className="relative">
                <select 
                  id="role-selector"
                  className="w-full h-9 text-xs border border-gray-300 rounded-md px-2 py-1 appearance-none bg-white"
                  value={newMember.roleId || 0}
                  onChange={(e) => {
                    const roleId = parseInt(e.target.value);

                    setNewMember(prev => ({
                      ...prev,
                      roleId: roleId,
                      personnelId: null
                    }));
                  }}
                >
                  <option value="0">Seleccionar rol</option>
                  {availableRoles && availableRoles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name} {isRoleRecommended(role.id) ? '(Recomendado)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selector de Personal */}
            <div>
              <Label htmlFor="personal-selector" className="text-xs mb-1 inline-block">Personal</Label>
              <div className="relative">
                <select 
                  id="personal-selector"
                  className="w-full h-9 text-xs border border-gray-300 rounded-md px-2 py-1 appearance-none bg-white"
                  value={newMember.personnelId || 0}
                  onChange={(e) => {
                    const personnelId = parseInt(e.target.value);

                    if (isNaN(personnelId) || personnelId === 0) {
                      setNewMember(prev => ({
                        ...prev,
                        personnelId: null
                      }));
                      return;
                    }


                    const selectedPerson = availablePersonnel?.find(p => p.id === personnelId);
                    if (!selectedPerson) {
                      return;
                    }


                    // Solo actualizar personal y tarifa, NO cambiar el rol automáticamente
                    const officialRate = selectedPerson.hourlyRate || 0;

                    setNewMember(prev => ({
                      ...prev,
                      personnelId,
                      rate: officialRate
                    }));
                  }}
                >
                  <option value="">Seleccionar personal</option>
                  {availablePersonnel && availablePersonnel
                    .filter(person => !newMember.roleId || person.roleId === newMember.roleId)
                    .map(person => {
                      const role = availableRoles?.find(r => r.id === person.roleId);
                      return (
                        <option key={person.id} value={person.id}>
                          {person.name} {role ? `(${role.name})` : ''}
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>

            {/* Horas */}
            <div>
              <Label htmlFor="hours-input" className="text-xs mb-1 inline-block">Horas</Label>
              <div className="relative">
                <div className="flex items-center">
                  <Clock className="h-3.5 w-3.5 absolute left-2.5 text-gray-500" />
                  <Input 
                    id="hours-input"
                    type="number" 
                    min="1"
                    value={newMember.hours}
                    onChange={(e) => {
                      const hours = parseInt(e.target.value);
                      setNewMember(prev => ({
                        ...prev,
                        hours: isNaN(hours) ? 0 : hours
                      }));
                    }}
                    className="h-9 pl-8"
                  />
                </div>
              </div>
            </div>

            {/* Tarifa */}
            <div>
              <Label htmlFor="rate-input" className="text-xs mb-1 inline-block">Tarifa ($/h)</Label>
              <div className="relative">
                <div className="flex items-center">
                  <span className="absolute left-3 text-gray-500">$</span>
                  <Input 
                    id="rate-input"
                    type="text" 
                    value={(newMember.rate || 0).toString()}
                    onChange={(e) => {
                      const value = parseDecimalInput(e.target.value);
                      setNewMember(prev => ({
                        ...prev,
                        rate: value
                      }));
                    }}
                    className="h-9 pl-7"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddMember();
              }}
              type="button"
              variant="default"
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Añadir
            </Button>
          </div>
        </div>

        {/* Equipo del Proyecto */}
        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center">
            <Users className="h-4 w-4 mr-1.5" />
            Equipo del Proyecto
          </h3>

          {quotationData.teamMembers.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-md">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-1">No hay miembros en el equipo</p>
              <p className="text-xs text-gray-400">
                Utiliza el formulario anterior para añadir miembros al equipo del proyecto.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse table-fixed">
                <colgroup>
                  <col className="w-[35%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[20%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 border-b">Rol / Personal</th>
                    <th className="text-center p-2 border-b">Horas</th>
                    <th className="text-center p-2 border-b">Tarifa</th>
                    <th className="text-right p-2 border-b">Costo</th>
                    <th className="text-center p-2 border-b">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {quotationData.teamMembers.map(member => {
                    const role = availableRoles?.find(r => r.id === member.roleId);
                    const person = availablePersonnel?.find(p => p.id === member.personnelId);
                    const memberId = String(member.id);
                    const isCurrentlyEditing = isEditing[memberId];

                    return (
                      <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2">
                          <div className="font-medium">{role?.name || 'Rol no especificado'}</div>
                          {person && <div className="text-gray-500 text-xs">{person.name}</div>}
                        </td>

                        {/* Horas - editable */}
                        <td className="p-2 text-center">
                          {isCurrentlyEditing ? (
                            <div className="flex justify-center">
                              <Input
                                type="number"
                                min="1"
                                value={editingMember[memberId]?.hours || member.hours}
                                onChange={(e) => {
                                  const hours = parseInt(e.target.value) || 0;
                                  setEditingMember({
                                    ...editingMember,
                                    [memberId]: {
                                      ...editingMember[memberId],
                                      hours
                                    }
                                  });
                                }}
                                className="h-7 w-full max-w-[60px] text-center text-xs"
                              />
                            </div>
                          ) : (
                            <span>{member.hours}</span>
                          )}
                        </td>

                        {/* Tarifa - editable */}
                        <td className="p-2 text-center">
                          {isCurrentlyEditing ? (
                            <div className="flex justify-center">
                              <div className="relative w-full max-w-[70px]">
                                <span className="absolute left-2 top-1 text-gray-500 text-xs">$</span>
                                <Input
                                  type="text"
                                  value={String(editingMember[memberId]?.rate || member.rate)}
                                  onChange={(e) => {
                                    const rate = parseDecimalInput(e.target.value);
                                    setEditingMember({
                                      ...editingMember,
                                      [memberId]: {
                                        ...editingMember[memberId],
                                        rate
                                      }
                                    });
                                  }}
                                  className="h-7 w-full text-center text-xs pl-4"
                                />
                              </div>
                            </div>
                          ) : (
                            <span>${member.rate}</span>
                          )}
                        </td>

                        {/* Costo calculado */}
                        <td className="p-2 text-right font-medium">
                          {isCurrentlyEditing ? (
                            <span>
                              ${((editingMember[memberId]?.hours || member.hours) * 
                                 (editingMember[memberId]?.rate || member.rate)).toFixed(2)}
                            </span>
                          ) : (
                            <span>${member.cost.toFixed(2)}</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isCurrentlyEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => saveEditing(member)}
                                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cancelEditing(memberId)}
                                  className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditing(memberId, member.hours, member.rate)}
                                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeTeamMember(member.id)}
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-medium">
                    <td colSpan={4} className="p-2 text-right">Total:</td>
                    <td className="p-2 text-right">
                      ${quotationData.teamMembers.reduce((sum, member) => sum + member.cost, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SimpleTeamConfig;