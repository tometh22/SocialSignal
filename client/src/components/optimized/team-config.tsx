import React, { useState, useEffect } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Personnel, Role } from '@shared/schema';
import { AlertCircle, Plus, Trash, UserPlus, Users } from 'lucide-react';

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

  // Manejar la adición de un nuevo miembro
  const handleAddMember = () => {
    if (newMember.roleId > 0 && newMember.hours > 0 && newMember.rate > 0) {
      // Calcular costo
      const cost = newMember.hours * newMember.rate;
      
      // Añadir miembro
      addTeamMember({
        ...newMember,
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

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Configuración del Equipo</h2>
        <p className="text-sm text-neutral-500">
          Define el equipo que trabajará en el proyecto.
        </p>
      </div>

      {/* Selección de modo de equipo */}
      <div className="space-y-3">
        <Label>Modo de Configuración</Label>
        <RadioGroup 
          value={quotationData.teamOption} 
          onValueChange={(value) => setTeamOption(value as 'auto' | 'manual')}
          className="flex space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="auto" id="team-auto" />
            <Label htmlFor="team-auto" className="cursor-pointer">Equipo Recomendado</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="manual" id="team-manual" />
            <Label htmlFor="team-manual" className="cursor-pointer">Configuración Manual</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Equipo recomendado (Modo Auto) */}
      {quotationData.teamOption === 'auto' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <Users className="h-4 w-4 mr-2 text-primary" />
                Equipo Recomendado
              </CardTitle>
              <CardDescription>
                Basado en la plantilla y complejidad seleccionadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {quotationData.template ? (
                <>
                  {recommendedRoleIds.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {recommendedRoleIds.map(roleId => {
                          const role = availableRoles?.find(r => r.id === roleId);
                          return role ? (
                            <Badge key={roleId} variant="outline" className="bg-primary/5 border-primary/20">
                              {role.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                      
                      <div className="flex justify-end">
                        <Button 
                          onClick={applyRecommendedTeam}
                          className="flex items-center"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Aplicar Equipo Recomendado
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Alert variant="default" className="bg-amber-50 text-amber-800 border-amber-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>No hay recomendaciones disponibles</AlertTitle>
                      <AlertDescription>
                        La plantilla seleccionada no tiene roles recomendados. 
                        Puedes configurar el equipo manualmente.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <Alert variant="default" className="bg-blue-50 text-blue-800 border-blue-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Selecciona una plantilla primero</AlertTitle>
                  <AlertDescription>
                    Para ver el equipo recomendado, primero debes seleccionar una plantilla
                    en el paso anterior.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Configuración manual */}
      {quotationData.teamOption === 'manual' && (
        <div className="space-y-4">
          {/* Formulario para añadir miembros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Añadir Miembro al Equipo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Selección de rol */}
                <div className="space-y-2">
                  <Label htmlFor="role-select">Rol</Label>
                  <Select
                    value={newMember.roleId ? String(newMember.roleId) : ''}
                    onValueChange={(value) => {
                      setNewMember(prev => ({
                        ...prev,
                        roleId: parseInt(value),
                        personnelId: null // Resetear el personal al cambiar rol
                      }));
                    }}
                  >
                    <SelectTrigger id="role-select">
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles?.map(role => (
                        <SelectItem 
                          key={role.id} 
                          value={String(role.id)}
                          className="flex items-center"
                        >
                          <div className="flex items-center">
                            {role.name}
                            {isRoleRecommended(role.id) && (
                              <Badge className="ml-2 bg-primary/10 text-primary border-0 text-xs px-1">
                                Recomendado
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selección de personal (opcional) */}
                <div className="space-y-2">
                  <Label htmlFor="personnel-select">Personal (Opcional)</Label>
                  <Select
                    value={newMember.personnelId ? String(newMember.personnelId) : ''}
                    onValueChange={(value) => {
                      setNewMember(prev => ({
                        ...prev,
                        personnelId: value ? parseInt(value) : null
                      }));
                    }}
                    disabled={!newMember.roleId}
                  >
                    <SelectTrigger id="personnel-select">
                      <SelectValue placeholder="Seleccionar personal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin asignar</SelectItem>
                      {filteredPersonnel?.map(person => (
                        <SelectItem key={person.id} value={String(person.id)}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Horas */}
                <div className="space-y-2">
                  <Label htmlFor="hours-input">Horas</Label>
                  <Input
                    id="hours-input"
                    type="number"
                    min="1"
                    value={newMember.hours}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setNewMember(prev => ({
                        ...prev,
                        hours: isNaN(value) ? 0 : value
                      }));
                    }}
                  />
                </div>

                {/* Tarifa */}
                <div className="space-y-2">
                  <Label htmlFor="rate-input">Tarifa ($/hora)</Label>
                  <Input
                    id="rate-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newMember.rate}
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

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleAddMember}
                  disabled={!newMember.roleId || newMember.hours <= 0 || newMember.rate <= 0}
                  className="flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir al Equipo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla de miembros del equipo */}
      {quotationData.teamMembers.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Equipo del Proyecto</CardTitle>
              <Badge variant="outline" className="bg-primary/5 border-primary/20 flex items-center">
                {quotationData.teamMembers.length} Miembros
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rol</TableHead>
                    <TableHead>Personal</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Tarifa ($/h)</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotationData.teamMembers.map(member => {
                    const role = availableRoles?.find(r => r.id === member.roleId);
                    const person = availablePersonnel?.find(p => p.id === member.personnelId);
                    
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            {role?.name || `Rol ID: ${member.roleId}`}
                            {isRoleRecommended(member.roleId) && (
                              <Badge className="ml-2 bg-primary/10 text-primary border-0 text-xs px-1">
                                Rec.
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {person?.name || "Sin asignar"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="1"
                            value={member.hours}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (!isNaN(value) && value > 0) {
                                updateTeamMember(member.id, {
                                  hours: value,
                                  cost: value * member.rate
                                });
                              }
                            }}
                            className="w-20 h-8 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={member.rate}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0) {
                                updateTeamMember(member.id, {
                                  rate: value,
                                  cost: value * member.hours
                                });
                              }
                            }}
                            className="w-24 h-8 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${member.cost.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTeamMember(member.id)}
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="mt-4 flex justify-between items-center p-2 bg-slate-50 rounded-md">
              <div className="space-y-1">
                <div className="text-sm font-medium">Resumen del Equipo</div>
                <div className="text-sm text-slate-500">
                  {totalHours} horas totales • {quotationData.teamMembers.length} miembros
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">Costo Total del Equipo</div>
                <div className="text-lg font-bold text-primary">${totalTeamCost.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay miembros en el equipo</h3>
            <p className="text-slate-500 mb-4 max-w-md">
              {quotationData.teamOption === 'auto' 
                ? "Usa el botón 'Aplicar Equipo Recomendado' para añadir automáticamente los roles recomendados."
                : "Usa el formulario superior para añadir miembros al equipo del proyecto."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Porcentaje costo base vs equipo */}
      {quotationData.teamMembers.length > 0 && baseCost > 0 && (
        <Alert variant="default" className="bg-blue-50 text-blue-800 border-blue-200">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
            <div>
              <AlertTitle className="mb-1">Análisis de Costo</AlertTitle>
              <AlertDescription>
                El costo del equipo representa aproximadamente el{' '}
                <span className="font-semibold">
                  {Math.round((totalTeamCost / baseCost) * 100)}%
                </span>{' '}
                del costo base del proyecto. Asegúrate de que esto coincida con tus expectativas.
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}
    </div>
  );
};

export default OptimizedTeamConfig;