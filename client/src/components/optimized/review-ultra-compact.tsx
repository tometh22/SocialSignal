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

  // Calculate final amount with all adjustments
  const calculateFinalAmount = () => {
    const baseWithComplexity = baseCost + complexityAdjustment;
    const withMarkup = baseWithComplexity + markupAmount;
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
  }, [totalAmount, platformCost, deviationPercentage, discountPercentage, baseCost, complexityAdjustment, markupAmount]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {quotationData.project?.name || "Cotización"}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    {getClientName()}
                  </span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    {getTemplateName()}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">
                  ${calculateFinalAmount().toFixed(0)}
                </div>
                <div className="text-sm text-gray-500">Total Final</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Principal - Equipo */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Configuración del Equipo</h2>
                <p className="text-gray-600 text-sm mt-1">Ajusta las tarifas y horas de cada miembro</p>
              </div>
              
              <div className="p-6">
                {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
                  <div className="space-y-4">
                    {quotationData.teamMembers.map((member, index) => (
                      <div key={member.id || index} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                              <span className="text-white font-bold text-sm">
                                {getRoleName(member.roleId).charAt(0)}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{getRoleName(member.roleId)}</h3>
                              <p className="text-gray-600 text-sm">{getPersonnelName(member.personnelId)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
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
                                className="pl-8 font-mono text-right bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
                              className="text-center bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Costo Total</label>
                            <div className="bg-gray-100 rounded-md px-3 py-2 font-mono font-semibold text-gray-900 text-right border border-gray-300">
                              ${((member.hours || 0) * (member.rate || 0)).toFixed(0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-900">Costo Base Total</span>
                        <span className="text-xl font-bold text-blue-600">${baseCost.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-gray-400 text-2xl">👥</span>
                    </div>
                    <p>No hay miembros del equipo configurados</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notas del Proyecto */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Notas del Proyecto</h3>
              </div>
              <div className="p-6">
                <Textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Agrega notas adicionales sobre el proyecto, consideraciones especiales, entregables específicos..."
                  className="min-h-[100px] border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Panel Lateral - Financiero */}
          <div className="space-y-6">
            {/* Desglose de Costos */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Desglose Financiero</h3>
                <p className="text-gray-600 text-sm mt-1">Cálculo detallado de costos</p>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700 font-medium">Costo Base</span>
                  <span className="font-mono font-semibold text-gray-900">${baseCost.toFixed(0)}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700 font-medium">Ajuste Complejidad</span>
                  <span className="font-mono font-semibold text-gray-900">${complexityAdjustment.toFixed(0)}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700 font-medium">Margen (2x)</span>
                  <span className="font-mono font-semibold text-gray-900">${markupAmount.toFixed(0)}</span>
                </div>

                {platformCost > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700 font-medium">Costo Plataforma</span>
                    <span className="font-mono font-semibold text-blue-600">${platformCost.toFixed(0)}</span>
                  </div>
                )}

                {deviationPercentage !== 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700 font-medium">
                      Desviación ({deviationPercentage > 0 ? '+' : ''}{deviationPercentage}%)
                    </span>
                    <span className={`font-mono font-semibold ${deviationPercentage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {deviationPercentage > 0 ? '+' : ''}${((baseCost + complexityAdjustment + markupAmount + platformCost) * (deviationPercentage / 100)).toFixed(0)}
                    </span>
                  </div>
                )}

                {discountPercentage > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-700 font-medium">
                      Descuento ({discountPercentage}%)
                    </span>
                    <span className="font-mono font-semibold text-green-600">
                      -${(calculateFinalAmount() * (discountPercentage / 100)).toFixed(0)}
                    </span>
                  </div>
                )}
                
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total Final</span>
                    <span className="text-2xl font-bold text-blue-600">${calculateFinalAmount().toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel de Ajustes */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Ajustes Financieros</h3>
                <p className="text-gray-600 text-sm mt-1">Modifica los parámetros de pricing</p>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Costo de Plataforma</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={platformCost}
                      onChange={(e) => setPlatformCost(parseFloat(e.target.value) || 0)}
                      className="pl-8 font-mono text-right border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Desviación del Precio</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="-100"
                      max="100"
                      step="0.1"
                      value={deviationPercentage}
                      onChange={(e) => setDeviationPercentage(parseFloat(e.target.value) || 0)}
                      className="font-mono text-right border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="0.0"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Valores negativos reducen el precio</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descuento</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                      className="font-mono text-right border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="0.0"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ajuste Manual Final</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={adjustedAmount || calculateFinalAmount()}
                      onChange={handleAdjustedAmountChange}
                      className="pl-8 font-mono text-right border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Calculado automáticamente: ${calculateFinalAmount().toFixed(0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Razón del Ajuste */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Razón del Ajuste</h3>
              </div>
              <div className="p-6">
                <Textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Explica el motivo de los ajustes realizados en la cotización..."
                  className="min-h-[80px] border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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