import React, { useState, useEffect } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { 
  User, 
  Building2, 
  Calculator, 
  Edit3, 
  DollarSign,
  Clock,
  Users
} from 'lucide-react';

const ReviewCleanDesign: React.FC = () => {
  const {
    quotationData,
    availableRoles,
    availablePersonnel,
    updateTeamMember,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount
  } = useOptimizedQuote();

  const [adjustedAmount, setAdjustedAmount] = useState<number | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  useEffect(() => {
    setAdjustedAmount(totalAmount);
  }, [totalAmount]);

  // Helper functions
  const getClientName = () => quotationData.client?.name || "Cliente no seleccionado";
  const getTemplateName = () => quotationData.template?.name || "Plantilla no seleccionada";
  const getPersonnelName = (personnelId: number | null) => {
    if (!personnelId || !availablePersonnel) return "Sin asignar";
    const person = availablePersonnel.find(p => p.id === personnelId);
    return person ? person.name : "Sin asignar";
  };
  const getRoleName = (roleId: number) => {
    if (!availableRoles) return "Rol desconocido";
    const role = availableRoles.find(r => r.id === roleId);
    return role ? role.name : "Rol desconocido";
  };

  const handleAdjustedAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setAdjustedAmount(value);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header con información del cliente */}
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{getClientName()}</h2>
                <p className="text-gray-600">{quotationData.project?.name || "Proyecto sin nombre"}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              {getTemplateName()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda - Equipo */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Equipo del Proyecto</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
                <div className="space-y-4">
                  {quotationData.teamMembers.map((member, index) => (
                    <div key={member.id || index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{getRoleName(member.roleId)}</h4>
                            <p className="text-sm text-gray-600">{getPersonnelName(member.personnelId)}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-gray-500 uppercase tracking-wide">Tarifa/Hora</Label>
                          <div className="flex items-center mt-1">
                            <span className="text-gray-400 mr-1">$</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={member.rate || 0}
                              onChange={(e) => {
                                const newRate = parseFloat(e.target.value) || 0;
                                updateTeamMember(member.id, {
                                  ...member,
                                  rate: newRate,
                                  cost: (member.hours || 0) * newRate
                                });
                              }}
                              className="w-full text-right font-mono"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-gray-500 uppercase tracking-wide">Horas</Label>
                          <Input
                            type="number"
                            min="0"
                            value={member.hours || 0}
                            onChange={(e) => {
                              const newHours = parseInt(e.target.value) || 0;
                              updateTeamMember(member.id, {
                                ...member,
                                hours: newHours,
                                cost: newHours * (member.rate || 0)
                              });
                            }}
                            className="w-full text-center mt-1"
                          />
                        </div>
                        
                        <div>
                          <Label className="text-xs text-gray-500 uppercase tracking-wide">Costo Total</Label>
                          <div className="mt-1 p-2 bg-white rounded border font-mono text-right font-semibold">
                            ${((member.hours || 0) * (member.rate || 0)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Costo Base Total</span>
                      <span className="text-blue-600">${baseCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay miembros asignados al proyecto</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notas Adicionales */}
          <Card>
            <CardHeader>
              <CardTitle>Notas del Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Notas adicionales sobre el proyecto..."
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha - Resumen Financiero */}
        <div className="space-y-6">
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-800">
                <DollarSign className="w-5 h-5" />
                <span>Resumen Financiero</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-green-200">
                  <span className="text-sm text-green-700">Costo Base</span>
                  <span className="font-mono font-medium">${baseCost.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-green-200">
                  <span className="text-sm text-green-700">Ajuste Complejidad</span>
                  <span className="font-mono font-medium">${complexityAdjustment.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-green-200">
                  <span className="text-sm text-green-700">Margen</span>
                  <span className="font-mono font-medium">${markupAmount.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center py-3 bg-green-100 px-3 rounded-lg">
                  <span className="font-semibold text-green-800">Total</span>
                  <span className="text-xl font-bold text-green-800 font-mono">
                    ${(adjustedAmount || totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ajustes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5" />
                <span>Ajustes</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Monto Final</Label>
                <div className="flex items-center mt-1">
                  <span className="text-gray-400 mr-2">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={adjustedAmount || totalAmount}
                    onChange={handleAdjustedAmountChange}
                    className="font-mono text-right"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Original: ${totalAmount.toFixed(2)}
                </p>
              </div>
              
              <div>
                <Label>Razón del Ajuste</Label>
                <Textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="¿Por qué se ajustó el monto?"
                  className="mt-1"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Información del Proyecto */}
          <Card>
            <CardHeader>
              <CardTitle>Detalles del Proyecto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Análisis</span>
                <span className="text-sm font-medium">{quotationData.analysisType || "No especificado"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Menciones</span>
                <span className="text-sm font-medium">{quotationData.mentionsVolume || "No especificado"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Países</span>
                <span className="text-sm font-medium">{quotationData.countriesCovered || "No especificado"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Participación</span>
                <span className="text-sm font-medium">{quotationData.clientEngagement || "No especificado"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex justify-between items-center pt-6 border-t">
        <div className="text-sm text-gray-600">
          Última modificación: Ahora
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">Vista Previa</Button>
          <Button className="bg-blue-600 hover:bg-blue-700">Guardar Cambios</Button>
        </div>
      </div>
    </div>
  );
};

export default ReviewCleanDesign;