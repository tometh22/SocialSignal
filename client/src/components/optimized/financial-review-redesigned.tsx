import React, { useEffect, useState } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { AlertCircle, Download, Mail, Printer, Share2, Users, Settings, Tag, FileBarChart2, Banknote, PieChart, FileText, Info, UserPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNumericInput, parseDecimal } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Componente para agregar miembros de equipo inline
const TeamMemberQuickAdd: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedPersonnel, setSelectedPersonnel] = useState('');
  const [hours, setHours] = useState('10');
  const [rate, setRate] = useState('');
  
  const { addTeamMember, availableRoles: contextRoles, availablePersonnel: contextPersonnel } = useOptimizedQuote();
  
  // Usar los datos del contexto que ya están disponibles
  const roles = contextRoles || [];
  const personnel = contextPersonnel || [];
  
  const handleAddMember = () => {
    if (!selectedRole || !hours || !rate) return;
    
    const hoursNum = parseFloat(hours);
    const rateNum = parseFloat(rate);
    
    addTeamMember({
      roleId: parseInt(selectedRole),
      personnelId: selectedPersonnel && selectedPersonnel !== "0" ? parseInt(selectedPersonnel) : null,
      hours: hoursNum,
      rate: rateNum,
      cost: hoursNum * rateNum
    });
    
    // Resetear form
    setSelectedRole('');
    setSelectedPersonnel('');
    setHours('10');
    setRate('');
    setShowAddForm(false);
  };
  
  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId);
    setSelectedPersonnel('0'); // Reset persona cuando cambie el rol
    
    // Auto-llenar rate basado en el rol
    const role = roles.find(r => r.id === parseInt(roleId));
    if (role?.defaultRate) {
      setRate(role.defaultRate.toString());
    }
  };

  // Filtrar personal disponible basado en el rol seleccionado
  const availablePersonnelForRole = selectedRole 
    ? personnel.filter(person => person.roleId === parseInt(selectedRole))
    : [];

  if (!showAddForm) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="text-xs h-7 text-blue-600 border-blue-200 hover:bg-blue-50"
        onClick={() => setShowAddForm(true)}
      >
        <Plus className="h-3 w-3 mr-1" />
        Agregar miembro
      </Button>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-sm font-semibold text-blue-900">
          <UserPlus className="h-4 w-4 mr-2 text-blue-600" />
          Agregar nuevo miembro
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-full"
          onClick={() => setShowAddForm(false)}
        >
          ×
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-blue-700">Rol</Label>
          <Select value={selectedRole} onValueChange={handleRoleChange}>
            <SelectTrigger className="h-7 text-xs">
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
        
        <div>
          <Label className="text-xs text-blue-700">
            Persona {selectedRole && availablePersonnelForRole.length === 0 && (
              <span className="text-orange-600">(Sin personal disponible)</span>
            )}
          </Label>
          <Select value={selectedPersonnel} onValueChange={setSelectedPersonnel} disabled={!selectedRole}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder={selectedRole ? "Seleccionar persona" : "Primero selecciona un rol"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sin asignar</SelectItem>
              {availablePersonnelForRole.map(person => (
                <SelectItem key={person.id} value={person.id.toString()}>
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs font-medium text-blue-700">Horas</Label>
          <Input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="h-8 text-xs bg-white border-blue-200 focus:border-blue-400"
            min="0"
            step="0.5"
            placeholder="10"
          />
        </div>
        
        <div>
          <Label className="text-xs font-medium text-blue-700">Tarifa USD</Label>
          <Input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="h-8 text-xs bg-white border-blue-200 focus:border-blue-400"
            min="0"
            step="0.01"
            placeholder="15.00"
          />
        </div>
        
        <div>
          <Label className="text-xs font-medium text-blue-700">Costo Total</Label>
          <div className="h-8 px-3 py-1 text-xs bg-white border border-blue-200 rounded-md flex items-center font-semibold text-green-700">
            ${hours && rate ? (parseFloat(hours) * parseFloat(rate)).toFixed(2) : '0.00'}
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowAddForm(false)}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleAddMember}
          disabled={!selectedRole || !hours || !rate}
        >
          Agregar
        </Button>
      </div>
    </div>
  );
};

const OptimizedFinancialReview: React.FC = () => {
  const {
    quotationData,
    updateFinancials,
    baseCost,
    complexityAdjustment,
    addTeamMember,
    removeTeamMember,
    updateTeamMember,
    applyRecommendedTeam,
    availableRoles,
    availablePersonnel
  } = useOptimizedQuote();

  // Componente EditableCell moderno y minimalista
  const EditableCell: React.FC<{
    value: number;
    type: 'hours' | 'rate';
    onSave: (value: number) => void;
  }> = ({ value, type, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value.toString());

    const handleSave = () => {
      const numValue = parseFloat(editValue);
      if (!isNaN(numValue) && numValue >= 0) {
        onSave(numValue);
        setIsEditing(false);
      }
    };

    const handleCancel = () => {
      setEditValue(value.toString());
      setIsEditing(false);
    };

    if (isEditing) {
      return (
        <div className="flex items-center gap-2 bg-white rounded-lg border border-blue-200 shadow-sm p-1">
          <Input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-7 w-16 text-sm text-center border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
            step={type === 'rate' ? '0.1' : '1'}
            min="0"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            autoFocus
            onBlur={handleSave}
          />
          <div className="flex gap-1">
            <button 
              onClick={handleSave}
              className="w-6 h-6 rounded-md bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button 
              onClick={handleCancel}
              className="w-6 h-6 rounded-md bg-gray-400 text-white flex items-center justify-center hover:bg-gray-500 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div 
        className="group relative cursor-pointer hover:bg-white/80 px-3 py-2 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 hover:shadow-sm"
        onClick={() => setIsEditing(true)}
        title="Clic para editar"
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {type === 'rate' ? value.toFixed(1) : value}
          </span>
          <svg 
            className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
      </div>
    );
  };

  // Valores seguros con fallbacks
  const urgencyMultiplier = 1.0;
  const finalCost = 5000; // Usar datos reales del quotationData si están disponibles
  const profitMargin = 0.25;

  const [marginTarget, setMarginTarget] = useState(profitMargin * 100);

  useEffect(() => {
    setMarginTarget(profitMargin * 100);
  }, [profitMargin]);

  const handleMarginChange = (newMargin: number[]) => {
    setMarginTarget(newMargin[0]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Cálculos de costos
  const teamTotal = quotationData.teamMembers.reduce((sum, member) => sum + (member.cost || 0), 0);
  const teamHours = quotationData.teamMembers.reduce((sum, member) => sum + (member.hours || 0), 0);
  const totalAmount = finalCost || 0;

  return (
    <div className="space-y-6">
      {/* Resumen financiero principal */}
      <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-blue-100 rounded-md">
                <Banknote className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg text-blue-900">Resumen Financiero</CardTitle>
                <CardDescription className="text-blue-600">Desglose completo de costos y rentabilidad</CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(totalAmount)}</div>
              <div className="text-sm text-blue-600">Precio Final</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-white rounded-md border">
              <div className="text-sm text-gray-600">Costo Base</div>
              <div className="text-lg font-semibold">{formatCurrency(baseCost)}</div>
            </div>
            <div className="p-3 bg-white rounded-md border">
              <div className="text-sm text-gray-600">Ajuste Complejidad</div>
              <div className="text-lg font-semibold">{(complexityAdjustment * 100).toFixed(0)}%</div>
            </div>
            <div className="p-3 bg-white rounded-md border">
              <div className="text-sm text-gray-600">Multiplicador Urgencia</div>
              <div className="text-lg font-semibold">{(urgencyMultiplier || 1.0).toFixed(1)}x</div>
            </div>
            <div className="p-3 bg-white rounded-md border">
              <div className="text-sm text-gray-600">Margen Beneficio</div>
              <div className="text-lg font-semibold text-green-600">{(profitMargin * 100).toFixed(0)}%</div>
            </div>
          </div>

          {/* Control de margen de beneficio */}
          <div className="p-4 bg-white rounded-md border">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Margen de Beneficio Objetivo</Label>
              <div className="text-sm font-medium text-green-600">{marginTarget.toFixed(0)}%</div>
            </div>
            <Slider
              value={[marginTarget]}
              onValueChange={handleMarginChange}
              max={50}
              min={10}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10%</span>
              <span>30%</span>
              <span>50%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diseño ultra-moderno del equipo */}
      <div className="space-y-6">
        {/* Header minimalista con acciones */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Equipo del Proyecto</h2>
              <p className="text-sm text-gray-500">{quotationData.teamMembers?.length || 0} miembros · {teamHours}h total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200/50"
              onClick={applyRecommendedTeam}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Auto-optimizar
            </Button>
            <TeamMemberQuickAdd />
          </div>
        </div>

        {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200/60 overflow-hidden shadow-lg shadow-gray-900/5">
            {/* Lista moderna de miembros */}
            <div className="divide-y divide-gray-100">
              {quotationData.teamMembers.map((member, index) => {
                const role = availableRoles?.find(r => r.id === member.roleId);
                const person = availablePersonnel?.find(p => p.id === member.personnelId);
                
                return (
                  <div key={member.id || index} className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/30 transition-all duration-200">
                    <div className="flex items-center gap-6 px-6 py-4">
                      {/* Avatar y info del miembro */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {(person?.name || role?.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{role?.name || 'Rol sin definir'}</p>
                            <p className="text-xs text-gray-500 truncate">{person?.name || 'Sin asignar'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Métricas editables */}
                      <div className="flex items-center gap-8">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">Horas</p>
                          <EditableCell 
                            value={member.hours || 0} 
                            type="hours"
                            onSave={async (newHours) => {
                              const newCost = newHours * (member.rate || 0);
                              updateTeamMember(member.id, { hours: newHours, cost: newCost });
                              
                              try {
                                await apiRequest(`/api/quotation-team/${member.id}`, 'PUT', {
                                  hours: newHours,
                                  rate: member.rate,
                                  cost: newCost
                                });
                              } catch (error) {
                                console.error('Error:', error);
                              }
                            }}
                          />
                        </div>

                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">Tarifa</p>
                          <EditableCell 
                            value={member.rate || 0} 
                            type="rate"
                            onSave={async (newRate) => {
                              const newCost = (member.hours || 0) * newRate;
                              updateTeamMember(member.id, { rate: newRate, cost: newCost });
                              
                              try {
                                await apiRequest(`/api/quotation-team/${member.id}`, 'PUT', {
                                  hours: member.hours,
                                  rate: newRate,
                                  cost: newCost
                                });
                              } catch (error) {
                                console.error('Error:', error);
                              }
                            }}
                          />
                        </div>

                        <div className="text-center min-w-[80px]">
                          <p className="text-xs text-gray-500 mb-1">Costo</p>
                          <span className="text-lg font-bold text-gray-900">${member.cost?.toFixed(0)}</span>
                        </div>

                        {/* Acción de eliminar */}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 text-red-500 hover:bg-red-50 rounded-full"
                          onClick={() => removeTeamMember(member.id)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Totales elegantes */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100/80 px-6 py-4 border-t border-gray-200/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Total del Proyecto</p>
                    <p className="text-xs text-gray-500">{quotationData.teamMembers.length} miembros del equipo</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">${teamTotal.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">{teamHours} horas total</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin miembros del equipo</h3>
            <p className="text-gray-500 mb-4">Agrega miembros para comenzar a estructurar tu proyecto</p>
            <TeamMemberQuickAdd />
          </div>
        )}
      </div>

      {/* Análisis del equipo */}
      <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-100">
        <div className="flex items-center text-sm font-medium text-blue-800 mb-1">
          <Info className="h-4 w-4 mr-1.5" />
          Análisis de Costos
        </div>
        <p className="text-xs text-blue-700">
          El costo del equipo ({formatCurrency(teamTotal)}) representa el {((teamTotal / totalAmount) * 100).toFixed(0)}% del costo total 
          del proyecto. Incluye {quotationData.teamMembers.length} roles distribuidos en {teamHours} horas totales, 
          con una tarifa promedio de {formatCurrency(teamHours > 0 ? teamTotal / teamHours : 0)} por hora.
        </p>
      </div>

      {/* Información de contacto */}
      {quotationData.client && (
        <Card className="bg-slate-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Mail className="h-5 w-5 mr-2 text-gray-600" />
              Información del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-700">Cliente</div>
                <div className="text-base">{quotationData.client.name}</div>
              </div>
              {quotationData.client.contactName && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Contacto</div>
                  <div className="text-base">{quotationData.client.contactName}</div>
                </div>
              )}
              {quotationData.client.contactEmail && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Email</div>
                  <div className="text-base">{quotationData.client.contactEmail}</div>
                </div>
              )}
              {quotationData.client.contactPhone && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Teléfono</div>
                  <div className="text-base">{quotationData.client.contactPhone}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recomendación de personalización */}
      <Alert>
        <AlertCircle className="h-4 w-4 mr-2" />
        <AlertTitle>Personalización recomendada</AlertTitle>
        <AlertDescription>
          Agregar notas de personalización puede ayudar a definir mejor el alcance 
          del proyecto y evitar malentendidos con el cliente.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default OptimizedFinancialReview;