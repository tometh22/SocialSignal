import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Role, Personnel } from '@shared/schema';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { formatCurrency } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { 
  UserCircle, 
  Users, 
  Clock, 
  DollarSign, 
  Trash2, 
  Plus,
  UserPlus,
  Settings,
  BarChart3
} from 'lucide-react';

// Componente para el Paso 3: Configuración de Equipo
const OptimizedTeamConfig: React.FC = () => {
  const {
    quotationData,
    setTeamOption,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    applyRecommendedTeam,
    baseCost,
    recommendedRoleIds,
    availableRoles,
    availablePersonnel
  } = useOptimizedQuote();
  
  const [selectedTab, setSelectedTab] = useState(quotationData.teamOption);
  const [newMember, setNewMember] = useState({
    roleId: '',
    personnelId: '',
    hours: '40',
  });
  
  // Obtener roles y personal si no están disponibles en el contexto
  const { data: rolesData } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
    enabled: !availableRoles,
  });
  
  const { data: personnelData } = useQuery<Personnel[]>({
    queryKey: ['/api/personnel'],
    enabled: !availablePersonnel,
  });
  
  // Usar datos del contexto o de las consultas
  const roles = availableRoles || rolesData;
  const personnel = availablePersonnel || personnelData;
  
  // Cambiar opción de equipo
  const handleTabChange = (value: string) => {
    setSelectedTab(value as 'auto' | 'manual');
    setTeamOption(value as 'auto' | 'manual');
  };
  
  // Añadir nuevo miembro al equipo
  const handleAddMember = () => {
    if (!newMember.roleId || !newMember.hours || Number(newMember.hours) <= 0) {
      return;
    }
    
    const role = roles?.find(r => r.id.toString() === newMember.roleId);
    if (!role) return;
    
    const hours = Number(newMember.hours);
    const rate = role.defaultRate;
    
    addTeamMember({
      roleId: Number(newMember.roleId),
      personnelId: newMember.personnelId ? Number(newMember.personnelId) : null,
      hours,
      rate,
      cost: hours * rate
    });
    
    // Limpiar formulario
    setNewMember({
      roleId: '',
      personnelId: '',
      hours: '40',
    });
  };
  
  // Actualizar horas de un miembro del equipo
  const handleUpdateHours = (id: string, hours: number) => {
    if (hours <= 0) return;
    
    updateTeamMember(id, { hours });
  };
  
  // Verificar si un rol está recomendado
  const isRoleRecommended = (roleId: number) => {
    return recommendedRoleIds.includes(roleId);
  };
  
  // Preparar datos para el gráfico de distribución de costos
  const costDistributionData = React.useMemo(() => {
    if (!quotationData.teamMembers.length || !roles) return [];
    
    // Agrupar costos por rol
    const roleCosts: Record<number, number> = {};
    quotationData.teamMembers.forEach(member => {
      roleCosts[member.roleId] = (roleCosts[member.roleId] || 0) + member.cost;
    });
    
    // Convertir a formato para el gráfico
    return Object.entries(roleCosts).map(([roleId, cost]) => {
      const role = roles.find(r => r.id === Number(roleId));
      return {
        name: role ? role.name : `Rol ${roleId}`,
        value: cost,
      };
    });
  }, [quotationData.teamMembers, roles]);
  
  // Colores para el gráfico
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A259FF', '#4CAF50', '#F44336'];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Configuración del Equipo</h2>
          <p className="text-sm text-neutral-500">
            Configura el equipo del proyecto seleccionando roles o personas específicas.
          </p>
        </div>
      </div>
      
      {/* Pestañas para opciones de equipo */}
      <Tabs 
        value={selectedTab} 
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="auto" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Recomendación Automática
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Asignación Manual
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="auto" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Equipo Recomendado</CardTitle>
              <CardDescription>
                Basado en la plantilla seleccionada, te recomendamos el siguiente equipo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quotationData.template ? (
                <>
                  <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
                    <Users className="h-6 w-6 text-blue-500" />
                    <div>
                      <p className="font-medium text-blue-800">
                        {recommendedRoleIds.length} roles recomendados para la plantilla "{quotationData.template.name}"
                      </p>
                      <p className="text-xs text-blue-600">
                        Esta configuración se ha optimizado en base a proyectos anteriores similares.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                    {roles?.filter(role => recommendedRoleIds.includes(role.id)).map(role => (
                      <div 
                        key={role.id} 
                        className="border rounded-md p-3 bg-blue-50 border-blue-100"
                      >
                        <div className="font-medium text-blue-800">{role.name}</div>
                        <div className="text-xs text-blue-600 mt-1">
                          Tarifa: {formatCurrency(role.defaultRate)}/hora
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-center mt-6">
                    <Button
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={applyRecommendedTeam}
                    >
                      <UserCircle className="mr-2 h-4 w-4" />
                      Aplicar Equipo Recomendado
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-neutral-500">
                    Por favor, selecciona una plantilla primero para ver el equipo recomendado.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {quotationData.teamMembers.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Equipo Aplicado</CardTitle>
                <CardDescription>
                  Esta configuración ha sido aplicada a tu cotización.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rol</TableHead>
                      <TableHead>Miembro</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Tarifa</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotationData.teamMembers.map(member => {
                      const role = roles?.find(r => r.id === member.roleId);
                      const person = personnel?.find(p => p.id === member.personnelId);
                      
                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {role?.name || 'Rol desconocido'}
                              {isRoleRecommended(member.roleId) && (
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                                  Recomendado
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{person?.name || 'No asignado'}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 rounded-r-none"
                                onClick={() => handleUpdateHours(member.id, Math.max(1, member.hours - 5))}
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                value={member.hours}
                                onChange={(e) => handleUpdateHours(member.id, Number(e.target.value))}
                                className="h-6 rounded-none w-14 text-center"
                                min="1"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 rounded-l-none"
                                onClick={() => handleUpdateHours(member.id, member.hours + 5)}
                              >
                                +
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">${member.rate}/h</TableCell>
                          <TableCell className="font-mono">${member.cost.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => removeTeamMember(member.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="bg-neutral-50 border-t flex justify-between">
                <div className="text-sm font-medium">Total de miembros: {quotationData.teamMembers.length}</div>
                <div className="text-sm font-medium">
                  Costo base: {formatCurrency(baseCost)}
                </div>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="manual" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              {/* Formulario para añadir miembros */}
              <Card>
                <CardHeader>
                  <CardTitle>Añadir Miembro al Equipo</CardTitle>
                  <CardDescription>
                    Configura manualmente los miembros del equipo para tu proyecto.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="role">Rol</Label>
                      <Select 
                        value={newMember.roleId} 
                        onValueChange={(value) => setNewMember({...newMember, roleId: value})}
                      >
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles?.map(role => (
                            <SelectItem 
                              key={role.id} 
                              value={role.id.toString()}
                              className={isRoleRecommended(role.id) ? 'text-blue-600 font-medium' : ''}
                            >
                              {role.name} {isRoleRecommended(role.id) && '✓'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="hours">Horas</Label>
                      <Input
                        id="hours"
                        type="number"
                        min="1"
                        value={newMember.hours}
                        onChange={(e) => setNewMember({...newMember, hours: e.target.value})}
                      />
                    </div>
                    
                    <div className="flex items-end">
                      <Button onClick={handleAddMember} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Añadir
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Label htmlFor="person">Asignar a persona específica (opcional)</Label>
                    <Select 
                      value={newMember.personnelId} 
                      onValueChange={(value) => setNewMember({...newMember, personnelId: value})}
                    >
                      <SelectTrigger id="person">
                        <SelectValue placeholder="Selecciona una persona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No asignado</SelectItem>
                        {personnel?.map(person => (
                          <SelectItem key={person.id} value={person.id.toString()}>
                            {person.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
              
              {/* Tabla de miembros agregados */}
              {quotationData.teamMembers.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Miembros del Equipo</CardTitle>
                    <CardDescription>
                      Equipo configurado para el proyecto.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rol</TableHead>
                          <TableHead>Miembro</TableHead>
                          <TableHead>Horas</TableHead>
                          <TableHead>Tarifa</TableHead>
                          <TableHead>Subtotal</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quotationData.teamMembers.map(member => {
                          const role = roles?.find(r => r.id === member.roleId);
                          const person = personnel?.find(p => p.id === member.personnelId);
                          
                          return (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {role?.name || 'Rol desconocido'}
                                  {isRoleRecommended(member.roleId) && (
                                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                                      Recomendado
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{person?.name || 'No asignado'}</TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6 rounded-r-none"
                                    onClick={() => handleUpdateHours(member.id, Math.max(1, member.hours - 5))}
                                  >
                                    -
                                  </Button>
                                  <Input
                                    type="number"
                                    value={member.hours}
                                    onChange={(e) => handleUpdateHours(member.id, Number(e.target.value))}
                                    className="h-6 rounded-none w-14 text-center"
                                    min="1"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6 rounded-l-none"
                                    onClick={() => handleUpdateHours(member.id, member.hours + 5)}
                                  >
                                    +
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono">${member.rate}/h</TableCell>
                              <TableCell className="font-mono">${member.cost.toFixed(2)}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => removeTeamMember(member.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                  <CardFooter className="bg-neutral-50 border-t flex justify-between">
                    <div className="text-sm font-medium">Total de miembros: {quotationData.teamMembers.length}</div>
                    <div className="text-sm font-medium">
                      Costo base: {formatCurrency(baseCost)}
                    </div>
                  </CardFooter>
                </Card>
              ) : (
                <Card className="bg-neutral-50">
                  <CardContent className="pt-6 pb-6 text-center">
                    <UserCircle className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                    <h3 className="text-neutral-600 font-medium mb-2">Sin miembros en el equipo</h3>
                    <p className="text-neutral-500 text-sm">
                      Añade miembros al equipo utilizando el formulario superior o cambia a la pestaña de recomendación automática.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
            
            <div className="space-y-6">
              {/* Roles recomendados */}
              <Card>
                <CardHeader>
                  <CardTitle>Roles Recomendados</CardTitle>
                  <CardDescription>
                    Basados en la plantilla seleccionada.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {recommendedRoleIds.length > 0 ? (
                    <div className="space-y-2">
                      {roles?.filter(role => recommendedRoleIds.includes(role.id)).map(role => (
                        <div 
                          key={role.id} 
                          className="flex justify-between items-center border-b pb-2 last:border-0"
                        >
                          <div className="font-medium">{role.name}</div>
                          <Button 
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (!role) return;
                              
                              addTeamMember({
                                roleId: role.id,
                                personnelId: null,
                                hours: 40,
                                rate: role.defaultRate,
                                cost: 40 * role.defaultRate
                              });
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Añadir
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-neutral-500 text-sm">
                        No hay roles recomendados disponibles.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Gráfico de distribución de costos */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Costos</CardTitle>
                  <CardDescription>
                    Proporción de costos por rol.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {costDistributionData.length > 0 ? (
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={costDistributionData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {costDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value as number)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[250px]">
                      <BarChart3 className="h-12 w-12 text-neutral-300" />
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Resumen de horas y costos */}
              <Card className="bg-blue-50 border-blue-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-blue-800">Resumen de Recursos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-blue-700">
                        <UserCircle className="h-5 w-5 mr-2" />
                        <span>Total Miembros:</span>
                      </div>
                      <div className="font-medium text-blue-800">
                        {quotationData.teamMembers.length}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-blue-700">
                        <Clock className="h-5 w-5 mr-2" />
                        <span>Total Horas:</span>
                      </div>
                      <div className="font-medium text-blue-800">
                        {quotationData.teamMembers.reduce((sum, m) => sum + m.hours, 0)}h
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-blue-700">
                        <DollarSign className="h-5 w-5 mr-2" />
                        <span>Costo Base:</span>
                      </div>
                      <div className="font-medium text-blue-800">
                        {formatCurrency(baseCost)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OptimizedTeamConfig;