import React, { useState, useEffect } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const ReviewUltraCompact: React.FC = () => {
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
  const [platformCost, setPlatformCost] = useState(0);
  const [deviationPercentage, setDeviationPercentage] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [markupMultiplier, setMarkupMultiplier] = useState(2);

  // Calculate dynamic markup amount
  const calculateDynamicMarkup = () => {
    const baseWithComplexity = baseCost + complexityAdjustment;
    return baseWithComplexity * (markupMultiplier - 1);
  };

  // Calculate final amount with all adjustments
  const calculateFinalAmount = () => {
    const baseWithComplexity = baseCost + complexityAdjustment;
    const dynamicMarkup = calculateDynamicMarkup();
    const withMarkup = baseWithComplexity + dynamicMarkup;
    const withPlatform = withMarkup + platformCost;
    const deviationAmount = withPlatform * (deviationPercentage / 100);
    const withDeviation = withPlatform + deviationAmount;
    const discountAmount = withDeviation * (discountPercentage / 100);
    const finalAmount = withDeviation - discountAmount;
    return finalAmount;
  };

  useEffect(() => {
    const finalAmount = calculateFinalAmount();
    setAdjustedAmount(finalAmount);
  }, [totalAmount, platformCost, deviationPercentage, discountPercentage, baseCost, complexityAdjustment, markupAmount, markupMultiplier]);

  const getClientName = () => quotationData.client?.name || "Cliente no seleccionado";
  const getTemplateName = () => quotationData.template?.name || "Sin plantilla";
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
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header Compacto */}
        <div className="bg-white rounded-lg shadow border border-gray-200 mb-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">
                {quotationData.project?.name || "Cotización"}
              </h1>
              <div className="flex items-center space-x-3 text-xs text-gray-600">
                <span>{getClientName()}</span>
                <span>•</span>
                <span>{getTemplateName()}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                ${calculateFinalAmount().toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">Total Final</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Panel Principal - Equipo */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Configuración del Equipo</h2>
              </div>
              
              <div className="p-4">
                {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
                  <div className="space-y-3">
                    {quotationData.teamMembers.map((member, index) => (
                      <div key={member.id || index} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                              <span className="text-white font-bold text-xs">
                                {getRoleName(member.roleId).charAt(0)}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900 text-sm">{getRoleName(member.roleId)}</h3>
                              <p className="text-gray-600 text-xs">{getPersonnelName(member.personnelId)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900 text-sm">
                              ${((member.hours || 0) * (member.rate || 0)).toFixed(0)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">$/h</label>
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
                              className="h-8 text-xs font-mono text-right"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">hrs</label>
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
                              className="h-8 text-xs text-center"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">total</label>
                            <div className="h-8 px-2 bg-gray-100 rounded border text-xs font-mono text-right flex items-center justify-end">
                              ${((member.hours || 0) * (member.rate || 0)).toFixed(0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Costo Base Total</span>
                        <span className="font-bold text-blue-600">${baseCost.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">No hay miembros del equipo configurados</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Panel Lateral - Financiero */}
          <div className="space-y-4">
            {/* Desglose de Costos */}
            <div className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-3 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">Desglose Financiero</h3>
              </div>
              
              <div className="p-3 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Costo Base</span>
                  <span className="font-mono font-semibold">${baseCost.toFixed(0)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Complejidad</span>
                  <span className="font-mono font-semibold">${complexityAdjustment.toFixed(0)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Margen ({markupMultiplier}x)</span>
                  <span className="font-mono font-semibold">${calculateDynamicMarkup().toFixed(0)}</span>
                </div>

                {platformCost > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">Plataforma</span>
                    <span className="font-mono font-semibold text-blue-600">${platformCost.toFixed(0)}</span>
                  </div>
                )}

                {deviationPercentage !== 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">
                      Desviación ({deviationPercentage > 0 ? '+' : ''}{deviationPercentage}%)
                    </span>
                    <span className={`font-mono font-semibold ${deviationPercentage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {deviationPercentage > 0 ? '+' : ''}${((baseCost + complexityAdjustment + calculateDynamicMarkup() + platformCost) * (deviationPercentage / 100)).toFixed(0)}
                    </span>
                  </div>
                )}

                {discountPercentage > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">
                      Descuento ({discountPercentage}%)
                    </span>
                    <span className="font-mono font-semibold text-green-600">
                      -${(calculateFinalAmount() * (discountPercentage / 100)).toFixed(0)}
                    </span>
                  </div>
                )}
                
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-200 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">Total Final</span>
                    <span className="text-lg font-bold text-blue-600">${calculateFinalAmount().toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel de Ajustes */}
            <div className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-3 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">Controles Financieros</h3>
              </div>
              
              <div className="p-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Multiplicador de Margen</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    value={markupMultiplier}
                    onChange={(e) => setMarkupMultiplier(parseFloat(e.target.value) || 2)}
                    className="h-8 text-xs font-mono text-center"
                  />
                  <p className="text-xs text-gray-500 mt-1">Define la ganancia (ej: 2x = 100% ganancia)</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Costo Plataforma ($)</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={platformCost}
                    onChange={(e) => setPlatformCost(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono text-right"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Desviación (%)</label>
                  <Input
                    type="number"
                    min="-100"
                    max="100"
                    step="0.1"
                    value={deviationPercentage}
                    onChange={(e) => setDeviationPercentage(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono text-right"
                    placeholder="0.0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Descuento (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono text-right"
                    placeholder="0.0"
                  />
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ajuste Manual Final ($)</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={adjustedAmount || calculateFinalAmount()}
                    onChange={handleAdjustedAmountChange}
                    className="h-8 text-xs font-mono text-right"
                  />
                </div>
              </div>
            </div>

            {/* Notas */}
            <div className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-3 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">Notas</h3>
              </div>
              <div className="p-3">
                <Textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Notas del proyecto..."
                  className="min-h-[60px] text-xs"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewUltraCompact;