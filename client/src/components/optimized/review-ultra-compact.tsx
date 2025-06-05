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

  // Calculate step by step with correct order
  const calculateSteps = () => {
    const step1_base = baseCost + complexityAdjustment;
    const step2_platform = step1_base + platformCost;
    const step3_deviation = step2_platform + (step2_platform * (deviationPercentage / 100));
    const step4_markup = step3_deviation * markupMultiplier;
    const step5_discount = step4_markup - (step4_markup * (discountPercentage / 100));
    
    return {
      step1_base,
      step2_platform,
      step3_deviation,
      step4_markup,
      step5_discount,
      markupAmount: step4_markup - step3_deviation
    };
  };

  // Calculate final amount with correct order
  const calculateFinalAmount = () => {
    return calculateSteps().step5_discount;
  };

  const getSteps = calculateSteps();

  useEffect(() => {
    const finalAmount = calculateFinalAmount();
    setAdjustedAmount(finalAmount);
  }, [totalAmount, platformCost, deviationPercentage, discountPercentage, baseCost, complexityAdjustment, markupMultiplier]);

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
              
              <div className="p-3">
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs font-medium text-gray-600 mb-2">PASO 1: Base + Complejidad</div>
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span className="font-mono">${getSteps.step1_base.toFixed(0)}</span>
                    </div>
                  </div>

                  {platformCost > 0 && (
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-xs font-medium text-blue-600 mb-2">PASO 2: + Plataforma</div>
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span className="font-mono">${getSteps.step2_platform.toFixed(0)}</span>
                      </div>
                    </div>
                  )}

                  {deviationPercentage !== 0 && (
                    <div className="bg-orange-50 rounded p-2">
                      <div className="text-xs font-medium text-orange-600 mb-2">PASO 3: + Desviación ({deviationPercentage}%)</div>
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span className="font-mono">${getSteps.step3_deviation.toFixed(0)}</span>
                      </div>
                    </div>
                  )}

                  <div className="bg-green-50 rounded p-2">
                    <div className="text-xs font-medium text-green-600 mb-2">PASO 4: × Markup ({markupMultiplier}x)</div>
                    <div className="flex justify-between text-sm">
                      <span>Ganancia</span>
                      <span className="font-mono text-green-700">+${getSteps.markupAmount.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Subtotal</span>
                      <span className="font-mono">${getSteps.step4_markup.toFixed(0)}</span>
                    </div>
                  </div>

                  {discountPercentage > 0 && (
                    <div className="bg-red-50 rounded p-2">
                      <div className="text-xs font-medium text-red-600 mb-2">PASO 5: - Descuento ({discountPercentage}%)</div>
                      <div className="flex justify-between text-sm">
                        <span>Descuento</span>
                        <span className="font-mono text-red-700">-${(getSteps.step4_markup * (discountPercentage / 100)).toFixed(0)}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-blue-100 rounded-lg p-3 border-2 border-blue-300">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-900">TOTAL FINAL</span>
                      <span className="text-lg font-bold text-blue-600">${calculateFinalAmount().toFixed(0)}</span>
                    </div>
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
                  <label className="block text-xs font-medium text-gray-700 mb-2">Multiplicador de Margen: {markupMultiplier}x</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={markupMultiplier}
                    onChange={(e) => setMarkupMultiplier(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((markupMultiplier - 1) / 4) * 100}%, #e5e7eb ${((markupMultiplier - 1) / 4) * 100}%, #e5e7eb 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1x</span>
                    <span>2.5x</span>
                    <span>5x</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Define la ganancia sobre costo base</p>
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