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
    <div className="max-w-6xl mx-auto p-4 space-y-3">
      {/* Info cliente ultra compacta */}
      <div className="flex items-center justify-between bg-blue-50 rounded px-3 py-2 text-sm">
        <span className="font-medium">{getClientName()} • {quotationData.project?.name || "Sin nombre"}</span>
        <span className="text-xs text-blue-600">{getTemplateName()}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna izquierda - Equipo */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
                <div className="space-y-2">
                  {quotationData.teamMembers.map((member, index) => (
                    <div key={member.id || index} className="bg-gray-50 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                            <span className="text-xs text-white font-medium">
                              {getRoleName(member.roleId).charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">{getRoleName(member.roleId)}</h4>
                            <p className="text-xs text-gray-600 truncate">{getPersonnelName(member.personnelId)}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="text-gray-500 block mb-1">$/h</label>
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
                            className="h-7 text-xs text-right font-mono"
                          />
                        </div>
                        
                        <div>
                          <label className="text-gray-500 block mb-1">hrs</label>
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
                            className="h-7 text-xs text-center"
                          />
                        </div>
                        
                        <div>
                          <label className="text-gray-500 block mb-1">total</label>
                          <div className="h-7 px-2 bg-white rounded border text-xs font-mono text-right leading-7 font-semibold">
                            ${((member.hours || 0) * (member.rate || 0)).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t pt-2 mt-3">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span>Costo Base</span>
                      <span className="text-blue-600 font-mono">${baseCost.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              ) : (
              <div className="text-center py-6 text-gray-500">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Sin miembros</p>
              </div>
            )}
          </div>

          {/* Notas sin header */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Notas del proyecto..."
              className="min-h-[50px] text-sm border-0 p-0"
              rows={2}
            />
          </div>
        </div>

        {/* Columna derecha - Resumen Financiero */}
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-green-700">Base</span>
                <span className="font-mono font-medium">${baseCost.toFixed(0)}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-green-700">Complejidad</span>
                <span className="font-mono font-medium">${complexityAdjustment.toFixed(0)}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-green-700">Margen</span>
                <span className="font-mono font-medium">${markupAmount.toFixed(0)}</span>
              </div>
              
              <div className="border-t border-green-200 pt-2 mt-2">
                <div className="flex justify-between items-center bg-green-100 px-2 py-1 rounded">
                  <span className="font-semibold text-green-800 text-sm">Total</span>
                  <span className="text-lg font-bold text-green-800 font-mono">
                    ${(adjustedAmount || totalAmount).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ajustes sin header */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Monto Final</label>
                <div className="flex items-center">
                  <span className="text-gray-400 mr-1 text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={adjustedAmount || totalAmount}
                    onChange={handleAdjustedAmountChange}
                    className="font-mono text-right text-sm h-8"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Original: ${totalAmount.toFixed(0)}
                </p>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 block mb-1">Razón</label>
                <Textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="¿Por qué?"
                  className="text-sm"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Detalles sin header */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Análisis</span>
                <span className="font-medium truncate ml-2">{quotationData.analysisType || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Menciones</span>
                <span className="font-medium truncate ml-2">{quotationData.mentionsVolume || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Países</span>
                <span className="font-medium truncate ml-2">{quotationData.countriesCovered || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Participación</span>
                <span className="font-medium truncate ml-2">{quotationData.clientEngagement || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Botones compactos */}
      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          Modificado: Ahora
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
            Vista Previa
          </Button>
          <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700">
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReviewCleanDesign;