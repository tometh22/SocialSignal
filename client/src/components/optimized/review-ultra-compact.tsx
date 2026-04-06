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
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'breakdown'>('overview');

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
  const getRoleName = (roleId: number): string => {
    if (!availableRoles) return "Rol desconocido";
    const role = availableRoles.find(r => r.id === roleId);
    return role?.name ?? "Rol desconocido";
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

        {/* Navegación de Pestañas */}
        <div className="bg-white rounded-lg shadow border border-gray-200 mb-4">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Resumen y Controles
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'team'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Configuración de Equipo
            </button>
            <button
              onClick={() => setActiveTab('breakdown')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'breakdown'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Desglose Detallado
            </button>
          </div>
        </div>

        {/* Contenido de las Pestañas */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información del Proyecto */}
            <div className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Información del Proyecto</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                    <div className="p-2 bg-gray-50 rounded border text-sm">{getClientName()}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla</label>
                    <div className="p-2 bg-gray-50 rounded border text-sm">{getTemplateName()}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo Base del Equipo</label>
                  <div className="p-3 bg-blue-50 rounded border text-lg font-bold text-blue-600">${baseCost.toFixed(0)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notas del Proyecto</label>
                  <Textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Agrega notas sobre el proyecto..."
                    className="min-h-[80px]"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Controles Financieros */}
            <div className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Controles Financieros</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Multiplicador de Margen: {markupMultiplier}x</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={markupMultiplier}
                    onChange={(e) => setMarkupMultiplier(parseFloat(e.target.value))}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((markupMultiplier - 1) / 4) * 100}%, #e5e7eb ${((markupMultiplier - 1) / 4) * 100}%, #e5e7eb 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1x (Sin ganancia)</span>
                    <span>3x (200% ganancia)</span>
                    <span>5x (400% ganancia)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo Plataforma ($)</label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={platformCost}
                      onChange={(e) => setPlatformCost(parseFloat(e.target.value) || 0)}
                      className="font-mono text-right"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Desviación (%)</label>
                    <Input
                      type="number"
                      min="-100"
                      max="100"
                      step="0.1"
                      value={deviationPercentage}
                      onChange={(e) => setDeviationPercentage(parseFloat(e.target.value) || 0)}
                      className="font-mono text-right"
                      placeholder="0.0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descuento (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                      className="font-mono text-right"
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio Final ($)</label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={adjustedAmount || calculateFinalAmount()}
                      onChange={handleAdjustedAmountChange}
                      className="font-mono text-right font-bold"
                    />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">TOTAL FINAL</span>
                    <span className="text-2xl font-bold text-blue-600">${calculateFinalAmount().toFixed(0)}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Ganancia: ${getSteps.markupAmount.toFixed(0)} ({((getSteps.markupAmount / getSteps.step3_deviation) * 100).toFixed(0)}%)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Configuración del Equipo</h2>
              <p className="text-gray-600 text-sm mt-1">Ajusta las tarifas y horas de cada miembro del equipo</p>
            </div>
            
            <div className="p-4">
              {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
                <div className="space-y-4">
                  {quotationData.teamMembers.map((member, index) => (
                    <div key={member.id || index} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white font-bold">
                              {getRoleName(member.roleId).charAt(0)}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-lg">{getRoleName(member.roleId)}</h3>
                            <p className="text-gray-600">{getPersonnelName(member.personnelId)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-900">
                            ${((member.hours || 0) * (member.rate || 0)).toFixed(0)}
                          </div>
                          <div className="text-sm text-gray-500">Subtotal</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tarifa por Hora</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
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
                              className="pl-8 font-mono text-right bg-white"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Horas</label>
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
                            className="text-center bg-white"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Costo Total</label>
                          <div className="bg-gray-100 rounded-md px-3 py-2 font-mono font-semibold text-gray-900 text-right border">
                            ${((member.hours || 0) * (member.rate || 0)).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-300">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold text-gray-900">Costo Base Total del Equipo</span>
                      <span className="text-2xl font-bold text-blue-600">${baseCost.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-gray-400 text-3xl">👥</span>
                  </div>
                  <p className="text-lg">No hay miembros del equipo configurados</p>
                  <p className="text-sm mt-2">Ve a la configuración de equipo para agregar miembros</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'breakdown' && (
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Desglose Detallado de Costos</h2>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Columna Izquierda - Pasos del Cálculo */}
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded p-3 border">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">PASO 1: Base + Complejidad</h3>
                      <span className="text-lg font-bold text-gray-900">${getSteps.step1_base.toFixed(0)}</span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Equipo:</span>
                        <span className="font-mono">${baseCost.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Complejidad:</span>
                        <span className="font-mono">${complexityAdjustment.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  {platformCost > 0 && (
                    <div className="bg-blue-50 rounded p-3 border border-blue-200">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-blue-900">PASO 2: + Plataforma</h3>
                        <span className="text-lg font-bold text-blue-900">${getSteps.step2_platform.toFixed(0)}</span>
                      </div>
                      <div className="text-xs text-blue-700 space-y-1">
                        <div className="flex justify-between">
                          <span>Anterior:</span>
                          <span className="font-mono">${getSteps.step1_base.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Plataforma:</span>
                          <span className="font-mono">+${platformCost.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {deviationPercentage !== 0 && (
                    <div className="bg-orange-50 rounded p-3 border border-orange-200">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-orange-900">PASO 3: Desviación ({deviationPercentage}%)</h3>
                        <span className="text-lg font-bold text-orange-900">${getSteps.step3_deviation.toFixed(0)}</span>
                      </div>
                      <div className="text-xs text-orange-700 space-y-1">
                        <div className="flex justify-between">
                          <span>Anterior:</span>
                          <span className="font-mono">${getSteps.step2_platform.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Desviación:</span>
                          <span className="font-mono">{deviationPercentage > 0 ? '+' : ''}${(getSteps.step2_platform * (deviationPercentage / 100)).toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-green-50 rounded p-3 border border-green-200">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-semibold text-green-900">PASO 4: × Markup ({markupMultiplier}x)</h3>
                      <span className="text-lg font-bold text-green-900">${getSteps.step4_markup.toFixed(0)}</span>
                    </div>
                    <div className="text-xs text-green-700 space-y-1">
                      <div className="flex justify-between">
                        <span>Base:</span>
                        <span className="font-mono">${getSteps.step3_deviation.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Multiplicador:</span>
                        <span className="font-mono">×{markupMultiplier}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Ganancia:</span>
                        <span className="font-mono">+${getSteps.markupAmount.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  {discountPercentage > 0 && (
                    <div className="bg-red-50 rounded p-3 border border-red-200">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-red-900">PASO 5: - Descuento ({discountPercentage}%)</h3>
                        <span className="text-lg font-bold text-red-900">${getSteps.step5_discount.toFixed(0)}</span>
                      </div>
                      <div className="text-xs text-red-700 space-y-1">
                        <div className="flex justify-between">
                          <span>Antes descuento:</span>
                          <span className="font-mono">${getSteps.step4_markup.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Descuento:</span>
                          <span className="font-mono">-${(getSteps.step4_markup * (discountPercentage / 100)).toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Columna Derecha - Resumen y Análisis */}
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-blue-100 to-green-100 rounded-lg p-4 border-2 border-blue-300">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-bold text-gray-900">PRECIO FINAL</h3>
                      <span className="text-2xl font-bold text-blue-600">${calculateFinalAmount().toFixed(0)}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span>Costo base:</span>
                        <span className="font-mono">${getSteps.step1_base.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ganancia:</span>
                        <span className="font-mono">${getSteps.markupAmount.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Margen:</span>
                        <span className="font-mono">{((getSteps.markupAmount / getSteps.step3_deviation) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ROI:</span>
                        <span className="font-mono">{((getSteps.markupAmount / getSteps.step1_base) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Desglose del Equipo */}
                  <div className="bg-gray-50 rounded-lg p-3 border">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Desglose del Equipo</h4>
                    <div className="space-y-1 text-xs">
                      {quotationData.teamMembers && quotationData.teamMembers.map((member, index) => (
                        <div key={member.id || index} className="flex justify-between">
                          <span className="text-gray-600">
                            {getRoleName(member.roleId)} ({member.hours}h)
                          </span>
                          <span className="font-mono">${((member.hours || 0) * (member.rate || 0)).toFixed(0)}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-300 pt-1 mt-2">
                        <div className="flex justify-between font-semibold">
                          <span>Total Equipo:</span>
                          <span className="font-mono">${baseCost.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flujo de Efectivo */}
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                    <h4 className="text-sm font-semibold text-indigo-900 mb-2">Análisis de Rentabilidad</h4>
                    <div className="space-y-1 text-xs text-indigo-700">
                      <div className="flex justify-between">
                        <span>Inversión inicial:</span>
                        <span className="font-mono">${getSteps.step1_base.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ingresos brutos:</span>
                        <span className="font-mono">${calculateFinalAmount().toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Beneficio neto:</span>
                        <span className="font-mono">${(calculateFinalAmount() - getSteps.step1_base).toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Multiplicador real:</span>
                        <span className="font-mono">{(calculateFinalAmount() / getSteps.step1_base).toFixed(1)}x</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewUltraCompact;