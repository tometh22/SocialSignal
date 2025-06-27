import React, { useState, useEffect, useRef } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Personnel, Role } from '@shared/schema';
import { parseDecimalInput } from '@/lib/number-utils';
import { 
  Clock, 
  UserPlus, 
  Users, 
  Edit, 
  Check, 
  X, 
  Trash2, 
  GripVertical,
  Plus,
  Calculator,
  Star,
  User,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

interface DragDropTeamMember {
  id: string;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
  cost: number;
}

const EnhancedTeamConfig: React.FC = () => {
  const {
    quotationData,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    updateTeamMembers,
    loadRoles,
    loadPersonnel,
    availableRoles,
    availablePersonnel,
    recommendedRoleIds
  } = useOptimizedQuote();

  // Estados para la nueva UI
  const [draggedMembers, setDraggedMembers] = useState<DragDropTeamMember[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);

  // Estados para agregar miembros rápidamente
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [showRoleDetails, setShowRoleDetails] = useState(false);
  const [selectedQuickRoles, setSelectedQuickRoles] = useState<Set<number>>(new Set());

  // Estado para el formulario de nuevo miembro
  const [newMember, setNewMember] = useState({
    roleId: 0,
    personnelId: null as number | null,
    hours: 40,
    rate: 0
  });

  // Estados para edición inline
  const [editValues, setEditValues] = useState<Record<string, {hours: number, rate: number}>>({});
  // Estados temporales para edición que permiten strings vacías
  const [tempEditValues, setTempEditValues] = useState<Record<string, {hours: string, rate: string}>>({});

  // Sincronizar con el contexto
  useEffect(() => {
    const members: DragDropTeamMember[] = quotationData.teamMembers.map(member => ({
      id: member.id,
      roleId: member.roleId,
      personnelId: member.personnelId,
      hours: member.hours,
      rate: member.rate,
      cost: member.cost
    }));
    setDraggedMembers(members);
  }, [quotationData.teamMembers]);

  // Cargar datos iniciales
  useEffect(() => {
    loadRoles();
    loadPersonnel();
  }, [loadRoles, loadPersonnel]);

  // Obtener información del rol
  const getRoleInfo = (roleId: number) => {
    return availableRoles.find(role => role.id === roleId);
  };

  // Obtener información del personal
  const getPersonnelInfo = (personnelId: number | null) => {
    if (!personnelId) return null;
    return availablePersonnel.find(person => person.id === personnelId);
  };

  // Manejar reordenamiento drag & drop
  const handleReorder = (newOrder: DragDropTeamMember[]) => {
    setDraggedMembers(newOrder);
    // Actualizar el contexto con el nuevo orden
    const reorderedMembers = newOrder.map(member => ({
      id: member.id,
      roleId: member.roleId,
      personnelId: member.personnelId,
      hours: member.hours,
      rate: member.rate,
      cost: member.cost
    }));
    updateTeamMembers(reorderedMembers);
  };

  // Agregar miembro rápido (solo rol)
  // const handleQuickAdd = (roleId: number) => {
  //   const role = getRoleInfo(roleId);
  //   if (role) {
  //     const hours = 40;
  //     const rate = role.defaultRate || 50;
  //     addTeamMember({
  //       roleId,
  //       personnelId: null,
  //       hours,
  //       rate,
  //       cost: 0 // Will be recalculated by the context
  //     });
  //   }
  //   setQuickAddMode(false);
  // };

  // Función para manejar el toggle de selección rápida de roles
  const handleQuickRoleToggle = (roleId: number) => {
    setSelectedQuickRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roleId)) {
        newSet.delete(roleId);
      } else {
        newSet.add(roleId);
      }
      return newSet;
    });
  };

  // Función para agregar los roles seleccionados
  const handleQuickAddSelected = () => {
    selectedQuickRoles.forEach(roleId => {
      const role = getRoleInfo(roleId);
      if (role) {
        const hours = 40;
        const rate = role.defaultRate || 50;
        addTeamMember({
          roleId,
          personnelId: null,
          hours,
          rate,
          cost: 0 // Will be recalculated by the context
        });
      }
    });
    setQuickAddMode(false);
    setSelectedQuickRoles(new Set());
  };


  // Agregar miembro completo
  const handleAddMember = () => {
    if (newMember.roleId > 0) {
      addTeamMember({
        ...newMember,
        cost: 0 // Will be recalculated by the context
      });
      setNewMember({
        roleId: 0,
        personnelId: null,
        hours: 40,
        rate: 0
      });
      setShowAddForm(false);
    }
  };

  // Iniciar edición
  const startEditing = (memberId: string, currentHours: number, currentRate: number) => {
    setEditingMember(memberId);
    setEditValues(prev => ({
      ...prev,
      [memberId]: { hours: currentHours, rate: currentRate }
    }));
    // Inicializar valores temporales como strings
    setTempEditValues(prev => ({
      ...prev,
      [memberId]: { 
        hours: currentHours.toString(), 
        rate: currentRate.toString() 
      }
    }));
  };

  // Guardar edición
  const saveEdit = (memberId: string) => {
    const values = editValues[memberId];
    if (values) {
      updateTeamMember(memberId, {
        hours: typeof values.hours === 'string' ? (parseInt(values.hours) || 0) : values.hours,
        rate: typeof values.rate === 'string' ? (parseFloat(values.rate) || 0) : values.rate
      });
    }
    setEditingMember(null);
  };

  // Cancelar edición
  const cancelEdit = () => {
    setEditingMember(null);
    setEditValues({});
  };

  // Calcular totales
  const totalCost = draggedMembers.reduce((sum, member) => sum + member.cost, 0);
  const totalHours = draggedMembers.reduce((sum, member) => sum + member.hours, 0);

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center text-xl">
                <Users className="mr-3 h-6 w-6 text-primary" />
                Configuración del Equipo
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Define los roles y personal que trabajarán en este proyecto
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{draggedMembers.length}</div>
              <div className="text-xs text-muted-foreground">miembros</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Total horas:</span>
              <span className="font-bold text-blue-600">{totalHours}h</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calculator className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Costo total:</span>
              <span className="font-bold text-green-600">${totalCost.toLocaleString()}</span>
            </div>
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Promedio/hora:</span>
              <span className="font-bold text-purple-600">
                ${totalHours > 0 ? (totalCost / totalHours).toFixed(0) : 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-3">
        <Button 
          onClick={() => setQuickAddMode(!quickAddMode)}
          variant="outline" 
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar Rápido
        </Button>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Configurar Miembro
        </Button>
      </div>

      {/* Modo de agregado rápido */}
        {quickAddMode && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-medium text-blue-900">Selecciona roles para agregar rápidamente:</h4>
                <p className="text-xs text-blue-600 mt-1">
                  {selectedQuickRoles.size > 0 
                    ? `${selectedQuickRoles.size} rol${selectedQuickRoles.size > 1 ? 'es' : ''} seleccionado${selectedQuickRoles.size > 1 ? 's' : ''}`
                    : 'Haz clic en los roles que deseas agregar'
                  }
                </p>
              </div>
              <div className="flex gap-2">
                {selectedQuickRoles.size > 0 && (
                  <Button 
                    size="sm"
                    onClick={handleQuickAddSelected}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs"
                  >
                    Agregar {selectedQuickRoles.size} rol{selectedQuickRoles.size > 1 ? 'es' : ''}
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setQuickAddMode(false);
                    setSelectedQuickRoles(new Set());
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {availableRoles.map(role => {
                const isSelected = selectedQuickRoles.has(role.id);
                const isAlreadyInTeam = quotationData.teamMembers.some(member => member.roleId === role.id);

                return (
                  <Button
                    key={role.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleQuickRoleToggle(role.id)}
                    disabled={isAlreadyInTeam}
                    className={`text-xs p-2 h-auto text-left justify-start transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : isAlreadyInTeam
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white hover:bg-blue-100 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center w-full">
                      <div className="flex-grow">
                        <div className="font-medium">{role.name}</div>
                        <div className={`${isSelected ? 'text-blue-200' : 'text-gray-500'}`}>
                          ${role.defaultRate}/h
                        </div>
                      </div>
                      {isSelected && (
                        <div className="ml-2 text-white">✓</div>
                      )}
                      {isAlreadyInTeam && (
                        <div className="ml-2 text-gray-400 text-xs">Ya agregado</div>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

      {/* Formulario completo */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Configurar Nuevo Miembro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol *</Label>
                    <Select 
                      value={newMember.roleId > 0 ? newMember.roleId.toString() : "0"} 
                      onValueChange={(value) => {
                        const roleId = parseInt(value) || 0;
                        const role = getRoleInfo(roleId);
                        setNewMember(prev => ({
                          ...prev,
                          roleId,
                          rate: role?.defaultRate || prev.rate
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Seleccionar rol</SelectItem>
                        {availableRoles.map(role => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <span>{role.name}</span>
                              {recommendedRoleIds.includes(role.id) && (
                                <Star className="h-3 w-3 text-yellow-500 ml-2" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="personnel">Personal (opcional)</Label>
                    <Select 
                      value={newMember.personnelId?.toString() || "0"} 
                      onValueChange={(value) => setNewMember(prev => ({
                        ...prev,
                        personnelId: value && value !== "0" ? parseInt(value) : null
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar persona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sin asignar</SelectItem>
                        {availablePersonnel.map(person => (
                          <SelectItem key={person.id} value={person.id.toString()}>
                            {person.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hours">Horas</Label>
                    <Input
                      id="hours"
                      type="number"
                      value={newMember.hours}
                      onChange={(e) => setNewMember(prev => ({
                        ...prev,
                        hours: parseInt(e.target.value) || 0
                      }))}
                      placeholder="40"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rate">Tarifa ($/h)</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      value={newMember.rate}
                      onChange={(e) => setNewMember(prev => ({
                        ...prev,
                        rate: parseDecimalInput(e.target.value)
                      }))}
                      placeholder="50.00"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddMember} disabled={newMember.roleId === 0}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Agregar al Equipo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de miembros con drag & drop */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Equipo del Proyecto</h3>
          {draggedMembers.length > 1 && (
            <Badge variant="secondary" className="text-xs">
              Arrastra para reordenar
            </Badge>
          )}
        </div>

        <AnimatePresence>
          {draggedMembers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">
                No hay miembros en el equipo
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Utiliza el formulario anterior para añadir miembros al equipo del proyecto
              </p>
            </motion.div>
          ) : (
            <Reorder.Group 
              axis="y" 
              values={draggedMembers} 
              onReorder={handleReorder}
              className="space-y-3"
            >
              {draggedMembers.map((member) => {
                const role = getRoleInfo(member.roleId);
                const personnel = getPersonnelInfo(member.personnelId);
                const isEditing = editingMember === member.id;

                return (
                  <Reorder.Item 
                    key={member.id} 
                    value={member}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className="hover:shadow-md transition-all border-l-4 border-l-primary/30">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-4">
                            {/* Drag handle */}
                            <div className="flex-shrink-0">
                              <GripVertical className="h-5 w-5 text-gray-400" />
                            </div>

                            {/* Role info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <Badge variant="outline" className="font-medium">
                                  {role?.name || 'Rol desconocido'}
                                </Badge>
                                {recommendedRoleIds.includes(member.roleId) && (
                                  <Star className="h-3 w-3 text-yellow-500" />
                                )}
                              </div>
                              <div className="flex items-center space-x-1 text-sm text-gray-600">
                                <User className="h-3 w-3" />
                                <span>{personnel?.name || 'Sin asignar'}</span>
                              </div>
                            </div>

                            {/* Hours and rate - editable */}
                            <div className="flex items-center space-x-4">
                              {isEditing ? (
                                <>
                                  <div className="flex items-center space-x-2">
                                    <Input
                                      type="number"
                                      value={editValues[member.id]?.hours !== undefined ? editValues[member.id].hours : member.hours}
                                      onChange={(e) => setEditValues(prev => ({
                                        ...prev,
                                        [member.id]: {
                                          ...prev[member.id],
                                          hours: e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                                        }
                                      }))}
                                      className="w-16 h-8 text-xs"
                                    />
                                    <span className="text-xs text-gray-500">h</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs">$</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editValues[member.id]?.rate || member.rate}
                                      onChange={(e) => setEditValues(prev => ({
                                        ...prev,
                                        [member.id]: {
                                          ...prev[member.id],
                                          rate: e.target.value
                                        }
                                      }))}
                                      className="w-20 h-8 text-xs"
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-center">
                                    <div className="font-medium text-sm">{member.hours}h</div>
                                    <div className="text-xs text-gray-500">horas</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-medium text-sm">${member.rate}</div>
                                    <div className="text-xs text-gray-500">por hora</div>
                                  </div>
                                </>
                              )}

                              {/* Cost */}
                              <div className="text-center">
                                <div className="font-bold text-lg text-primary">
                                  ${(() => {
                                    if (!isEditing) return member.cost;
                                    
                                    const hours = editValues[member.id]?.hours !== undefined 
                                      ? (typeof editValues[member.id]?.hours === 'string' 
                                          ? (parseFloat(editValues[member.id]?.hours as string) || 0) 
                                          : editValues[member.id]?.hours as number)
                                      : member.hours;
                                      
                                    const rate = editValues[member.id]?.rate !== undefined 
                                      ? (typeof editValues[member.id]?.rate === 'string' 
                                          ? (parseFloat(editValues[member.id]?.rate as string) || 0) 
                                          : editValues[member.id]?.rate as number)
                                      : member.rate;
                                      
                                    return hours * rate;
                                  })().toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">total</div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-1">
                              {isEditing ? (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => saveEdit(member.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    className="h-8 w-8 p-0"
                                  >
                                    <X className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => startEditing(member.id, member.hours, member.rate)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => removeTeamMember(member.id)}
                                    className="h-8 w-8 p-0 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EnhancedTeamConfig;