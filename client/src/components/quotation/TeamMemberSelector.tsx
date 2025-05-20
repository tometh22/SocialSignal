import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { v4 as uuidv4 } from 'uuid';

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

interface TeamMemberSelectorProps {
  onAddMember: (member: Omit<TeamMember, 'id'>) => void;
  existingMembers: TeamMember[];
}

const TeamMemberSelector: React.FC<TeamMemberSelectorProps> = ({ onAddMember, existingMembers }) => {
  // Estados locales
  const [roles, setRoles] = useState<Role[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para el modo de selección (por rol o por personal)
  const [selectionMode, setSelectionMode] = useState<'role' | 'personnel'>('role');
  
  // Formulario de nuevo miembro
  const [selectedRole, setSelectedRole] = useState<number | string>('');
  const [selectedPerson, setSelectedPerson] = useState<number | string>('');
  const [hours, setHours] = useState<number>(10);
  const [rate, setRate] = useState<number>(0);
  
  // Filtrado de personal por rol
  const [filteredPersonnel, setFilteredPersonnel] = useState<Personnel[]>([]);

  // Cargar datos directamente desde la API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Cargar roles
        const rolesResponse = await fetch('/api/roles');
        if (!rolesResponse.ok) {
          throw new Error(`Error al cargar roles: ${rolesResponse.status}`);
        }
        const rolesData = await rolesResponse.json();
        setRoles(rolesData);
        
        // Cargar personal
        const personnelResponse = await fetch('/api/personnel');
        if (!personnelResponse.ok) {
          throw new Error(`Error al cargar personal: ${personnelResponse.status}`);
        }
        const personnelData = await personnelResponse.json();
        setPersonnel(personnelData);
      } catch (err: any) {
        console.error('Error al cargar datos:', err);
        setError(err?.message || 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Filtrar personal cuando cambia el rol
  useEffect(() => {
    if (selectedRole && personnel.length > 0) {
      const roleId = Number(selectedRole);
      const filtered = personnel.filter(person => person.roleId === roleId);
      setFilteredPersonnel(filtered);
    } else {
      setFilteredPersonnel([]);
    }
  }, [selectedRole, personnel]);

  // Actualizar tarifa cuando cambia el rol
  useEffect(() => {
    if (selectedRole) {
      const roleId = Number(selectedRole);
      const role = roles.find(r => r.id === roleId);
      if (role) {
        setRate(role.defaultRate);
      }
    }
  }, [selectedRole, roles]);

  // Manejar selección de rol
  const handleRoleChange = (value: string) => {
    setSelectedRole(value);
    setSelectedPerson(''); // Resetear personal cuando cambia el rol
  };

  // Manejar selección de personal
  const handlePersonnelChange = (value: string) => {
    setSelectedPerson(value);
    
    // Actualizar tarifa si se selecciona una persona
    if (value) {
      const personnelId = Number(value);
      const person = personnel.find(p => p.id === personnelId);
      if (person) {
        setRate(person.hourlyRate);
      }
    }
  };

  // Manejar envío del formulario
  const handleAddMember = () => {
    if (!selectedRole) {
      alert('Por favor, selecciona un rol');
      return;
    }
    
    if (hours <= 0) {
      alert('Las horas deben ser mayores a 0');
      return;
    }
    
    if (rate <= 0) {
      alert('La tarifa debe ser mayor a 0');
      return;
    }
    
    const roleId = Number(selectedRole);
    const personnelId = selectedPerson ? Number(selectedPerson) : null;
    const cost = hours * rate;
    
    // Llamar a la función proporcionada por el padre
    onAddMember({
      roleId,
      personnelId,
      hours,
      rate,
      cost
    });
    
    // Mantener el rol seleccionado pero limpiar el personal
    setSelectedPerson('');
    setHours(10);
  };

  // Obtener nombre del rol a partir de su ID
  const getRoleName = (roleId: number): string => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : 'Rol no encontrado';
  };

  // Obtener nombre del personal a partir de su ID
  const getPersonnelName = (personnelId: number | null): string => {
    if (!personnelId) return '';
    const person = personnel.find(p => p.id === personnelId);
    return person ? person.name : 'Personal no encontrado';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-lg font-medium">Añadir Miembro al Equipo</h2>
        </div>
        
        {loading ? (
          <div className="text-center p-6">Cargando datos...</div>
        ) : error ? (
          <div className="text-center p-6 text-red-500">{error}</div>
        ) : (
          <div className="p-4">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4 flex items-start">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                Aquí puedes seleccionar roles y personal para tu proyecto. Selecciona un rol, personal (opcional), 
                horas y tarifa para cada miembro del equipo.
              </p>
            </div>
            
            <div className="mt-4">
              <h3 className="text-base font-medium mb-4">Añadir Miembro al Equipo</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Selector de Rol */}
                <div>
                  <Label className="block text-sm font-medium mb-1">Rol</Label>
                  <Select value={selectedRole.toString()} onValueChange={handleRoleChange}>
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id.toString()}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Selector de Personal */}
                <div>
                  <Label className="block text-sm font-medium mb-1">Personal</Label>
                  <Select value={selectedPerson.toString()} onValueChange={handlePersonnelChange} disabled={!selectedRole}>
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Seleccionar personal" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPersonnel.length > 0 ? (
                        filteredPersonnel.map(person => (
                          <SelectItem key={person.id} value={person.id.toString()}>
                            {person.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="text-center py-2 text-sm text-gray-500">
                          No hay personal disponible para este rol
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Horas */}
                <div>
                  <Label className="block text-sm font-medium mb-1">Horas</Label>
                  <Input
                    type="number"
                    min="1"
                    value={hours}
                    onChange={(e) => setHours(parseInt(e.target.value) || 0)}
                    className="h-10"
                  />
                </div>
                
                {/* Tarifa */}
                <div>
                  <Label className="block text-sm font-medium mb-1">Tarifa ($/h)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={rate}
                      onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                      className="pl-7 h-10"
                    />
                  </div>
                </div>
              </div>
              
              {/* Botón para añadir */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleAddMember} 
                  disabled={!selectedRole || hours <= 0 || rate <= 0}
                  className="bg-primary hover:bg-primary/90"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Añadir
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Lista de miembros del equipo */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <Users className="h-5 w-5 mr-2" />
          Equipo del Proyecto
        </h2>
        
        {existingMembers.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-md">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500">No hay miembros en el equipo</p>
            <p className="text-sm text-gray-400 mt-1">
              Utiliza el formulario anterior para añadir miembros al equipo del proyecto
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Rol / Personal</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Horas</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Tarifa</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Costo</th>
                </tr>
              </thead>
              <tbody>
                {existingMembers.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-medium">{getRoleName(member.roleId)}</div>
                      {member.personnelId && (
                        <div className="text-sm text-gray-500">{getPersonnelName(member.personnelId)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{member.hours}</td>
                    <td className="px-4 py-3 text-center">${member.rate.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium">${member.cost.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-4 py-3 text-right font-medium">Total:</td>
                  <td className="px-4 py-3 text-right font-medium">
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

export default TeamMemberSelector;