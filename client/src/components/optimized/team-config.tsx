import React, { useState, useEffect } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Personnel, Role } from '@shared/schema';
import { 
  AlertCircle, Plus, Trash, UserPlus, Users, RefreshCcw, Clock, DollarSign,
  Award, UserCheck, BarChart2, Settings, Briefcase, Sparkles, Edit, Check, X, Pencil,
  Save, Trash2, User, Percent
} from 'lucide-react';

const OptimizedTeamConfig: React.FC = () => {
  const {
    quotationData,
    setTeamOption,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    applyRecommendedTeam,
    loadRoles,
    loadPersonnel,
    availableRoles,
    availablePersonnel,
    recommendedRoleIds,
    baseCost
  } = useOptimizedQuote();

  // Estado local para determinar si se trabajará por horas o por FTE
  const [workMode, setWorkMode] = useState<'hours' | 'fte'>('hours');
  
  // Estado local para el formulario de nuevo miembro
  const [newMember, setNewMember] = useState({
    roleId: 0,
    personnelId: null as number | null,
    hours: 10,
    rate: 0,
    fte: 1,
    dedication: 100, // Porcentaje de dedicación (100% = 1 FTE)
    quantity: 1 // Cantidad de miembros a agregar
  });

  // Estado para la vista activa
  const [activeTab, setActiveTab] = useState<string>(quotationData.teamOption === 'auto' ? 'recommended' : 'custom');
  
  // Estado para miembros en edición
  const [editingMember, setEditingMember] = useState<Record<string, {hours: number, rate: number}>>({});
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});
  
  // Estado para selección múltiple de roles y personal
  const [multipleSelection, setMultipleSelection] = useState<{
    mode: 'single' | 'multiple';
    selectedRoleIds: number[];
    selectedPersonnelIds: number[];
  }>({
    mode: 'single',
    selectedRoleIds: [],
    selectedPersonnelIds: []
  });

  // Cargar roles y personal al montar el componente
  useEffect(() => {
    loadRoles();
    loadPersonnel();
  }, [loadRoles, loadPersonnel]);

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

  // Filtrar personal por rol seleccionado
  const filteredPersonnel = availablePersonnel?.filter(
    person => person.roleId === newMember.roleId
  );

  // Verificar si un rol está recomendado
  const isRoleRecommended = (roleId: number) => {
    return recommendedRoleIds.includes(roleId);
  };

  // Calcular total de horas y costo
  const totalHours = quotationData.teamMembers.reduce((sum, member) => sum + member.hours, 0);
  const totalTeamCost = quotationData.teamMembers.reduce((sum, member) => sum + member.cost, 0);
  const percentageOfBase = baseCost ? (totalTeamCost / baseCost) * 100 : 0;

  // Manejar la adición de nuevo(s) miembro(s)
  const handleAddMember = () => {
    // Preparación de los parámetros comunes
    let hours = newMember.hours;
    if (workMode === 'fte') {
      hours = Math.round((newMember.dedication / 100) * 160);
    }
    
    const rate = newMember.rate;
    const cost = hours * rate;
    const dedication = newMember.dedication;
    const fte = dedication / 100;
    
    // Definir función para agregar un miembro con parámetros específicos
    const addSingleMember = (roleId: number, personnelId: number | null) => {
      addTeamMember({
        roleId,
        personnelId,
        hours,
        rate,
        cost,
        dedication,
        fte,
        quantity: 1
      });
    };
    
    // Verificamos si estamos en modo de selección múltiple
    if (multipleSelection.mode === 'multiple') {
      // Para selección múltiple basada en rol
      if (activeTab === 'recommended' && multipleSelection.selectedRoleIds.length > 0) {
        // Verificamos que haya tarifa y horas
        if (rate > 0 && ((workMode === 'hours' && hours > 0) || (workMode === 'fte' && dedication > 0))) {
          // Por cada rol seleccionado, agregamos un miembro
          multipleSelection.selectedRoleIds.forEach(roleId => {
            const quantity = newMember.quantity || 1;
            for (let i = 0; i < quantity; i++) {
              addSingleMember(roleId, null);
            }
          });
          
          // Limpiamos selección
          setMultipleSelection(prev => ({
            ...prev,
            selectedRoleIds: []
          }));
        }
      }
      
      // Para selección múltiple basada en personal
      else if (activeTab === 'custom' && multipleSelection.selectedPersonnelIds.length > 0) {
        // Verificamos que haya tarifa y horas
        if (rate > 0 && ((workMode === 'hours' && hours > 0) || (workMode === 'fte' && dedication > 0))) {
          // Por cada persona seleccionada, agregamos un miembro
          multipleSelection.selectedPersonnelIds.forEach(personnelId => {
            const person = availablePersonnel?.find(p => p.id === personnelId);
            if (person) {
              const quantity = newMember.quantity || 1;
              for (let i = 0; i < quantity; i++) {
                addSingleMember(person.roleId, personnelId);
              }
            }
          });
          
          // Limpiamos selección
          setMultipleSelection(prev => ({
            ...prev,
            selectedPersonnelIds: []
          }));
        }
      }
    }
    // Modo de selección individual
    else {
      // Validación: en modo 'Por Rol' necesitamos roleId, en modo 'Por Persona' necesitamos personnelId
      const isValidForMode = 
        (activeTab === 'recommended' && newMember.roleId > 0) || 
        (activeTab === 'custom' && newMember.personnelId && newMember.personnelId > 0);
      
      // Validación específica según el modo de trabajo (horas o FTE)
      const isValidForWorkMode = workMode === 'hours' 
        ? hours > 0 
        : dedication > 0;
      
      if (isValidForMode && isValidForWorkMode && rate > 0) {
        // Añadir la cantidad especificada de miembros
        const quantity = newMember.quantity || 1;
        for (let i = 0; i < quantity; i++) {
          addSingleMember(newMember.roleId, newMember.personnelId);
        }
      }
    }
    
    // Limpiar formulario pero mantener el rol/tarifa seleccionados
    const currentRoleId = newMember.roleId;
    const currentRate = newMember.rate;
    setNewMember({
      roleId: currentRoleId,
      personnelId: null,
      hours: 10,
      rate: currentRate,
      fte: 1,
      dedication: 100,
      quantity: 1
    });
  };

  // Manejar cambio de tab y modo de equipo
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'recommended') {
      setTeamOption('auto');
    } else if (value === 'custom') {
      setTeamOption('manual');
    }
  };
  
  // Iniciar edición de miembro
  const startEditing = (memberId: string, hours: number, rate: number) => {
    setEditingMember({
      ...editingMember, 
      [memberId]: { hours, rate }
    });
    setIsEditing({...isEditing, [memberId]: true});
  };
  
  // Cancelar edición
  const cancelEditing = (memberId: string) => {
    setIsEditing({...isEditing, [memberId]: false});
  };
  
  // Guardar cambios en miembro
  const saveEditing = (member: any) => {
    const memberId = String(member.id);
    if (editingMember[memberId]) {
      const hours = editingMember[memberId].hours;
      const rate = editingMember[memberId].rate;
      const fte = hours / 160; // Convertimos horas a FTE (160 horas mensuales = 1 FTE)
      const dedication = fte * 100; // Convertimos FTE a porcentaje (ej. 0.5 FTE = 50%)
      
      updateTeamMember(member.id, {
        ...member,
        hours,
        rate,
        fte,
        dedication,
        cost: hours * rate
      });
      setIsEditing({...isEditing, [memberId]: false});
    }
  };

  return (
    <div className="h-[600px] overflow-y-auto pr-2">
      <div className="p-4 bg-white rounded-md border border-gray-200 mb-4">
        <div className="flex items-center mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Configuración del Equipo</h2>
            <p className="text-xs text-neutral-500">
              Define los roles y personal que trabajarán en este proyecto
            </p>
          </div>
        </div>

        {/* Tabs para elegir entre equipo recomendado y personalizado */}
        <Tabs 
          defaultValue={activeTab} 
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="recommended" className="flex items-center">
              <Sparkles className="h-4 w-4 mr-2" />
              <span>Por Rol</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center">
              <UserCheck className="h-4 w-4 mr-2" />
              <span>Por Persona</span>
            </TabsTrigger>
          </TabsList>

          {/* Sección informativa sobre roles recomendados - visible en ambas pestañas si hay recomendaciones */}
          {recommendedRoleIds.length > 0 && (
            <div className="bg-primary/5 rounded-md p-3 border border-primary/20 mb-4">
              <h3 className="text-sm font-medium flex items-center mb-2">
                <Award className="h-4 w-4 mr-2 text-primary" />
                Roles Recomendados para {quotationData.template?.name || 'este proyecto'}
              </h3>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {recommendedRoleIds.map(roleId => {
                  const role = availableRoles?.find(r => r.id === roleId);
                  const isInTeam = quotationData.teamMembers.some(m => m.roleId === roleId);
                  
                  return role ? (
                    <Badge 
                      key={roleId} 
                      variant="outline" 
                      className={`${isInTeam 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : 'bg-white border-primary/30'}`}
                    >
                      {role.name}
                    </Badge>
                  ) : null;
                })}
              </div>
              
              <p className="text-xs text-gray-600 mb-3">
                Estos roles son los más adecuados para este tipo de proyecto según nuestra experiencia.
                {activeTab === 'recommended' && ' Puedes aplicarlos automáticamente o ajustar la configuración manualmente.'}
              </p>
              
              {activeTab === 'recommended' && quotationData.teamMembers.length === 0 && (
                <div className="flex justify-end">
                  <Button 
                    onClick={applyRecommendedTeam}
                    className="flex items-center bg-primary/80 hover:bg-primary text-sm h-8"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Aplicar Equipo Recomendado
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Formulario para añadir miembros (visible en ambas pestañas) */}
          <div className="mb-4 border border-gray-200 rounded-md overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xs font-medium flex items-center">
                <UserPlus className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Añadir Miembro al Equipo
              </h3>
              
              <div className="flex items-center gap-2">
                {/* Selector de modo de selección: Individual vs Múltiple */}
                <div className="flex items-center mr-2">
                  <Label className="text-xs text-gray-500 whitespace-nowrap mr-2">Selección:</Label>
                  <div className="flex space-x-1">
                    <Button
                      type="button"
                      variant={multipleSelection.mode === 'single' ? 'default' : 'outline'}
                      size="sm"
                      className={`text-xs h-7 px-3 ${multipleSelection.mode === 'single' ? 'bg-primary/90 hover:bg-primary' : 'bg-background hover:bg-secondary/80'}`}
                      onClick={() => setMultipleSelection({
                        mode: 'single',
                        selectedRoleIds: [],
                        selectedPersonnelIds: []
                      })}
                    >
                      <User className="h-3.5 w-3.5 mr-1.5" />
                      <span>Individual</span>
                    </Button>
                    <Button
                      type="button"
                      variant={multipleSelection.mode === 'multiple' ? 'default' : 'outline'}
                      size="sm"
                      className={`text-xs h-7 px-3 ${multipleSelection.mode === 'multiple' ? 'bg-primary/90 hover:bg-primary' : 'bg-background hover:bg-secondary/80'}`}
                      onClick={() => setMultipleSelection({
                        mode: 'multiple',
                        selectedRoleIds: [],
                        selectedPersonnelIds: []
                      })}
                    >
                      <Users className="h-3.5 w-3.5 mr-1.5" />
                      <span>Múltiple</span>
                    </Button>
                  </div>
                </div>
                
                {/* Selector de modo: Horas vs FTE */}
                <div className="flex items-center">
                  <Label className="text-xs text-gray-500 whitespace-nowrap mr-2">Modo:</Label>
                  <div className="flex space-x-1">
                    <Button
                      type="button"
                      variant={workMode === 'hours' ? 'default' : 'outline'}
                      size="sm"
                      className={`text-xs h-7 px-3 ${workMode === 'hours' ? 'bg-primary/90 hover:bg-primary' : 'bg-background hover:bg-secondary/80'}`}
                      onClick={() => setWorkMode('hours')}
                    >
                      <Clock className="h-3.5 w-3.5 mr-1.5" />
                      <span>Horas</span>
                    </Button>
                    <Button
                      type="button"
                      variant={workMode === 'fte' ? 'default' : 'outline'}
                      size="sm"
                      className={`text-xs h-7 px-3 ${workMode === 'fte' ? 'bg-primary/90 hover:bg-primary' : 'bg-background hover:bg-secondary/80'}`}
                      onClick={() => setWorkMode('fte')}
                    >
                      <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
                      <span>FTE</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                
                {/* Modo Por Rol: selector de rol */}
                {activeTab === 'recommended' && (
                  <div>
                    <Label htmlFor="role-select" className="text-xs mb-1 inline-block">Rol</Label>
                    
                    {multipleSelection.mode === 'single' ? (
                      // Selector individual
                      <Select
                        value={newMember.roleId ? String(newMember.roleId) : ''}
                        onValueChange={(value) => {
                          setNewMember(prev => ({
                            ...prev,
                            roleId: parseInt(value),
                            personnelId: null,
                            rate: availableRoles?.find(r => r.id === parseInt(value))?.defaultRate || 0
                          }));
                        }}
                      >
                        <SelectTrigger id="role-select" className="h-8 text-xs">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles?.map(role => (
                            <SelectItem 
                              key={role.id} 
                              value={String(role.id)}
                              className="flex items-center text-xs"
                            >
                              <div className="flex items-center">
                                {role.name}
                                {isRoleRecommended(role.id) && (
                                  <Badge className="ml-1 bg-primary/10 text-primary border-0 text-[9px] px-1 py-0">
                                    Rec.
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      // Selector múltiple
                      <div className="border border-gray-200 rounded-md h-24 overflow-y-auto p-2">
                        <div className="flex flex-wrap gap-2">
                          {availableRoles?.map(role => (
                            <div
                              key={role.id}
                              onClick={() => {
                                // Toggle the selection
                                const isSelected = multipleSelection.selectedRoleIds.includes(role.id);
                                if (isSelected) {
                                  setMultipleSelection(prev => ({
                                    ...prev,
                                    selectedRoleIds: prev.selectedRoleIds.filter(id => id !== role.id)
                                  }));
                                } else {
                                  setMultipleSelection(prev => ({
                                    ...prev,
                                    selectedRoleIds: [...prev.selectedRoleIds, role.id]
                                  }));
                                }
                              }}
                              className={`px-2 py-1 rounded text-xs cursor-pointer ${
                                multipleSelection.selectedRoleIds.includes(role.id)
                                  ? 'bg-primary text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <span>{role.name}</span>
                                {isRoleRecommended(role.id) && (
                                  <Badge className="ml-1 bg-primary/20 text-white border-0 text-[9px] px-1 py-0">
                                    Rec.
                                  </Badge>
                                )}
                                {multipleSelection.selectedRoleIds.includes(role.id) && (
                                  <Check className="h-3 w-3" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {multipleSelection.selectedRoleIds.length > 0 && (
                          <div className="mt-2 text-[10px] text-gray-500">
                            {multipleSelection.selectedRoleIds.length} roles seleccionados
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Modo Por Persona: selector de personal directo */}
                {activeTab === 'custom' && (
                  <div>
                    <Label htmlFor="person-select" className="text-xs mb-1 inline-block">Personal</Label>
                    
                    {multipleSelection.mode === 'single' ? (
                      // Selector individual
                      <Select
                        value={newMember.personnelId ? String(newMember.personnelId) : ''}
                        onValueChange={(value) => {
                          const personnelId = parseInt(value);
                          const selectedPerson = availablePersonnel?.find(p => p.id === personnelId);
                          const roleId = selectedPerson?.roleId || 0;
                          const role = availableRoles?.find(r => r.id === roleId);
                          
                          setNewMember(prev => ({
                            ...prev,
                            personnelId,
                            roleId,
                            rate: role?.defaultRate || 0
                          }));
                        }}
                      >
                        <SelectTrigger id="person-select" className="h-8 text-xs">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePersonnel?.map(person => {
                            const role = availableRoles?.find(r => r.id === person.roleId);
                            return (
                              <SelectItem 
                                key={person.id} 
                                value={String(person.id)}
                                className="flex items-center text-xs"
                              >
                                <div>
                                  {person.name}
                                  {role && (
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({role.name})
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      // Selector múltiple
                      <div className="border border-gray-200 rounded-md h-24 overflow-y-auto p-2">
                        <div className="flex flex-wrap gap-2">
                          {availablePersonnel?.map(person => {
                            const role = availableRoles?.find(r => r.id === person.roleId);
                            return (
                              <div
                                key={person.id}
                                onClick={() => {
                                  // Toggle the selection
                                  const isSelected = multipleSelection.selectedPersonnelIds.includes(person.id);
                                  if (isSelected) {
                                    setMultipleSelection(prev => ({
                                      ...prev,
                                      selectedPersonnelIds: prev.selectedPersonnelIds.filter(id => id !== person.id)
                                    }));
                                  } else {
                                    setMultipleSelection(prev => ({
                                      ...prev,
                                      selectedPersonnelIds: [...prev.selectedPersonnelIds, person.id]
                                    }));
                                  }
                                }}
                                className={`px-2 py-1 rounded text-xs cursor-pointer ${
                                  multipleSelection.selectedPersonnelIds.includes(person.id)
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <span>{person.name}</span>
                                  {role && (
                                    <Badge className="ml-1 bg-gray-200/80 text-gray-700 border-0 text-[9px] px-1 py-0">
                                      {role.name}
                                    </Badge>
                                  )}
                                  {multipleSelection.selectedPersonnelIds.includes(person.id) && (
                                    <Check className="h-3 w-3" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {multipleSelection.selectedPersonnelIds.length > 0 && (
                          <div className="mt-2 text-[10px] text-gray-500">
                            {multipleSelection.selectedPersonnelIds.length} personas seleccionadas
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Campo condicional según modo: Horas o FTE */}
                <div>
                  {workMode === 'hours' ? (
                    <>
                      <Label htmlFor="hours-input" className="text-xs mb-1 inline-block">Horas</Label>
                      <div className="relative">
                        <Clock className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          id="hours-input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="1"
                          className="h-8 pl-8 text-xs"
                          value={newMember.hours === 0 ? "" : newMember.hours}
                          onChange={(e) => {
                            // Permitir campo vacío o sólo dígitos
                            if (e.target.value === "" || /^[0-9]+$/.test(e.target.value)) {
                              const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                              setNewMember(prev => ({
                                ...prev,
                                hours: value,
                                dedication: Math.round((value / 160) * 100) // Actualizar dedicación (%) cuando cambian las horas
                              }));
                            }
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <Label htmlFor="dedication-input" className="text-xs mb-1 inline-block">Dedicación (%)</Label>
                      <div className="relative">
                        <BarChart2 className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          id="dedication-input"
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*(\.[0-9]+)?"
                          min="1"
                          max="100"
                          className="h-8 pl-8 text-xs"
                          value={newMember.dedication === 0 ? "" : newMember.dedication}
                          onChange={(e) => {
                            // Permitir campo vacío o formato numérico con decimales
                            if (e.target.value === "" || /^[0-9]*(\.[0-9]*)?$/.test(e.target.value)) {
                              const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                              if (isNaN(value) || value <= 100) { // Asegurar que no supere 100%
                                setNewMember(prev => ({
                                  ...prev,
                                  dedication: isNaN(value) ? 0 : value,
                                  fte: (isNaN(value) ? 0 : value) / 100,
                                  hours: Math.round((isNaN(value) ? 0 : value) * 1.6) // 1% = 1.6 horas (160h/100)
                                }));
                              }
                            }
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
                
                {/* Tarifa */}
                <div>
                  <Label htmlFor="rate-input" className="text-xs mb-1 inline-block">Tarifa ($/h)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      id="rate-input"
                      type="text"
                      inputMode="decimal"
                      className="h-8 pl-8 text-xs"
                      value={newMember.rate === 0 ? "" : newMember.rate}
                      onChange={(e) => {
                        // Permitir campo vacío o formato numérico con decimales
                        const value = e.target.value;
                        if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
                          setNewMember(prev => ({
                            ...prev,
                            rate: value === "" ? 0 : parseFloat(value)
                          }));
                        }
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="quantity-input" className="text-xs mb-1 inline-block">Cantidad</Label>
                  <div className="flex gap-2">
                    <div className="w-1/3">
                      <Input
                        id="quantity-input"
                        type="number"
                        min={1}
                        max={10}
                        className="h-8 text-xs"
                        value={newMember.quantity || 1}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          setNewMember(prev => ({
                            ...prev,
                            quantity: isNaN(value) || value < 1 ? 1 : value
                          }));
                        }}
                      />
                    </div>
                    <div className="w-2/3">
                      <Button 
                        onClick={handleAddMember}
                        disabled={
                          multipleSelection.mode === 'multiple' ? 
                          (
                            (activeTab === 'recommended' && multipleSelection.selectedRoleIds.length === 0) ||
                            (activeTab === 'custom' && multipleSelection.selectedPersonnelIds.length === 0) ||
                            newMember.hours <= 0 || 
                            newMember.rate <= 0
                          ) : 
                          (
                            (activeTab === 'recommended' && !newMember.roleId) || 
                            (activeTab === 'custom' && !newMember.personnelId) || 
                            newMember.hours <= 0 || 
                            newMember.rate <= 0
                          )
                        } 
                        className="w-full h-8 text-xs bg-primary/80 hover:bg-primary"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Añadir {
                          multipleSelection.mode === 'multiple' ? 
                          (
                            activeTab === 'recommended' ? 
                            `(${multipleSelection.selectedRoleIds.length} roles${newMember.quantity > 1 ? ` x ${newMember.quantity}` : ''})` : 
                            `(${multipleSelection.selectedPersonnelIds.length} personas${newMember.quantity > 1 ? ` x ${newMember.quantity}` : ''})`
                          ) : 
                          (newMember.quantity > 1 ? `(${newMember.quantity})` : '')
                        }
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de miembros del equipo */}
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xs font-medium flex items-center">
                <Users className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Equipo del Proyecto
              </h3>
              
              {quotationData.teamMembers.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/5 border-primary/20 gap-1 items-center h-6">
                    <Users className="h-3 w-3" />
                    <span>{quotationData.teamMembers.length} {quotationData.teamMembers.length === 1 ? 'Rol' : 'Roles'}</span>
                  </Badge>
                  
                  <Badge variant="outline" className={`${workMode === 'hours' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-purple-50 border-purple-200 text-purple-700'} gap-1 items-center h-6`}>
                    {workMode === 'hours' ? (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>{totalHours} horas</span>
                      </>
                    ) : (
                      <>
                        <BarChart2 className="h-3 w-3" />
                        <span className="font-medium">{(totalHours / 160).toFixed(1)} FTE</span>
                      </>
                    )}
                  </Badge>
                </div>
              )}
            </div>
            
            {quotationData.teamMembers.length > 0 ? (
              <>
                <div className="p-0">
                  <ScrollArea className="h-[250px]">
                    <div className="border-b">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left p-2 text-xs font-medium text-gray-500">Rol</th>
                            <th className="text-center p-2 text-xs font-medium text-gray-500">
                              {workMode === 'hours' ? 'Horas' : 'Dedicación'}
                            </th>
                            {workMode === 'fte' && (
                              <th className="text-center p-2 text-xs font-medium text-gray-500">FTE</th>
                            )}
                            <th className="text-center p-2 text-xs font-medium text-gray-500">Tarifa</th>
                            <th className="text-right p-2 text-xs font-medium text-gray-500">Costo</th>
                            <th className="text-right p-2 text-xs font-medium text-gray-500">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotationData.teamMembers.map(member => {
                            const role = availableRoles?.find(r => r.id === member.roleId);
                            const person = availablePersonnel?.find(p => p.id === member.personnelId);
                            const isCurrentlyEditing = isEditing[String(member.id)] || false;
                            
                            return (
                              <tr key={member.id} className="text-sm hover:bg-gray-50">
                                <td className="p-2 border-b border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                      <Briefcase className="h-3 w-3 text-primary" />
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium">
                                        {/* Intentar obtener el rol de varias maneras */}
                                        {role?.name || 
                                         (person?.roleId && availableRoles?.find(r => r.id === person.roleId)?.name) || 
                                         'Rol desconocido'}
                                      </div>
                                      {/* Solo mostramos el nombre del personal cuando:
                                          1) Existe un personnelId asignado Y
                                          2) Estamos en el modo de equipo personalizado (manual) 
                                      */}
                                      {person && (
                                        <div className="text-[10px] text-gray-500">{person.name}</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                
                                <td className="p-2 text-center border-b border-gray-100">
                                  {isCurrentlyEditing ? (
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      className="h-7 text-xs w-20 mx-auto"
                                      value={
                                        editingMember[String(member.id)]?.hours === 0 
                                          ? "" 
                                          : editingMember[String(member.id)]?.hours || member.hours
                                      }
                                      onChange={(e) => {
                                        // Permitir campo vacío o sólo dígitos
                                        if (e.target.value === "" || /^[0-9]+$/.test(e.target.value)) {
                                          const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                                          setEditingMember({
                                            ...editingMember,
                                            [String(member.id)]: {
                                              ...(editingMember[String(member.id)] || { rate: member.rate }),
                                              hours: value
                                            }
                                          });
                                        }
                                      }}
                                    />
                                  ) : (
                                    <span className="text-xs">
                                      {workMode === 'hours' 
                                        ? `${member.hours}h`
                                        : `${member.dedication ? member.dedication.toFixed(0) : Math.round((member.hours / 160) * 100)}%`
                                      }
                                    </span>
                                  )}
                                </td>
                                
                                {workMode === 'fte' && (
                                  <td className="p-2 text-center border-b border-gray-100">
                                    <span className="text-xs font-medium text-purple-600">
                                      {(member.hours / 160).toFixed(2)}
                                    </span>
                                  </td>
                                )}
                                
                                <td className="p-2 text-center border-b border-gray-100">
                                  {isCurrentlyEditing ? (
                                    <div className="relative w-24 mx-auto">
                                      <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[10px] text-gray-500">$</span>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9]*(\.[0-9]+)?"
                                        className="h-7 text-xs pl-6"
                                        value={
                                          editingMember[String(member.id)]?.rate === 0
                                            ? ""
                                            : editingMember[String(member.id)]?.rate || member.rate
                                        }
                                        onChange={(e) => {
                                          // Permitir campo vacío o formato numérico con decimales
                                          const value = e.target.value;
                                          if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
                                            setEditingMember({
                                              ...editingMember,
                                              [String(member.id)]: {
                                                ...(editingMember[String(member.id)] || { hours: member.hours }),
                                                rate: value === "" ? 0 : parseFloat(value)
                                              }
                                            });
                                          }
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-xs">${member.rate.toFixed(2)}</span>
                                  )}
                                </td>
                                
                                <td className="p-2 text-right border-b border-gray-100">
                                  <span className="text-xs font-medium text-gray-900">
                                    ${isCurrentlyEditing 
                                      ? ((editingMember[String(member.id)]?.hours || member.hours) * 
                                         (editingMember[String(member.id)]?.rate || member.rate)).toFixed(2)
                                      : member.cost.toFixed(2)
                                    }
                                  </span>
                                </td>
                                
                                <td className="p-2 text-right border-b border-gray-100">
                                  <div className="flex justify-end gap-1">
                                    {isCurrentlyEditing ? (
                                      <>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                          onClick={() => saveEditing(member)}
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                          onClick={() => cancelEditing(String(member.id))}
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                          onClick={() => startEditing(String(member.id), member.hours, member.rate)}
                                        >
                                          <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                          onClick={() => removeTeamMember(member.id)}
                                        >
                                          <Trash className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center bg-gray-50">
                <Users className="h-10 w-10 text-gray-300 mb-2" />
                <h3 className="text-sm font-medium text-gray-700 mb-1">No hay miembros en el equipo</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto mb-4 px-6 text-center">
                  {activeTab === 'recommended' 
                    ? "Haz clic en 'Aplicar Equipo Recomendado' o añade miembros manualmente usando el formulario."
                    : "Utiliza el formulario anterior para añadir miembros al equipo del proyecto."}
                </p>
                
                {activeTab === 'recommended' && recommendedRoleIds.length > 0 && (
                  <Button 
                    onClick={applyRecommendedTeam}
                    className="flex items-center bg-primary/80 hover:bg-primary text-xs h-8"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Aplicar Equipo Recomendado
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Resumen de costos y gráfico */}
          {quotationData.teamMembers.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-medium text-gray-700 flex items-center">
                  <BarChart2 className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                  Resumen del Costo
                </h3>
                <span className="text-xs text-gray-500">
                  {percentageOfBase > 0 && (
                    <span className={`font-medium ${
                      percentageOfBase > 80 ? 'text-[#d27060]' : 
                      percentageOfBase > 50 ? 'text-[#d2a860]' : 
                      'text-[#60d28e]'
                    }`}>
                      {percentageOfBase.toFixed(1)}% del costo base
                    </span>
                  )}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white border border-gray-200 rounded p-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">
                      {workMode === 'hours' ? 'Total Horas' : 'Total FTE'}
                    </div>
                    <div className="text-sm font-medium">
                      {workMode === 'hours' 
                        ? totalHours 
                        : `${(totalHours / 160).toFixed(1)} (${totalHours}h)`
                      }
                    </div>
                  </div>
                  <div className={`h-8 w-8 rounded-full ${workMode === 'hours' ? 'bg-blue-50' : 'bg-purple-50'} flex items-center justify-center`}>
                    {workMode === 'hours' 
                      ? <Clock className="h-4 w-4 text-blue-600" />
                      : <BarChart2 className="h-4 w-4 text-purple-600" />
                    }
                  </div>
                </div>
                
                <div className="bg-[#f7f5fe] border border-[#e2ddf5] rounded p-2 flex items-center justify-between relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="text-xs text-[#6a5b9d]/70">Costo estimado</div>
                    <div className="text-sm font-medium text-[#6a5b9d]">${totalTeamCost.toFixed(2)}</div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-[#9c8ce7]/20 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-[#8976e2]" />
                  </div>
                  <div className="h-1 w-20 bg-[#9c8ce7]/20 absolute bottom-0 left-0 rounded-tr-md"></div>
                </div>
              </div>
              
              {/* Barra de progreso */}
              {baseCost > 0 && (
                <div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        percentageOfBase > 70 ? 'bg-[#e79c8c]' : 
                        percentageOfBase > 50 ? 'bg-[#e7d08c]' : 'bg-[#8ce7b5]'
                      }`}
                      style={{ width: `${Math.min(percentageOfBase, 100)}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                    <div>0%</div>
                    <div>50%</div>
                    <div>100%</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default OptimizedTeamConfig;