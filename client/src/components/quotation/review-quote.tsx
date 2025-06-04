import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useQuoteContext } from "@/context/quote-context";
import { Client, ReportTemplate, Personnel, Role, InsertQuotation, InsertQuotationTeamMember } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { Loader } from "@/components/ui/loader";

export default function ReviewQuote({ onPrevious }: { onPrevious: () => void }) {
  console.log("Componente ReviewQuote renderizado");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [adjustedAmount, setAdjustedAmount] = useState<number | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [platformCost, setPlatformCost] = useState(0);
  const [deviationPercentage, setDeviationPercentage] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  
  const {
    projectDetails,
    teamMembers,
    selectedTemplateId,
    templateCustomization,
    complexityAdjustment,
    baseCost,
    markupAmount,
    totalAmount,
    calculateTotalCost,
    updateTeamMember
  } = useQuoteContext();

  // Get client info
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Get template info
  const { data: templates } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/templates"],
  });

  // Get personnel info
  const { data: allPersonnel } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  // Get roles info
  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  // Calculate final values
  useEffect(() => {
    calculateTotalCost();
    setAdjustedAmount(totalAmount);
  }, [calculateTotalCost, totalAmount]);

  // Helper functions to get names
  const getClientName = (clientId: number) => {
    if (!clients) return "Unknown Client";
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : "Unknown Client";
  };

  const getTemplateName = (templateId: number) => {
    if (!templates) return "Unknown Template";
    const template = templates.find(t => t.id === templateId);
    return template ? template.name : "Unknown Template";
  };

  const getPersonnelName = (personnelId: number) => {
    if (!allPersonnel) return "Unknown";
    const person = allPersonnel.find(p => p.id === personnelId);
    return person ? person.name : "Unknown";
  };

  const getRoleName = (roleId: number) => {
    if (!roles) return "Unknown Role";
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : "Unknown Role";
  };

  // Handle adjusted amount change
  const handleAdjustedAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setAdjustedAmount(value);
    }
  };

  // Create quotation mutation
  const createQuotationMutation = useMutation({
    mutationFn: async (quotation: InsertQuotation) => {
      const response = await apiRequest("POST", "/api/quotations", quotation);
      return response.json();
    },
    onSuccess: async (data) => {
      // Add team members to the quotation
      await Promise.all(
        teamMembers.map(async (member) => {
          if (member.personnelId) {
            const teamMemberData: InsertQuotationTeamMember = {
              quotationId: data.id,
              personnelId: member.personnelId,
              hours: member.hours,
              rate: member.rate,
              cost: member.cost
            };
            
            await apiRequest("POST", "/api/quotation-team", teamMemberData);
          }
        })
      );
      
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      
      toast({
        title: "Success",
        description: "Quotation has been generated successfully.",
      });
      
      navigate("/manage-quotes");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate quotation.",
        variant: "destructive",
      });
      setIsSaving(false);
    }
  });

  // Generate final quote
  const generateQuote = async () => {
    if (!projectDetails.clientId || !projectDetails.projectName) {
      toast({
        title: "Missing Information",
        description: "Client and project name are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    const finalAmount = adjustedAmount || totalAmount;
    
    // Calcular el total ajustado con plataforma, desviación y descuento
    const platformCostAmount = platformCost;
    const deviationAmount = (totalAmount * deviationPercentage) / 100;
    const subtotalWithAdjustments = totalAmount + platformCostAmount + deviationAmount;
    const discountAmount = (subtotalWithAdjustments * discountPercentage) / 100;
    const finalCalculatedAmount = subtotalWithAdjustments - discountAmount;
    
    const actualFinalAmount = adjustedAmount || finalCalculatedAmount;
    
    const quotationData: InsertQuotation = {
      clientId: projectDetails.clientId,
      projectName: projectDetails.projectName,
      analysisType: projectDetails.analysisType || "basic",
      projectType: projectDetails.projectType || "executive",
      mentionsVolume: projectDetails.mentionsVolume || "small",
      countriesCovered: projectDetails.countriesCovered || "1",
      clientEngagement: projectDetails.clientEngagement || "low",
      templateId: selectedTemplateId || undefined,
      templateCustomization: templateCustomization || undefined,
      baseCost: baseCost,
      complexityAdjustment: complexityAdjustment,
      markupAmount: markupAmount,
      platformCost: platformCostAmount,
      deviationPercentage: deviationPercentage,
      discountPercentage: discountPercentage,
      totalAmount: actualFinalAmount,
      adjustmentReason: adjustmentReason || `Plataforma: $${platformCostAmount}, Desviación: ${deviationPercentage}%, Descuento: ${discountPercentage}%`,
      additionalNotes: additionalNotes || undefined,
      status: "draft"
    };

    createQuotationMutation.mutate(quotationData);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-semibold text-neutral-900 mb-6">Revisar y Generar Cotización</h3>
      
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
                    {projectDetails.clientId ? getClientName(projectDetails.clientId) : "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Nombre del Proyecto</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {projectDetails.projectName || "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Tipo de Análisis</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {projectDetails.analysisType || "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Tipo de Proyecto</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {projectDetails.projectType || "--"}
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
                    {projectDetails.mentionsVolume || "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Países Cubiertos</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {projectDetails.countriesCovered || "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Participación del Cliente</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {projectDetails.clientEngagement || "--"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-neutral-600">Plantilla</dt>
                  <dd className="text-sm font-medium text-neutral-900">
                    {selectedTemplateId ? getTemplateName(selectedTemplateId) : "--"}
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
              {teamMembers.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-2 text-sm text-neutral-900">
                    {getRoleName(member.roleId)}
                  </td>
                  <td className="px-4 py-2 text-sm text-neutral-900">
                    {member.personnelId ? getPersonnelName(member.personnelId) : "--"}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-neutral-900">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={member.rate}
                      onChange={(e) => {
                        const newRate = parseFloat(e.target.value) || 0;
                        updateTeamMember(member.id, {
                          ...member,
                          rate: newRate,
                          cost: member.hours * newRate
                        });
                        calculateTotalCost();
                      }}
                      className="w-24 h-8 text-sm font-mono"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm text-neutral-900">
                    <Input
                      type="number"
                      min="0"
                      value={member.hours}
                      onChange={(e) => {
                        const newHours = parseInt(e.target.value) || 0;
                        updateTeamMember(member.id, {
                          ...member,
                          hours: newHours,
                          cost: newHours * member.rate
                        });
                        calculateTotalCost();
                      }}
                      className="w-20 h-8 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-neutral-900">
                    ${member.cost.toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr className="bg-neutral-50">
                <td colSpan={4} className="px-4 py-2 text-sm font-medium text-neutral-900">Costo Base Total</td>
                <td className="px-4 py-2 text-sm font-mono font-medium text-neutral-900">
                  ${baseCost.toFixed(2)}
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
                      {formatCurrency(baseCost)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-neutral-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-neutral-700">
                      Ajustes por Complejidad ({(complexityAdjustment / baseCost * 100).toFixed(0)}%)
                    </span>
                    <span className="text-sm font-mono font-medium text-neutral-900">
                      {formatCurrency(complexityAdjustment)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-neutral-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-neutral-700">Costo Base Ajustado</span>
                    <span className="text-sm font-mono font-medium text-neutral-900">
                      {formatCurrency(baseCost + complexityAdjustment)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-neutral-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-neutral-700">Margen Estándar (2×)</span>
                    <span className="text-sm font-mono font-medium text-neutral-900">
                      {formatCurrency(markupAmount)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-primary bg-opacity-10 p-3 rounded-lg border border-primary">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-medium text-primary">Cotización Total</span>
                    <span className="text-base font-mono font-medium text-primary">
                      {formatCurrency(adjustedAmount || totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <h5 className="text-base font-medium text-neutral-800 mb-3">Ajustes de Cotización</h5>
              
              <div className="space-y-4">
                <div>
                  <Label className="block text-sm font-medium text-neutral-700 mb-1">Costo de Plataforma ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={platformCost}
                    onChange={(e) => setPlatformCost(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full"
                  />
                </div>
                
                <div>
                  <Label className="block text-sm font-medium text-neutral-700 mb-1">Desviación (%)</Label>
                  <Input
                    type="number"
                    min="-100"
                    max="100"
                    step="0.1"
                    value={deviationPercentage}
                    onChange={(e) => setDeviationPercentage(parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                    className="w-full"
                  />
                </div>
                
                <div>
                  <Label className="block text-sm font-medium text-neutral-700 mb-1">Descuento (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                    className="w-full"
                  />
                </div>
              
              <div className="mb-3">
                <Label className="block text-sm font-medium text-neutral-700 mb-1">Ajustar Cotización Final</Label>
                <div className="flex items-center">
                  <Input
                    type="number"
                    className="w-full"
                    value={adjustedAmount?.toString() || ""}
                    onChange={handleAdjustedAmountChange}
                  />
                  <span className="ml-2 text-sm font-mono text-neutral-600">USD</span>
                </div>
              </div>
              <div className="mb-3">
                <Label className="block text-sm font-medium text-neutral-700 mb-1">Motivo de Ajuste</Label>
                <Textarea
                  className="w-full"
                  rows={2}
                  placeholder="Ingrese motivo del ajuste (si aplica)..."
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-neutral-100 rounded-lg mb-6">
          <Label className="block text-sm font-medium text-neutral-700 mb-1">Notas Adicionales</Label>
          <Textarea
            className="w-full"
            rows={3}
            placeholder="Notas adicionales o consideraciones especiales del proyecto..."
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
        <Button type="button" variant="outline" onClick={onPrevious} className="flex items-center">
          <span className="mr-1">←</span>
          Atrás
        </Button>
        
        <div className="flex space-x-4">
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={() => navigate("/")}
          >
            Cancelar
          </Button>
          <Button
            disabled={isSaving}
            onClick={generateQuote}
            className="flex items-center"
          >
            {isSaving ? (
              <span className="flex items-center">
                <Loader variant="dots" size="sm" />
                <span className="ml-2">Generando</span>
              </span>
            ) : (
              <>
                Generar Cotización
                <span className="ml-1">✓</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
