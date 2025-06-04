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
    <div className="page-container space-y-4">
      {/* Cliente en una línea con diseño estándar */}
      <div className="flex-between card-compact bg-blue-50 text-body-sm">
        <span className="font-medium">{getClientName()} • {quotationData.project?.name || "Sin nombre"}</span>
        <span className="text-xs text-blue-600">{getTemplateName()}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 grid-compact">
        {/* Equipo */}
        <div className="lg:col-span-2 space-y-3">
          <div className="card-standard">
            {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
              <div className="space-y-3">
                {quotationData.teamMembers.map((member, index) => (
                  <div key={member.id || index} className="card-compact bg-gray-50">
                    <div className="flex-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
                          <span className="text-xs text-white font-medium">
                            {getRoleName(member.roleId).charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-body-sm font-medium truncate">{getRoleName(member.roleId)}</h4>
                          <p className="text-caption text-muted-foreground truncate">{getPersonnelName(member.personnelId)}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label-standard text-caption">$/h</label>
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
                          className="h-6 text-xs text-right font-mono"
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
                          className="h-6 text-xs text-center"
                        />
                      </div>
                      
                      <div>
                        <label className="text-gray-500 block mb-1">total</label>
                        <div className="h-6 px-2 bg-white rounded border text-xs font-mono text-right leading-6 font-semibold">
                          ${((member.hours || 0) * (member.rate || 0)).toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span>Costo Base</span>
                    <span className="text-blue-600 font-mono">${baseCost.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">Sin miembros</div>
            )}
          </div>

          {/* Notas */}
          <div className="bg-white border border-gray-200 rounded p-2">
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Notas del proyecto..."
              className="min-h-[40px] text-xs border-0 p-0 resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-3">
          {/* Financiero */}
          <div className="bg-green-50 border border-green-200 rounded p-2 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-green-700">Base</span>
              <span className="font-mono font-medium">${baseCost.toFixed(0)}</span>
            </div>
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-green-700">Complejidad</span>
              <span className="font-mono font-medium">${complexityAdjustment.toFixed(0)}</span>
            </div>
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-green-700">Margen</span>
              <span className="font-mono font-medium">${markupAmount.toFixed(0)}</span>
            </div>

            {platformCost > 0 && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-green-700">Plataforma</span>
                <span className="font-mono font-medium">${platformCost.toFixed(0)}</span>
              </div>
            )}

            {deviationPercentage !== 0 && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-green-700">Desviación</span>
                <span className={`font-mono font-medium ${deviationPercentage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {deviationPercentage > 0 ? '+' : ''}${((baseCost + complexityAdjustment + markupAmount + platformCost) * (deviationPercentage / 100)).toFixed(0)}
                </span>
              </div>
            )}

            {discountPercentage > 0 && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-green-700">Descuento</span>
                <span className="font-mono font-medium text-green-600">
                  -${(calculateFinalAmount() * (discountPercentage / 100)).toFixed(0)}
                </span>
              </div>
            )}
            
            <div className="border-t border-green-200 pt-1 mt-1">
              <div className="flex justify-between items-center bg-green-100 px-2 py-1 rounded">
                <span className="font-semibold text-green-800 text-xs">Total</span>
                <span className="text-sm font-bold text-green-800 font-mono">
                  ${calculateFinalAmount().toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Ajustes */}
          <div className="bg-white border border-gray-200 rounded p-2 space-y-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Costo Plataforma ($)</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={platformCost}
                onChange={(e) => setPlatformCost(parseFloat(e.target.value) || 0)}
                className="font-mono text-right text-xs h-6"
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Desviación (%)</label>
              <Input
                type="number"
                min="-100"
                max="100"
                step="0.1"
                value={deviationPercentage}
                onChange={(e) => setDeviationPercentage(parseFloat(e.target.value) || 0)}
                className="font-mono text-right text-xs h-6"
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Descuento (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                className="font-mono text-right text-xs h-6"
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Monto Final</label>
              <div className="flex items-center">
                <span className="text-gray-400 mr-1 text-xs">$</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={adjustedAmount || calculateFinalAmount()}
                  onChange={handleAdjustedAmountChange}
                  className="font-mono text-right text-xs h-6"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Calculado: ${calculateFinalAmount().toFixed(0)}
              </p>
            </div>
            
            <div>
              <label className="text-xs text-gray-500 block mb-1">Razón</label>
              <Textarea
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="¿Por qué?"
                className="text-xs resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Detalles */}
          <div className="bg-white border border-gray-200 rounded p-2 space-y-1 text-xs">
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

      {/* Botones minimalistas */}
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-500">Ahora</div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs">Vista</Button>
          <Button size="sm" className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700">Guardar</Button>
        </div>
      </div>
    </div>
  );
};

export default ReviewUltraCompact;