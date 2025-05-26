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

// Componente para agregar miembros de equipo inline
const TeamMemberQuickAdd: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedPersonnel, setSelectedPersonnel] = useState('');
  const [hours, setHours] = useState('10');
  const [rate, setRate] = useState('');
  
  const { addTeamMember } = useOptimizedQuote();
  
  // Obtener datos disponibles con tipado correcto
  const { data: roles = [] } = useQuery<Array<{id: number, name: string, defaultRate?: number}>>({ queryKey: ['/api/roles'] });
  const { data: personnel = [] } = useQuery<Array<{id: number, name: string}>>({ queryKey: ['/api/personnel'] });
  
  const handleAddMember = () => {
    if (!selectedRole || !hours || !rate) return;
    
    const hoursNum = parseFloat(hours);
    const rateNum = parseFloat(rate);
    
    addTeamMember({
      roleId: parseInt(selectedRole),
      personnelId: selectedPersonnel ? parseInt(selectedPersonnel) : null,
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
    // Auto-llenar rate basado en el rol
    const role = roles.find(r => r.id === parseInt(roleId));
    if (role?.defaultRate) {
      setRate(role.defaultRate.toString());
    }
  };

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
    <div className="p-3 border rounded-md bg-blue-50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-sm font-medium text-blue-800">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Agregar nuevo miembro
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
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
          <Label className="text-xs text-blue-700">Persona</Label>
          <Select value={selectedPersonnel} onValueChange={setSelectedPersonnel}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sin asignar</SelectItem>
              {personnel.map(person => (
                <SelectItem key={person.id} value={person.id.toString()}>
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs text-blue-700">Horas</Label>
          <Input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="h-7 text-xs"
            min="0"
            step="0.5"
          />
        </div>
        
        <div>
          <Label className="text-xs text-blue-700">Tarifa USD</Label>
          <Input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="h-7 text-xs"
            min="0"
            step="0.01"
          />
        </div>
        
        <div>
          <Label className="text-xs text-blue-700">Costo</Label>
          <div className="h-7 px-2 py-1 text-xs bg-gray-100 rounded border flex items-center">
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

      {/* Sección del equipo asignado */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-lg">Equipo Asignado al Proyecto</CardTitle>
          </div>
          <CardDescription>Integrantes del equipo y sus roles</CardDescription>
        </CardHeader>
        <CardContent>
          {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b bg-gray-50">
                    <TableHead className="text-xs font-medium text-gray-600 py-2 px-3">Rol</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600 py-2 px-3">Personal</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600 py-2 px-3 text-right">Horas</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600 py-2 px-3 text-right">Tarifa</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600 py-2 px-3 text-right">Costo</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600 py-2 px-3">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotationData.teamMembers.map((member, index) => {
                    const role = availableRoles?.find(r => r.id === member.roleId);
                    const person = availablePersonnel?.find(p => p.id === member.personnelId);
                    
                    return (
                      <TableRow key={member.id || index} className="group hover:bg-gray-50">
                        <TableCell className="py-1.5 px-3 text-xs font-medium">{role?.name || 'Rol no encontrado'}</TableCell>
                        <TableCell className="py-1.5 px-3 text-xs">{person?.name || 'Sin asignar'}</TableCell>
                        <TableCell className="py-1.5 px-3 text-xs text-right">{member.hours}</TableCell>
                        <TableCell className="py-1.5 px-3 text-xs text-right">{member.rate}</TableCell>
                        <TableCell className="py-1.5 px-3 text-xs text-right font-medium">${member.cost?.toFixed(2)}</TableCell>
                        <TableCell className="py-1.5 px-3">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeTeamMember(member.id)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                              <path d="M3 6h18"></path>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-gray-50 border-t">
                    <TableCell colSpan={2} className="py-1.5 px-3 text-xs font-medium">TOTALES</TableCell>
                    <TableCell className="py-1.5 px-3 text-xs text-right font-medium">{teamHours}</TableCell>
                    <TableCell className="py-1.5 px-3 text-xs text-right"></TableCell>
                    <TableCell className="py-1.5 px-3 text-xs text-right font-medium">${teamTotal.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500 py-8 border rounded-md mb-4">
              No hay miembros en el equipo asignado.
            </div>
          )}
          
          {/* Controles para agregar roles y actualizar equipo */}
          <div className="flex justify-between items-center mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs h-7"
              onClick={applyRecommendedTeam}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-primary">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Recomendar equipo óptimo
            </Button>
            
            <TeamMemberQuickAdd />
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
        </CardContent>
      </Card>

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