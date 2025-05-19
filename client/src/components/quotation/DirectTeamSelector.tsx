import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Users } from 'lucide-react';
import { parseDecimalInput } from '@/lib/number-utils';

// Interfaces para los datos
interface Role {
  id: number;
  name: string;
  description: string;
  defaultRate: number;
}

interface Personnel {
  id: number;
  name: string;
  roleId: number;
  hourlyRate: number;
}

interface TeamMember {
  id: string;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
  cost: number;
}

interface DirectTeamSelectorProps {
  onAddMember: (member: Omit<TeamMember, 'id'>) => void;
  existingMembers: TeamMember[];
}

const DirectTeamSelector: React.FC<DirectTeamSelectorProps> = ({ onAddMember, existingMembers }) => {
  // Estados locales
  const [roles, setRoles] = useState<Role[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Formulario de nuevo miembro
  const [newMember, setNewMember] = useState({
    roleId: 0,
    personnelId: null as number | null,
    hours: 10,
    rate: 0
  });

  // Cargar datos directamente desde la API
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Cargar roles
        const rolesResponse = await fetch('/api/roles');
        if (!rolesResponse.ok) {
          throw new Error(`Error al cargar roles: ${rolesResponse.status}`);
        }
        const rolesData = await rolesResponse.json();
        console.log('Roles cargados:', rolesData.length);
        setRoles(rolesData);
        
        // Cargar personal
        const personnelResponse = await fetch('/api/personnel');
        if (!personnelResponse.ok) {
          throw new Error(`Error al cargar personal: ${personnelResponse.status}`);
        }
        const personnelData = await personnelResponse.json();
        console.log('Personal cargado:', personnelData.length);
        setPersonnel(personnelData);
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Actualizar tarifa cuando cambia el rol seleccionado
  useEffect(() => {
    if (newMember.roleId > 0) {
      const selectedRole = roles.find(role => role.id === newMember.roleId);
      if (selectedRole) {
        setNewMember(prev => ({
          ...prev,
          rate: selectedRole.defaultRate
        }));
      }
    }
  }, [newMember.roleId, roles]);

  // Manejar la adición de nuevo miembro
  const handleAddMember = () => {
    if (newMember.roleId === 0) {
      alert('Por favor selecciona un rol');
      return;
    }
    
    if (newMember.hours <= 0) {
      alert('Las horas deben ser mayores a 0');
      return;
    }
    
    if (newMember.rate <= 0) {
      alert('La tarifa debe ser mayor a 0');
      return;
    }
    
    const cost = newMember.hours * newMember.rate;
    
    onAddMember({
      roleId: newMember.roleId,
      personnelId: newMember.personnelId,
      hours: newMember.hours,
      rate: newMember.rate,
      cost
    });
    
    // Limpiar el formulario pero mantener el rol seleccionado
    setNewMember(prev => ({
      ...prev,
      personnelId: null,
      hours: 10,
    }));
  };

  // Filtrar personal por rol seleccionado
  const filteredPersonnel = newMember.roleId > 0
    ? personnel.filter(person => person.roleId === newMember.roleId)
    : personnel;

  return (
    <div>
      <div className="bg-gray-50 p-4 rounded-md mb-4">
        <h3 className="text-sm font-medium mb-3">Añadir Miembro al Equipo</h3>
        
        {loading ? (
          <div className="text-sm text-gray-500">Cargando datos...</div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Selector de Rol */}
            <div>
              <Label htmlFor="direct-role-selector" className="text-xs mb-1 block">Rol</Label>
              <select
                id="direct-role-selector"
                className="w-full h-9 text-sm border border-gray-300 rounded-md px-2 py-1"
                value={newMember.roleId || ''}
                onChange={(e) => {
                  const roleId = parseInt(e.target.value);
                  setNewMember(prev => ({
                    ...prev,
                    roleId: isNaN(roleId) ? 0 : roleId,
                    personnelId: null
                  }));
                }}
              >
                <option value="">Seleccionar rol</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Selector de Personal */}
            <div>
              <Label htmlFor="direct-personnel-selector" className="text-xs mb-1 block">Personal</Label>
              <select
                id="direct-personnel-selector"
                className="w-full h-9 text-sm border border-gray-300 rounded-md px-2 py-1"
                value={newMember.personnelId || ''}
                onChange={(e) => {
                  const personnelId = parseInt(e.target.value);
                  setNewMember(prev => ({
                    ...prev,
                    personnelId: isNaN(personnelId) ? null : personnelId
                  }));
                }}
              >
                <option value="">Seleccionar personal</option>
                {filteredPersonnel.map(person => {
                  const role = roles.find(r => r.id === person.roleId);
                  return (
                    <option key={person.id} value={person.id}>
                      {person.name} {role ? `(${role.name})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            
            {/* Horas */}
            <div>
              <Label htmlFor="direct-hours-input" className="text-xs mb-1 block">Horas</Label>
              <Input
                id="direct-hours-input"
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
                className="h-9"
              />
            </div>
            
            {/* Tarifa */}
            <div>
              <Label htmlFor="direct-rate-input" className="text-xs mb-1 block">Tarifa ($/h)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="direct-rate-input"
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
        )}
        
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleAddMember}
            variant="default"
            size="sm"
            disabled={loading || newMember.roleId === 0 || newMember.hours <= 0 || newMember.rate <= 0}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Añadir
          </Button>
        </div>
      </div>
      
      {/* Lista de miembros del equipo */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center">
          <Users className="h-4 w-4 mr-1.5" />
          Equipo del Proyecto
        </h3>
        
        {existingMembers.length === 0 ? (
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
                {existingMembers.map(member => {
                  const role = roles.find(r => r.id === member.roleId);
                  const person = personnel.find(p => p.id === member.personnelId);
                  
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
                    ${existingMembers.reduce((sum, member) => sum + member.cost, 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectTeamSelector;