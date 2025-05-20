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
  onUpdateMember?: (id: string, updates: Partial<Omit<TeamMember, 'id'>>) => void;
  onRemoveMember?: (id: string) => void;
  existingMembers: TeamMember[];
}

const TeamMemberSelector: React.FC<TeamMemberSelectorProps> = ({ 
  onAddMember, 
  onUpdateMember, 
  onRemoveMember, 
  existingMembers 
}) => {
  // Estados locales
  const [roles, setRoles] = useState<Role[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para el modo de selección (por rol o por personal)
  const [selectionMode, setSelectionMode] = useState<'role' | 'personnel'>('role');
  
  // Limpiar la selección de personal al cambiar el modo
  useEffect(() => {
    setSelectedPerson('');
  }, [selectionMode]);
  
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

  // Actualizar los datos al cambiar el modo de selección
  useEffect(() => {
    // Cuando cambiamos a modo por personal, ya no necesitamos filtrar
    if (selectionMode === 'personnel') {
      // Mostrar todo el personal disponible sin filtrar por rol
      setFilteredPersonnel(personnel);
    } 
    // Cuando cambiamos a modo por rol, filtramos por el rol seleccionado
    else if (selectionMode === 'role' && selectedRole) {
      const roleId = Number(selectedRole);
      const filtered = personnel.filter(person => person.roleId === roleId);
      setFilteredPersonnel(filtered);
    } else {
      setFilteredPersonnel([]);
    }
  }, [selectionMode, selectedRole, personnel]);

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
    
    // Actualizar rol y tarifa automáticamente si se selecciona una persona
    if (value) {
      const personnelId = Number(value);
      const person = personnel.find(p => p.id === personnelId);
      if (person) {
        // Actualizamos el rol automáticamente
        setSelectedRole(person.roleId.toString());
        // Actualizamos la tarifa
        setRate(person.hourlyRate);
      }
    }
  };

  // Manejar envío del formulario
  const handleAddMember = () => {
    // Validaciones según el modo de selección
    if (selectionMode === 'role' && !selectedRole) {
      alert('Por favor, selecciona un rol');
      return;
    }
    
    if (selectionMode === 'personnel' && !selectedPerson) {
      alert('Por favor, selecciona un miembro del personal');
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
    // El personnelId solo se usará en modo "personnel"
    const personnelId = selectionMode === 'personnel' && selectedPerson ? Number(selectedPerson) : null;
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
    
    // No mostramos alerta para mejorar la experiencia de usuario
    console.log('Miembro añadido al equipo correctamente');
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
  
  // Estados para la edición de miembros
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{hours: number, rate: number}>({
    hours: 0,
    rate: 0
  });
  
  // Iniciar edición de un miembro
  const handleStartEdit = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setEditValues({
      hours: member.hours,
      rate: member.rate
    });
  };
  
  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingMemberId(null);
  };
  
  // Guardar cambios de edición
  const handleSaveEdit = (memberId: string) => {
    if (onUpdateMember) {
      const cost = editValues.hours * editValues.rate;
      onUpdateMember(memberId, {
        hours: editValues.hours, 
        rate: editValues.rate,
        cost
      });
      
      setEditingMemberId(null);
    }
  };
  
  // Eliminar miembro
  const handleRemoveMember = (memberId: string) => {
    if (onRemoveMember) {
      onRemoveMember(memberId);
    }
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
                Configura el equipo del proyecto seleccionando roles y personal específico.
              </p>
            </div>
            
            <div className="mb-4">
              <h4 className="text-sm font-medium text-neutral-800 mb-2">Tipo de Cotización</h4>
              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant={selectionMode === 'role' ? "default" : "outline"}
                  onClick={() => setSelectionMode('role')}
                  className="flex-1"
                  size="sm"
                >
                  Por Roles (Tarifas Estándar)
                </Button>
                <Button
                  type="button"
                  variant={selectionMode === 'personnel' ? "default" : "outline"}
                  onClick={() => setSelectionMode('personnel')}
                  className="flex-1"
                  size="sm"
                >
                  Por Miembros Específicos
                </Button>
              </div>
            </div>
            
            <div className="mt-4">
              <h3 className="text-base font-medium mb-4">Añadir Miembro al Equipo</h3>
              
              {/* Mostrar diferentes campos según el modo de selección */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Selector condicional basado en el modo de selección */}
                {selectionMode === 'role' ? (
                  /* Selector de Rol - Visible en modo 'por roles' */
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
                ) : (
                  /* Selector de Personal - Visible en modo 'por personal' */
                  <div className="col-span-2">
                    <Label className="block text-sm font-medium mb-1">Personal</Label>
                    <Select 
                      value={selectedPerson.toString()} 
                      onValueChange={handlePersonnelChange}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Seleccionar personal" />
                      </SelectTrigger>
                      <SelectContent>
                        {personnel.length > 0 ? (
                          personnel.map(person => (
                            <SelectItem key={person.id} value={person.id.toString()}>
                              {person.name} - {getRoleName(person.roleId)}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="text-center py-2 text-sm text-gray-500">
                            No hay personal disponible
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      El rol y la tarifa se establecerán automáticamente al seleccionar una persona
                    </p>
                  </div>
                )}
                
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
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {existingMembers.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{getRoleName(member.roleId)}</div>
                      {member.personnelId && (
                        <div className="text-sm text-gray-500">{getPersonnelName(member.personnelId)}</div>
                      )}
                    </td>
                    
                    {/* Si está en modo edición, mostrar campos para editar */}
                    {editingMemberId === member.id ? (
                      <>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            min="1"
                            value={editValues.hours}
                            onChange={(e) => setEditValues({
                              ...editValues,
                              hours: parseInt(e.target.value) || 0
                            })}
                            className="h-9 w-20 mx-auto text-center"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="relative w-24 mx-auto">
                            <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={editValues.rate}
                              onChange={(e) => setEditValues({
                                ...editValues,
                                rate: parseFloat(e.target.value) || 0
                              })}
                              className="h-9 pl-6 text-center"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${(editValues.hours * editValues.rate).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center space-x-1">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 px-2 text-green-600 border-green-600 hover:bg-green-50"
                              onClick={() => handleSaveEdit(member.id)}
                            >
                              Guardar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 px-2 text-gray-500 border-gray-300 hover:bg-gray-50"
                              onClick={handleCancelEdit}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      /* Modo visualización normal */
                      <>
                        <td className="px-4 py-3 text-center">{member.hours}</td>
                        <td className="px-4 py-3 text-center">${member.rate.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium">${member.cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center space-x-1">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                              onClick={() => handleStartEdit(member)}
                              title="Editar"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                              onClick={() => onRemoveMember && onRemoveMember(member.id)}
                              title="Eliminar"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-4 py-3 text-right font-medium">Total:</td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${existingMembers.reduce((sum, member) => sum + member.cost, 0).toFixed(2)}
                  </td>
                  <td></td>
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