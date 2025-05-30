import React, { useState, useEffect } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const ReviewCleanDesign: React.FC = () => {
  const {
    quotationData,
    availableRoles,
    availablePersonnel,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount
  } = useOptimizedQuote();

  const [adjustedAmount, setAdjustedAmount] = useState<number | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState("");

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
                      <div className="flex justify-between">
                        <span className="text-gray-600">Horas</span>
                        <span className="font-medium">{member.hours || 0}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">FTE</span>
                        <span className="font-medium">{((member.fte || 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Dedicación</span>
                        <span className="font-medium">{member.dedication || 0}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center text-sm py-4">No hay miembros de equipo asignados</p>
            )}
          </div>
        </div>

        {/* Columna derecha - Ajustes y Detalles */}
        <div className="space-y-4">
          {/* Costos sin header */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Base</span>
              <span className="font-medium">${baseCost.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ajuste</span>
              <span className="font-medium">${complexityAdjustment.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Markup</span>
              <span className="font-medium">${markupAmount.toFixed(0)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>${totalAmount.toFixed(0)}</span>
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