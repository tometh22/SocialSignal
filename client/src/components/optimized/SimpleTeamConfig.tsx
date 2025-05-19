import React, { useState, useEffect } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Personnel, Role } from '@shared/schema';
import { parseDecimalInput } from '@/lib/number-utils';
import { Clock, UserPlus, Users } from 'lucide-react';

const SimpleTeamConfig: React.FC = () => {
  const {
    quotationData,
    addTeamMember,
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

  // Cargar roles y personal al montar el componente
  useEffect(() => {
    // Cargar datos mediante llamada directa a la API
    const fetchData = async () => {
      try {
        console.log("Cargando roles y personal directamente desde la API...");
        
        // Primero intentamos usar las funciones proporcionadas por el contexto
        loadRoles();
        loadPersonnel();
        
        // Como respaldo, hacemos llamadas directas a la API
        const rolesResponse = await fetch('/api/roles');
        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json();
          console.log("Roles cargados directamente:", rolesData.length);
        }
        
        const personnelResponse = await fetch('/api/personnel');
        if (personnelResponse.ok) {
          const personnelData = await personnelResponse.json();
          console.log("Personal cargado directamente:", personnelData.length);
        }
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    
    fetchData();
  }, [loadRoles, loadPersonnel]);

  // Verificar si hay datos cargados
  useEffect(() => {
    console.log("Roles disponibles en el contexto:", availableRoles?.length || 0);
    console.log("Personal disponible en el contexto:", availablePersonnel?.length || 0);
    
    if (availableRoles?.length) {
      console.log("Ejemplo de rol:", availableRoles[0]);
    }
    
    if (availablePersonnel?.length) {
      console.log("Ejemplo de personal:", availablePersonnel[0]);
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

  // Manejar la adición de nuevo miembro
  const handleAddMember = () => {
    // Validación
    if (newMember.roleId <= 0 || newMember.hours <= 0 || newMember.rate <= 0) {
      alert("Por favor completa todos los campos requeridos");
      return;
    }
    
    // Añadir miembro
    addTeamMember({
      roleId: newMember.roleId,
      personnelId: newMember.personnelId,
      hours: newMember.hours,
      rate: newMember.rate,
      cost: newMember.hours * newMember.rate
    });
    
    // Limpiar formulario pero mantener el rol seleccionado
    setNewMember(prev => ({
      ...prev,
      personnelId: null,
      hours: 10
    }));
  };

  return (
    <div className="h-[600px] overflow-y-auto pr-2">
      <Card className="p-4 bg-white rounded-md border border-gray-200 mb-4">
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
                  value={newMember.roleId || ''}
                  onChange={(e) => {
                    const roleId = parseInt(e.target.value);
                    console.log("Rol seleccionado:", roleId);
                    
                    setNewMember(prev => ({
                      ...prev,
                      roleId: roleId,
                      personnelId: null
                    }));
                  }}
                >
                  <option value="">Seleccionar rol</option>
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
                  value={newMember.personnelId || ''}
                  onChange={(e) => {
                    const personnelId = parseInt(e.target.value);
                    
                    if (isNaN(personnelId)) {
                      setNewMember(prev => ({
                        ...prev,
                        personnelId: null
                      }));
                      return;
                    }
                    
                    console.log("Personal seleccionado ID:", personnelId);
                    
                    const selectedPerson = availablePersonnel?.find(p => p.id === personnelId);
                    if (!selectedPerson) {
                      console.log("No se encontró el personal seleccionado");
                      return;
                    }
                    
                    console.log("Personal seleccionado:", selectedPerson);
                    
                    const roleId = selectedPerson.roleId || 0;
                    const role = availableRoles?.find(r => r.id === roleId);
                    
                    console.log("Rol detectado:", role);
                    
                    setNewMember(prev => ({
                      ...prev,
                      personnelId,
                      roleId,
                      rate: role?.defaultRate || 0
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
                    value={newMember.rate.toString()}
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
              onClick={handleAddMember}
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
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 border-b">Rol / Personal</th>
                    <th className="text-center p-2 border-b">Horas</th>
                    <th className="text-center p-2 border-b">Tarifa</th>
                    <th className="text-right p-2 border-b">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {quotationData.teamMembers.map(member => {
                    const role = availableRoles?.find(r => r.id === member.roleId);
                    const person = availablePersonnel?.find(p => p.id === member.personnelId);
                    
                    return (
                      <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2">
                          <div className="font-medium">{role?.name || 'Rol no especificado'}</div>
                          {person && <div className="text-gray-500 text-xs">{person.name}</div>}
                        </td>
                        <td className="p-2 text-center">{member.hours}</td>
                        <td className="p-2 text-center">${member.rate}</td>
                        <td className="p-2 text-right font-medium">${member.cost.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-medium">
                    <td colSpan={3} className="p-2 text-right">Total:</td>
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