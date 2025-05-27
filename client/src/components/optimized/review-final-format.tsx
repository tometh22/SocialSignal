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
      <h3 className="text-xl font-semibold text-neutral-900 mb-6">Revisar y Ajustar Cotización</h3>
      
      <div className="mb-6">
        <h4 className="text-lg font-medium text-neutral-800 mb-4">Resumen del Proyecto</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h5 className="text-sm font-medium text-neutral-600 mb-2">Cliente y Detalles del Proyecto</h5>
            <div className="p-4 bg-neutral-100 rounded-lg">
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Cliente</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {getClientName()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Nombre del Proyecto</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {quotationData.project?.name || "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Tipo de Análisis</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {quotationData.analysisType || "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Tipo de Proyecto</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {quotationData.project?.type || "--"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          
          <div>
            <h5 className="text-sm font-medium text-neutral-600 mb-2">Parámetros de Alcance</h5>
            <div className="p-4 bg-neutral-100 rounded-lg">
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Menciones</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {quotationData.mentionsVolume || "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Países Cubiertos</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {quotationData.countriesCovered || "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Participación del Cliente</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {quotationData.clientEngagement || "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Plantilla</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {getTemplateName()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
        
        <h5 className="text-sm font-medium text-neutral-600 mb-2">Equipo y Recursos</h5>
        <div className="overflow-hidden rounded-lg border border-neutral-200 mb-6">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Rol</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Miembro del Equipo</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Tarifa</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Horas</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Costo</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
                quotationData.teamMembers.map((member, index) => (
                  <tr key={member.id || index}>
                    <td className="px-4 py-2 text-sm text-neutral-900">
                      {getRoleName(member.roleId)}
                    </td>
                    <td className="px-4 py-2 text-sm text-neutral-900">
                      {getPersonnelName(member.personnelId)}
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-neutral-900">
                      <div className="flex items-center">
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
                          className="w-20 h-8 text-sm font-mono text-right border-gray-300"
                          placeholder="0"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-neutral-900">
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
                        className="w-16 h-8 text-sm text-center border-gray-300"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-neutral-900 font-semibold">
                      US$ {((member.hours || 0) * (member.rate || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                    No hay miembros del equipo asignados
                  </td>
                </tr>
              )}
              <tr className="bg-neutral-50">
                <td colSpan={4} className="px-4 py-2 text-sm font-medium text-neutral-900">Costo Base Total</td>
                <td className="px-4 py-2 text-sm font-mono font-bold text-neutral-900">
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