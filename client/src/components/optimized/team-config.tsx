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
  Award, UserCheck, BarChart2, Settings, Briefcase, Sparkles
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

  // Estado local para el formulario de nuevo miembro
  const [newMember, setNewMember] = useState({
    roleId: 0,
    personnelId: null as number | null,
    hours: 10,
    rate: 0
  });

  // Estado para la vista activa
  const [activeTab, setActiveTab] = useState<string>(quotationData.teamOption === 'auto' ? 'recommended' : 'custom');

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
    person => !newMember.roleId || person.roleId === newMember.roleId
  );

  // Verificar si un rol está recomendado
  const isRoleRecommended = (roleId: number) => {
    return recommendedRoleIds.includes(roleId);
  };

  // Calcular total de horas y costo
  const totalHours = quotationData.teamMembers.reduce((sum, member) => sum + member.hours, 0);
  const totalTeamCost = quotationData.teamMembers.reduce((sum, member) => sum + member.cost, 0);
  const percentageOfBase = baseCost ? (totalTeamCost / baseCost) * 100 : 0;

  // Manejar la adición de un nuevo miembro
  const handleAddMember = () => {
    if (newMember.roleId > 0 && newMember.hours > 0 && newMember.rate > 0) {
      // Calcular costo
      const cost = newMember.hours * newMember.rate;
      
      // Asegurarnos de tener un personnelId válido
      let validPersonnelId = newMember.personnelId;
      
      // Si no hay personal asignado, usamos el primer miembro disponible
      if (!validPersonnelId && availablePersonnel && availablePersonnel.length > 0) {
        validPersonnelId = availablePersonnel[0].id;
      } else if (!validPersonnelId) {
        // Si no hay personal disponible, usamos un ID conocido
        validPersonnelId = 39;
      }
      
      // Añadir miembro con ID válido
      addTeamMember({
        ...newMember,
        personnelId: validPersonnelId,
        cost
      });
      
      // Limpiar formulario
      setNewMember({
        roleId: 0,
        personnelId: null,
        hours: 10,
        rate: 0
      });
    }
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
              <span>Recomendado</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              <span>Personalizado</span>
            </TabsTrigger>
          </TabsList>

          {/* Equipo recomendado */}
          <TabsContent value="recommended" className="mt-0">
            {quotationData.template !== undefined ? (
              <>
                {quotationData.template === null ? (
                  // Personalizado sin plantilla
                  <div className="flex items-start gap-3 mb-4 p-3 bg-amber-50 rounded-md border border-amber-200">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-amber-800">Configuración Personalizada</h3>
                      <p className="text-xs text-amber-700 mt-1">
                        Has elegido configurar la cotización sin plantilla. Cambia a la pestaña "Personalizado" 
                        para configurar tu equipo manualmente.
                      </p>
                    </div>
                  </div>
                ) : recommendedRoleIds.length > 0 ? (
                  // Plantilla con roles recomendados
                  <div>
                    <div className="bg-primary/5 rounded-md p-3 border border-primary/20 mb-4">
                      <h3 className="text-sm font-medium flex items-center mb-2">
                        <Award className="h-4 w-4 mr-2 text-primary" />
                        Roles Recomendados para {quotationData.template.name}
                      </h3>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {recommendedRoleIds.map(roleId => {
                          const role = availableRoles?.find(r => r.id === roleId);
                          return role ? (
                            <Badge key={roleId} variant="outline" className="bg-white border-primary/30">
                              {role.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-3">
                        Estos roles son los más adecuados para este tipo de proyecto según nuestra experiencia.
                        Puedes aplicarlos automáticamente o ajustar la configuración manualmente.
                      </p>
                      
                      <div className="flex justify-end">
                        <Button 
                          onClick={applyRecommendedTeam}
                          className="flex items-center bg-primary/80 hover:bg-primary text-sm h-8"
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                          Aplicar Equipo Recomendado
                        </Button>
                      </div>
                    </div>
                    
                    {/* Previsualización del equipo recomendado */}
                    <div className="mb-4">
                      <h3 className="text-xs font-medium text-gray-500 mb-2 flex items-center">
                        <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                        Composición del Equipo Recomendado
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {recommendedRoleIds.map(roleId => {
                          const role = availableRoles?.find(r => r.id === roleId);
                          return role ? (
                            <div key={roleId} className="flex items-center p-2 bg-gray-50 rounded-md border border-gray-200">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                                <UserCheck className="h-3 w-3 text-primary" />
                              </div>
                              <div>
                                <div className="text-xs font-medium">{role.name}</div>
                                <div className="text-[10px] text-gray-500">${role.defaultRate}/hora</div>
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Plantilla sin roles recomendados
                  <div className="flex items-start gap-3 mb-4 p-3 bg-amber-50 rounded-md border border-amber-200">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-amber-800">No hay recomendaciones disponibles</h3>
                      <p className="text-xs text-amber-700 mt-1">
                        La plantilla seleccionada no tiene roles recomendados. Cambia a la pestaña "Personalizado" 
                        para configurar tu equipo manualmente.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Estado inconsistente
              <div className="flex items-start gap-3 mb-4 p-3 bg-red-50 rounded-md border border-red-200">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Error de configuración</h3>
                  <p className="text-xs text-red-700 mt-1">
                    Por favor regresa al paso anterior y selecciona una plantilla o la opción personalizada.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Equipo personalizado/manual */}
          <TabsContent value="custom" className="mt-0">
            <div className="mb-4 border border-gray-200 rounded-md p-3 bg-gray-50">
              <h3 className="text-xs font-medium mb-2 flex items-center">
                <UserPlus className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Añadir Miembro al Equipo
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {/* Rol */}
                <div>
                  <Label htmlFor="role-select" className="text-xs mb-1 inline-block">Rol</Label>
                  <Select
                    value={newMember.roleId ? String(newMember.roleId) : ''}
                    onValueChange={(value) => {
                      setNewMember(prev => ({
                        ...prev,
                        roleId: parseInt(value),
                        personnelId: null
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
                </div>
                
                {/* Personal */}
                <div>
                  <Label htmlFor="personnel-select" className="text-xs mb-1 inline-block">Personal</Label>
                  <Select
                    value={newMember.personnelId ? String(newMember.personnelId) : '0'}
                    onValueChange={(value) => {
                      setNewMember(prev => ({
                        ...prev,
                        personnelId: value === "0" ? null : parseInt(value)
                      }));
                    }}
                    disabled={!newMember.roleId}
                  >
                    <SelectTrigger id="personnel-select" className="h-8 text-xs">
                      <SelectValue placeholder="Asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" className="text-xs">Sin asignar</SelectItem>
                      {filteredPersonnel?.map(person => (
                        <SelectItem key={person.id} value={String(person.id)} className="text-xs">
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Horas */}
                <div>
                  <Label htmlFor="hours-input" className="text-xs mb-1 inline-block">Horas</Label>
                  <div className="relative">
                    <Clock className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      id="hours-input"
                      type="number"
                      min="1"
                      value={newMember.hours}
                      className="h-8 pl-8 text-xs"
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setNewMember(prev => ({
                          ...prev,
                          hours: isNaN(value) ? 0 : value
                        }));
                      }}
                    />
                  </div>
                </div>
                
                {/* Tarifa */}
                <div>
                  <Label htmlFor="rate-input" className="text-xs mb-1 inline-block">Tarifa ($/h)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      id="rate-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newMember.rate}
                      className="h-8 pl-8 text-xs"
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setNewMember(prev => ({
                          ...prev,
                          rate: isNaN(value) ? 0 : value
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={handleAddMember}
                  disabled={!newMember.roleId || newMember.hours <= 0 || newMember.rate <= 0}
                  className="flex items-center h-7 text-xs bg-primary/90 hover:bg-primary"
                  size="sm"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Añadir Miembro
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Tabla de miembros del equipo y resumen */}
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
        <div className="p-3 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center">
            <BarChart2 className="h-4 w-4 text-primary mr-2" />
            <h3 className="text-sm font-medium">Equipo Configurado</h3>
          </div>
          
          {quotationData.teamMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/5 border-primary/20 gap-1 items-center h-6">
                <Users className="h-3 w-3" />
                <span>{quotationData.teamMembers.length} {quotationData.teamMembers.length === 1 ? 'Rol' : 'Roles'}</span>
              </Badge>
              
              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 gap-1 items-center h-6">
                <Clock className="h-3 w-3" />
                <span>{totalHours} horas</span>
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
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr className="text-xs text-gray-500">
                        <th className="font-medium px-3 py-2 text-left">Rol</th>
                        <th className="font-medium px-3 py-2 text-left">Personal</th>
                        <th className="font-medium px-3 py-2 text-center w-[80px]">Horas</th>
                        <th className="font-medium px-3 py-2 text-center w-[100px]">Tarifa</th>
                        <th className="font-medium px-3 py-2 text-right w-[100px]">Costo</th>
                        <th className="font-medium px-2 py-2 text-center w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {quotationData.teamMembers.map(member => {
                        const role = availableRoles?.find(r => r.id === member.roleId);
                        const person = availablePersonnel?.find(p => p.id === member.personnelId);
                        
                        return (
                          <tr key={member.id} className="text-sm hover:bg-gray-50">
                            <td className="px-3 py-2 text-left">
                              <div className="flex items-center">
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mr-2 flex-shrink-0">
                                  <UserCheck className="h-3 w-3 text-primary" />
                                </div>
                                <div>
                                  <div className="font-medium text-xs">
                                    {role?.name || `Rol ID: ${member.roleId}`}
                                  </div>
                                  {isRoleRecommended(member.roleId) && (
                                    <div className="text-[10px] text-primary">Recomendado</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-left">
                              <span className="text-xs">{person?.name || "Sin asignar"}</span>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min="1"
                                value={member.hours}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  if (!isNaN(value) && value > 0) {
                                    updateTeamMember(member.id, {
                                      ...member,
                                      hours: value,
                                      cost: value * member.rate
                                    });
                                  }
                                }}
                                className="w-full h-7 text-center text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="relative">
                                <DollarSign className="h-3 w-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={member.rate}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value) && value >= 0) {
                                      updateTeamMember(member.id, {
                                        ...member,
                                        rate: value,
                                        cost: value * member.hours
                                      });
                                    }
                                  }}
                                  className="w-full h-7 pl-7 text-xs"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-xs">
                              ${member.cost.toFixed(2)}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeTeamMember(member.id)}
                                className="h-6 w-6 rounded-full hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </div>
            
            {/* Resumen visual con gráfico */}
            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-medium text-gray-500">Resumen de Costos</div>
                <div className="text-xs text-gray-500">
                  {percentageOfBase > 0 ? (
                    <span className={
                      percentageOfBase > 70 ? 'text-[#d27060]' : 
                      percentageOfBase > 50 ? 'text-[#d2a860]' : 
                      'text-[#60d28e]'
                    }>
                      {percentageOfBase.toFixed(1)}% del costo base
                    </span>
                  ) : null}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div className="bg-white border border-gray-200 rounded p-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">Total Horas</div>
                    <div className="text-sm font-medium">{totalHours}</div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600" />
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
              
              {/* Barra de progreso del costo del equipo */}
              {baseCost > 0 && (
                <div className="mt-1">
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
          </>
        ) : (
          <div className="text-center py-8 bg-gray-50 border-t border-gray-200">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-700 mb-1">No hay miembros en el equipo</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mb-4 px-6">
              {quotationData.teamOption === 'auto' 
                ? "Haz clic en 'Aplicar Equipo Recomendado' para añadir automáticamente los roles recomendados."
                : "Utiliza el formulario anterior para añadir miembros al equipo del proyecto."}
            </p>
            
            {quotationData.teamOption === 'auto' && recommendedRoleIds.length > 0 && (
              <Button 
                onClick={applyRecommendedTeam}
                className="flex items-center mx-auto bg-primary/90 hover:bg-primary h-8 text-xs"
                size="sm"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Aplicar Equipo Recomendado
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizedTeamConfig;