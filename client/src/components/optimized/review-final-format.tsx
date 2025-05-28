import React, { useState, useEffect } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';

const ReviewFinalFormat: React.FC = () => {
  const {
    quotationData,
    availableRoles,
    availablePersonnel,
    updateTeamMember,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
  } = useOptimizedQuote();

  const [adjustedAmount, setAdjustedAmount] = useState<number | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Calculate final values
  useEffect(() => {
    setAdjustedAmount(totalAmount);
  }, [totalAmount]);

  // Helper functions to get names
  const getClientName = () => {
    return quotationData.client?.name || "Cliente no seleccionado";
  };

  const getTemplateName = () => {
    return quotationData.template?.name || "Plantilla no seleccionada";
  };

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

  // Handle adjusted amount change
  const handleAdjustedAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setAdjustedAmount(value);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h3 className="text-xl font-semibold text-neutral-900">Revisar y Ajustar Cotización</h3>
        <p className="text-sm text-gray-600 mt-1">Revisa todos los detalles antes de finalizar</p>
      </div>
      
      <div className="mb-6">
        <h4 className="text-lg font-medium text-neutral-800 mb-4">Resumen del Proyecto</h4>
        
        {/* Información compacta del cliente en la parte superior */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {getClientName().charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{getClientName()}</h3>
                <p className="text-sm text-gray-600">{quotationData.project?.name || "Proyecto sin nombre"}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Plantilla</div>
              <div className="font-medium text-gray-900">{getTemplateName()}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Tipo de Análisis</div>
            <div className="font-medium text-gray-900">{quotationData.analysisType || "No especificado"}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Volumen de Menciones</div>
            <div className="font-medium text-gray-900">{quotationData.mentionsVolume || "No especificado"}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Países Cubiertos</div>
            <div className="font-medium text-gray-900">{quotationData.countriesCovered || "No especificado"}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Participación del Cliente</div>
            <div className="font-medium text-gray-900">{quotationData.clientEngagement || "No especificado"}</div>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-lg font-medium text-neutral-800 mb-4 flex items-center">
            <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2">
              <span className="text-green-600 text-sm">👥</span>
            </span>
            Equipo y Recursos
          </h4>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ROL</th>
                <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-700">MIEMBRO DEL EQUIPO</th>
                <th scope="col" className="px-6 py-3 text-center text-sm font-semibold text-gray-700">TARIFA</th>
                <th scope="col" className="px-6 py-3 text-center text-sm font-semibold text-gray-700">HORAS</th>
                <th scope="col" className="px-6 py-3 text-right text-sm font-semibold text-gray-700">COSTO</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
                quotationData.teamMembers.map((member, index) => (
                  <tr key={member.id || index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {getRoleName(member.roleId)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getPersonnelName(member.personnelId)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <span className="text-gray-500 mr-1">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={member.rate || 0}
                          onChange={(e) => {
                            const newRate = parseFloat(e.target.value) || 0;
                            updateTeamMember(member.id, {
                              ...member,
                              rate: newRate,
                              cost: (member.hours || 0) * newRate
                            });
                          }}
                          className="w-20 h-9 text-sm font-mono text-right border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
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
                        className="w-16 h-9 text-sm text-center border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-mono font-semibold text-gray-900">
                      US$ {((member.hours || 0) * (member.rate || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl mb-2">👥</span>
                      <span className="font-medium">No hay miembros del equipo asignados</span>
                      <span className="text-sm mt-1">Agrega miembros para completar la cotización</span>
                    </div>
                  </td>
                </tr>
              )}
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td colSpan={4} className="px-6 py-4 text-sm font-bold text-gray-900 uppercase tracking-wide">Costo Base Total</td>
                <td className="px-6 py-4 text-right text-lg font-bold text-blue-900">
                  US$ {baseCost.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mb-6">
        <h4 className="text-lg font-medium text-neutral-800 mb-4">Cotización Final</h4>
        
        <div className="p-6 border border-primary rounded-lg bg-primary bg-opacity-5 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <h5 className="text-base font-medium text-neutral-800 mb-3">Desglose de Cotización</h5>
              <div className="space-y-4">
                <div className="bg-white p-3 rounded-lg border border-neutral-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-neutral-700">Costo Base (Horas de Equipo)</span>
                    <span className="text-sm font-mono font-medium text-neutral-900">
                      US$ {baseCost.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-neutral-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-neutral-700">
                      Ajustes por Complejidad ({baseCost > 0 ? (complexityAdjustment / baseCost * 100).toFixed(0) : 0}%)
                    </span>
                    <span className="text-sm font-mono font-medium text-neutral-900">
                      US$ {complexityAdjustment.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-neutral-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-neutral-700">Margen Estándar (2×)</span>
                    <span className="text-sm font-mono font-medium text-neutral-900">
                      US$ {markupAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-primary bg-opacity-10 p-3 rounded-lg border border-primary">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-medium text-primary">Cotización Total</span>
                    <span className="text-base font-mono font-medium text-primary">
                      US$ {(adjustedAmount || totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <h5 className="text-base font-medium text-neutral-800 mb-3">Ajustes de Cotización</h5>
              <div className="mb-3">
                <Label className="block text-sm font-medium text-neutral-700 mb-1">Ajustar Cotización Final</Label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2">US$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={adjustedAmount || totalAmount}
                    onChange={handleAdjustedAmountChange}
                    className="w-full font-mono text-right border-gray-300"
                    placeholder={`${totalAmount.toFixed(2)}`}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Original: US$ {totalAmount.toFixed(2)}
                </p>
              </div>
              
              <div className="mb-3">
                <Label className="block text-sm font-medium text-neutral-700 mb-1">Razón del Ajuste</Label>
                <Textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Explica por qué se ajustó el monto..."
                  className="text-sm"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-lg font-medium text-neutral-800 mb-4">Notas Adicionales</h4>
        <Textarea
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Notas adicionales para incluir en la cotización..."
          className="w-full"
          rows={4}
        />
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-neutral-200">
        <div className="text-sm text-neutral-600">
          Cotización lista para revisión final
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            Vista Previa
          </Button>
          <Button className="bg-primary hover:bg-primary/90">
            Guardar Cambios
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReviewFinalFormat;