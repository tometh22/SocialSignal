import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Copy, Trash2, Check, X, TrendingUp, TrendingDown, Minus, Users, Clock, DollarSign, Save, CheckCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { getApiErrorMessage } from '@/lib/api-error';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { useLocation } from 'wouter';
import { useCurrency } from '@/hooks/use-currency';
import { calculateQuotationPricing } from '@shared/utils/quotation-pricing';
import { blueprintDefinitionSchema, estimateBlueprintWorkload, type BlueprintDefinition } from '@shared/quotation-professional';

interface QuotationVariant {
  id: number;
  quotationId: number;
  variantName: string;
  variantDescription?: string;
  variantOrder: number;
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  totalAmount: number;
  scopeSnapshot?: BlueprintDefinition | null;
  deliverables?: Array<Record<string, unknown>>;
  assumptions?: string[];
  isRecommended?: boolean;
  unitMetrics?: Record<string, number>;
  isLegacy?: boolean;
  isSelected: boolean;
  createdAt: string;
}

interface TeamMember {
  id: number;
  roleId: number;
  personnelId?: number;
  hours: number;
  rate: number;
  cost: number;
  roleName?: string;
  personnelName?: string;
}

interface QuotationVariantsProps {
  quotationId: number;
  baseTeamMembers: TeamMember[];
  quotationData: any;
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  totalAmount: number;
  onVariantSelected?: (variant: QuotationVariant) => void;
}

export function QuotationVariants({ 
  quotationId, 
  baseTeamMembers, 
  quotationData, 
  baseCost,
  complexityAdjustment,
  markupAmount,
  totalAmount,
  onVariantSelected 
}: QuotationVariantsProps) {
  const [variants, setVariants] = useState<QuotationVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newVariant, setNewVariant] = useState({
    name: '',
    description: '',
    adjustmentPercentage: 0
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [variantTeamHours, setVariantTeamHours] = useState<Record<string, number>>({});
  const [variantInputText, setVariantInputText] = useState<Record<string, string>>({});
  const [expandedTeamVariant, setExpandedTeamVariant] = useState<number | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [variantPendingDeletion, setVariantPendingDeletion] = useState<number | null>(null);
  const { toast } = useToast();
  const { saveQuotation, availableRoles } = useOptimizedQuote();
  const [, setLocation] = useLocation();
  const { exchangeRate } = useCurrency();

  useEffect(() => {
    if (quotationId && quotationId > 0) {
      fetchVariants();
    } else {
      // For new quotations, create local variants based on current data
      createLocalVariants();
    }
  }, [quotationId, baseCost, totalAmount]);

  const fetchVariants = async () => {
    try {
      setLoading(true);
      const response = await apiRequest(`/api/quotations/${quotationId}/variants`, 'GET');
      setVariants(response);
      const selectedFromServer = response.filter((variant: QuotationVariant) => variant.isSelected).map((variant: QuotationVariant) => variant.id);
      const recommended = response.find((variant: QuotationVariant) => variant.isRecommended)
        || response.find((variant: QuotationVariant) => variant.variantName === 'Intermedio');
      setSelectedVariantIds(selectedFromServer.length > 0 ? selectedFromServer : recommended ? [recommended.id] : []);
      
      // If no variants exist, create default variants
      if (response.length === 0) {
        await createDefaultVariants();
      }
    } catch (error) {
      console.error('Error fetching variants:', error);
      // If quotation doesn't exist yet, fall back to local variants
      createLocalVariants();
    } finally {
      setLoading(false);
    }
  };

  const createLocalVariants = () => {
    setLoading(true);
    
    // Check if we have valid data
    if (!baseCost || baseCost === 0) {
      console.warn('⚠️ baseCost is 0 or invalid, cannot create variants');
      setLoading(false);
      return;
    }

    // baseCost/complexityAdjustment/markupAmount/totalAmount (props) siempre
    // están en ARS — convertir acá a la moneda de visualización, igual que se
    // hace al persistir (toStoredCurrency), para que estas variantes locales
    // queden en la misma unidad que las que vienen de la DB una vez guardadas
    // (así formatCurrency solo necesita poner el label, sin volver a convertir).
    if (quotationData.scopeSnapshot) {
      const definitions = professionalVariantDefinitions(blueprintDefinitionSchema.parse(quotationData.scopeSnapshot));
      const localVariants = definitions.map((definition, index) => {
        const effectiveTeam = teamForScope(definition.scope, baseTeamMembers, availableRoles);
        const result = calculateVariantResult(effectiveTeam).display;
        return {
          id: -(index + 1), quotationId: quotationId || 0,
          variantName: definition.name, variantDescription: definition.description,
          variantOrder: index + 1, baseCost: result.baseCost,
          complexityAdjustment: result.complexityAdjustment, markupAmount: result.markupAmount,
          totalAmount: result.total, scopeSnapshot: definition.scope,
          deliverables: definition.scope.deliverables as unknown as Array<Record<string, unknown>>,
          assumptions: definition.assumptions, isRecommended: definition.recommended,
          unitMetrics: unitMetricsFor(definition.scope, result.total), isLegacy: false,
          isSelected: false, createdAt: new Date().toISOString(),
        };
      });
      setVariants(localVariants);
      setSelectedVariantIds([localVariants.find((variant) => variant.isRecommended)?.id ?? localVariants[0].id]);
      setLoading(false);
      return;
    }

    const resultForScale = (scale: number) => calculateVariantResult(baseTeamMembers.map((member) => ({ ...member, hours: member.hours * scale, cost: member.hours * scale * member.rate }))).display;
    const basic = resultForScale(0.75);
    const intermediate = resultForScale(1);
    const full = resultForScale(1.8);
    
    const localVariants = [
      { 
        id: -1,
        quotationId: quotationId || 0,
        variantName: 'Básico', 
        variantDescription: 'Versión esencial con funcionalidades básicas',
        variantOrder: 1,
        baseCost: basic.baseCost,
        complexityAdjustment: basic.complexityAdjustment,
        markupAmount: basic.markupAmount,
        totalAmount: basic.total,
        isLegacy: true,
        isSelected: false,
        createdAt: new Date().toISOString()
      },
      { 
        id: -2,
        quotationId: quotationId || 0,
        variantName: 'Intermedio', 
        variantDescription: 'Versión estándar con funcionalidades completas',
        variantOrder: 2,
        baseCost: intermediate.baseCost,
        complexityAdjustment: intermediate.complexityAdjustment,
        markupAmount: intermediate.markupAmount,
        totalAmount: intermediate.total,
        isLegacy: true,
        isSelected: false,
        createdAt: new Date().toISOString()
      },
      { 
        id: -3,
        quotationId: quotationId || 0,
        variantName: 'Full', 
        variantDescription: 'Versión premium con todas las funcionalidades',
        variantOrder: 3,
        baseCost: full.baseCost,
        complexityAdjustment: full.complexityAdjustment,
        markupAmount: full.markupAmount,
        totalAmount: full.total,
        isLegacy: true,
        isSelected: false,
        createdAt: new Date().toISOString()
      }
    ];
    
    setVariants(localVariants);
    setSelectedVariantIds([-2]);
    setLoading(false);
  };

  // baseCost/complexityAdjustment/markupAmount/totalAmount (props) siempre
  // están en ARS (ver optimized-quote-context.tsx). Antes de persistir una
  // variante hay que convertir a la moneda elegida, igual que saveQuotation
  // en el contexto — si no, las variantes quedan guardadas en ARS crudo
  // etiquetadas como USD.
  const variantExchangeRate = quotationData.exchangeRateSnapshot || exchangeRate || 1;
  const toStoredCurrency = (amountARS: number) =>
    quotationData.quotationCurrency === 'USD' && variantExchangeRate > 0
      ? amountARS / variantExchangeRate
      : amountARS;

  const calculateVariantResult = (members: Array<{ hours: number; rate: number; cost?: number }>) => {
    const common = {
      quotationCurrency: quotationData.quotationCurrency === 'USD' ? 'USD' as const : 'ARS' as const,
      exchangeRate: variantExchangeRate,
      team: members.map((member) => ({
        hours: member.hours,
        rate: member.rate,
        cost: member.cost ?? member.hours * member.rate,
        currency: quotationData.quotationCurrency === 'USD' ? 'USD' as const : 'ARS' as const,
      })),
      complexityFactor: baseCost > 0 ? complexityAdjustment / baseCost : 0,
      marginFactor: quotationData.financials.marginFactor || 2,
      toolsCostUSD: quotationData.financials.toolsCost || 0,
      additionalDeliverableCostUSD: quotationData.additionalDeliverableCost || 0,
      platformCostARS: quotationData.financials.platformCost || 0,
      deviationPercentage: quotationData.financials.deviationPercentage || 0,
      discountPercentage: quotationData.financials.discountPercentage || 0,
      priceMode: quotationData.financials.priceMode || 'auto',
      manualPrice: quotationData.financials.manualPrice,
      manualPriceCurrency: quotationData.financials.manualPriceCurrency || quotationData.quotationCurrency,
    };
    const withoutInflation = calculateQuotationPricing({ ...common, inflationFactor: 1 });
    const inflationFactor = withoutInflation.canonicalARS.total > 0
      ? Math.max(0, totalAmount / withoutInflation.canonicalARS.total)
      : 1;
    return calculateQuotationPricing({ ...common, inflationFactor });
  };

  const createDefaultVariants = async () => {
    if (quotationData.scopeSnapshot) {
      try {
        const definitions = professionalVariantDefinitions(blueprintDefinitionSchema.parse(quotationData.scopeSnapshot));
        for (const [index, definition] of definitions.entries()) {
          const teamMembers = teamForScope(definition.scope, baseTeamMembers, availableRoles);
          const result = calculateVariantResult(teamMembers).display;
          await apiRequest(`/api/quotations/${quotationId}/variants`, 'POST', {
            variantName: definition.name,
            variantDescription: definition.description,
            variantOrder: index + 1,
            baseCost: result.baseCost,
            complexityAdjustment: result.complexityAdjustment,
            markupAmount: result.markupAmount,
            totalAmount: result.total,
            scopeSnapshot: definition.scope,
            deliverables: definition.scope.deliverables,
            assumptions: definition.assumptions,
            isRecommended: definition.recommended,
            unitMetrics: unitMetricsFor(definition.scope, result.total),
            isLegacy: false,
            isSelected: false,
            teamMembers,
          });
        }
        await fetchVariants();
        toast({ title: "Escenarios creados", description: "Cada alternativa tiene alcance, equipo y precio propios" });
      } catch (error) {
        console.error('Error creating professional variants:', error);
        toast({ title: "Error", description: "No se pudieron crear los escenarios de alcance", variant: "destructive" });
      }
      return;
    }
    // IMPORTANTE: Aplicar MISMO markup pero ajustar solo costos base
    const baseMarkupFactor = quotationData.financials.marginFactor || 2.0;
    
    const defaultVariants = [
      { 
        name: 'Básico', 
        description: 'Versión esencial con funcionalidades básicas',
        adjustmentPercentage: -25, // 25% menos costo base
        order: 1 
      },
      { 
        name: 'Intermedio', 
        description: 'Versión estándar con funcionalidades completas',
        adjustmentPercentage: 0, // BASE sin cambios - esta es la cotización original
        order: 2 
      },
      { 
        name: 'Full', 
        description: 'Versión premium con todas las funcionalidades',
        adjustmentPercentage: 80, // 80% más costo base
        order: 3 
      }
    ];

    try {
      for (const variant of defaultVariants) {
        const costAdjustmentFactor = (1 + variant.adjustmentPercentage / 100);
        const result = calculateVariantResult(baseTeamMembers.map((member) => ({
          ...member,
          hours: member.hours * costAdjustmentFactor,
          cost: member.hours * costAdjustmentFactor * member.rate,
        }))).display;

        await apiRequest(`/api/quotations/${quotationId}/variants`, 'POST', {
          variantName: variant.name,
          variantDescription: variant.description,
          variantOrder: variant.order,
          baseCost: result.baseCost,
          complexityAdjustment: result.complexityAdjustment,
          markupAmount: result.markupAmount,
          totalAmount: result.total,
          isLegacy: true,
          isSelected: false // La aceptación pertenece exclusivamente al portal del cliente
        });
      }
      
      await fetchVariants();
      toast({
        title: "Variantes creadas",
        description: "Se crearon las variantes por defecto"
      });
    } catch (error) {
      console.error('Error creating default variants:', error);
      toast({
        title: "Error",
        description: "No se pudieron crear las variantes por defecto",
        variant: "destructive"
      });
    }
  };

  const createCustomVariant = async () => {
    if (!newVariant.name.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la variante es requerido",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreating(true);
      const professionalScope = quotationData.scopeSnapshot ? blueprintDefinitionSchema.parse(quotationData.scopeSnapshot) : null;
      const adjustmentFactor = professionalScope ? 1 : 1 + (newVariant.adjustmentPercentage / 100);
      
      // Convertido a la moneda de visualización acá mismo (no solo al persistir),
      // para que quede en la misma unidad que el resto de `variants` en el
      // estado local (createLocalVariants) cuando la cotización todavía no se guardó.
      const effectiveTeam = professionalScope
        ? teamForScope(professionalScope, baseTeamMembers, availableRoles)
        : baseTeamMembers.map((member) => ({ ...member, hours: member.hours * adjustmentFactor, cost: member.hours * adjustmentFactor * member.rate }));
      const result = calculateVariantResult(effectiveTeam).display;
      const variantData = {
        id: -(variants.length + 1), // Use negative ID for local variants
        quotationId: quotationId || 0,
        variantName: newVariant.name,
        variantDescription: newVariant.description,
        variantOrder: variants.length + 1,
        baseCost: result.baseCost,
        complexityAdjustment: result.complexityAdjustment,
        markupAmount: result.markupAmount,
        totalAmount: result.total,
        scopeSnapshot: professionalScope,
        deliverables: professionalScope?.deliverables || [],
        assumptions: professionalScope ? ['Parte del alcance configurado; editá sus horas antes de finalizar si corresponde.'] : [],
        isRecommended: false,
        unitMetrics: professionalScope ? unitMetricsFor(professionalScope, result.total) : {},
        isLegacy: !professionalScope,
        isSelected: false,
        createdAt: new Date().toISOString()
      };

      if (quotationId && quotationId > 0) {
        // Save to database if quotation exists
        await apiRequest(`/api/quotations/${quotationId}/variants`, 'POST', variantData);
        await fetchVariants();
      } else {
        // Add to local variants for new quotations
        setVariants(prev => [...prev, variantData]);
      }
      
      setNewVariant({ name: '', description: '', adjustmentPercentage: 0 });
      toast({
        title: "Variante creada",
        description: `La variante "${newVariant.name}" se creó exitosamente`
      });
    } catch (error) {
      console.error('Error creating variant:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la variante",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const toggleVariantSelection = async (variantId: number) => {
    try {
      const isCurrentlySelected = selectedVariantIds.includes(variantId);
      const newSelectedIds = isCurrentlySelected 
        ? selectedVariantIds.filter(id => id !== variantId)
        : [...selectedVariantIds, variantId];

      setSelectedVariantIds(newSelectedIds);
      
      // Notify about all selected variants
      const selectedVariants = variants.filter(v => newSelectedIds.includes(v.id));
      if (onVariantSelected && selectedVariants.length > 0) {
        // Pass the first selected variant for compatibility, but ideally this would pass all
        onVariantSelected(selectedVariants[0]);
      }

    } catch (error) {
      console.error('Error toggling variant:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la selección",
        variant: "destructive"
      });
    }
  };

  const deleteVariant = async (variantId: number) => {
    try {
      if (quotationId && quotationId > 0) {
        // Delete from database for existing quotations
        await apiRequest(`/api/quotation-variants/${variantId}`, 'DELETE');
        await fetchVariants();
      } else {
        // Remove from local variants for new quotations
        setVariants(prev => prev.filter(v => v.id !== variantId));
      }
      
      toast({
        title: "Variante eliminada",
        description: "La variante se eliminó exitosamente"
      });
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la variante",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number) => {
    const isARS = quotationData.quotationCurrency === 'ARS';

    // Las variantes en `variants` (locales o recién fetcheadas de la DB) ya
    // están en la moneda de visualización — se convirtieron una sola vez al
    // crearlas (createLocalVariants/createDefaultVariants/createCustomVariant
    // vía toStoredCurrency). Acá solo se etiqueta, sin volver a convertir.
    return new Intl.NumberFormat(isARS ? 'es-AR' : 'en-US', {
      style: 'currency',
      currency: isARS ? 'ARS' : 'USD',
      minimumFractionDigits: isARS ? 0 : 2,
      maximumFractionDigits: isARS ? 0 : 2,
    }).format(amount);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await saveQuotation();
      toast({
        title: "Cotización guardada",
        description: "La cotización se ha guardado correctamente.",
      });
    } catch (error) {
      console.error("Error al guardar:", error);
      toast({
        title: "Error al guardar",
        description: getApiErrorMessage(error, "No se pudo guardar la cotización."),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    try {
      setIsFinalizing(true);
      // Verificar datos críticos antes de continuar
      if (!quotationData.project.name?.trim()) {
        throw new Error("Debe completar el nombre del proyecto en el primer paso antes de finalizar");
      }
      
      if (!quotationData.client?.id) {
        throw new Error("Debe seleccionar un cliente en el primer paso antes de finalizar");
      }
      
      if (!quotationData.teamMembers || quotationData.teamMembers.length === 0) {
        throw new Error("Debe configurar el equipo en el paso correspondiente antes de finalizar");
      }

      // Verificar que tenemos variantes seleccionadas o al menos crear una cotización válida
      if (selectedVariantIds.length === 0) {
        throw new Error("Debe seleccionar al menos una variante para incluir en la cotización");
      }
      
      const persistedVariants = variants.filter((variant) => selectedVariantIds.includes(variant.id)).map((variant) => {
        const effectiveTeam = baseTeamMembers.map((member) => ({
          ...member,
          hours: getEffectiveMemberHours(variant, member),
          cost: getEffectiveMemberHours(variant, member) * (member.rate || 0),
        }));
        const result = calculateVariantResult(effectiveTeam).display;
        return {
          variantName: variant.variantName,
          variantDescription: variant.variantDescription || null,
          variantOrder: variant.variantOrder,
          baseCost: result.baseCost,
          complexityAdjustment: result.complexityAdjustment,
          markupAmount: result.markupAmount,
          totalAmount: result.total,
          scopeSnapshot: variant.scopeSnapshot || null,
          deliverables: variant.deliverables || [],
          assumptions: variant.assumptions || [],
          isRecommended: Boolean(variant.isRecommended),
          unitMetrics: variant.unitMetrics || {},
          isLegacy: Boolean(variant.isLegacy),
          isSelected: false,
          teamMembers: effectiveTeam.map((member) => ({
            roleId: Number(member.roleId) > 0 ? Number(member.roleId) : null,
            personnelId: Number(member.personnelId) > 0 ? Number(member.personnelId) : null,
            hours: member.hours,
            rate: member.rate,
            cost: member.hours * member.rate,
          })),
        };
      });
      await saveQuotation('pending', persistedVariants);
      
      toast({
        title: "Enviada a aprobación interna",
        description: "La versión quedó bloqueada y espera la revisión de otra persona antes de enviarse al cliente.",
      });
      setLocation('/manage-quotes');
    } catch (error: any) {
      console.error("❌ Error al finalizar:", error);
      
      const errorMessage = getApiErrorMessage(error, "Error desconocido");
      toast({
        title: "Error al finalizar",
        description: `No se pudo finalizar la cotización: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  const getDefaultMemberHours = (variant: QuotationVariant, member: TeamMember): number => {
    if (variant.scopeSnapshot) {
      const effective = teamForScope(blueprintDefinitionSchema.parse(variant.scopeSnapshot), baseTeamMembers, availableRoles).find((item) => item.id === member.id);
      if (effective) return effective.hours;
    }
    if (!baseCost || baseCost === 0 || !member.hours) return member.hours || 0;
    // variant.baseCost está en la moneda de visualización; baseCost (prop) está
    // en ARS crudo — convertirlo antes del ratio para no mezclar unidades.
    return Math.round(member.hours * (variant.baseCost / toStoredCurrency(baseCost)) * 2) / 2;
  };

  const getEffectiveMemberHours = (variant: QuotationVariant, member: TeamMember): number => {
    const key = `${variant.id}-${member.id}`;
    return variantTeamHours[key] ?? getDefaultMemberHours(variant, member);
  };

  const computeVariantCostFromTeam = (variant: QuotationVariant): number => {
    // Fallback: variant.baseCost ya está en la moneda de visualización
    // (convertido al persistir/crear la variante).
    if (!baseTeamMembers?.length) return variant.baseCost;
    // member.rate ya está expresado en quotationCurrency (getPersonnelRate),
    // igual que variant.baseCost; no corresponde volver a convertirlo.
    return baseTeamMembers.reduce(
      (sum, member) => sum + getEffectiveMemberHours(variant, member) * (member.rate || 0),
      0,
    );
  };

  const computeVariantTotal = (variant: QuotationVariant): number => {
    if (!baseTeamMembers?.length) return variant.totalAmount;
    return calculateVariantResult(baseTeamMembers.map((member) => ({
      ...member,
      hours: getEffectiveMemberHours(variant, member),
      cost: getEffectiveMemberHours(variant, member) * (member.rate || 0),
    }))).display.total;
  };

  const getVariantTotalHours = (variant: QuotationVariant): number => {
    if (!baseTeamMembers?.length) return 0;
    return baseTeamMembers.reduce((sum, m) => sum + getEffectiveMemberHours(variant, m), 0);
  };

  const getBaseReferenceTotal = (): number => {
    const persistedBase = toStoredCurrency(totalAmount);
    if (persistedBase > 0) return persistedBase;
    const intermediate = variants.find((variant) => variant.variantName === 'Intermedio');
    return intermediate ? computeVariantTotal(intermediate) : 0;
  };

  const getDifferenceVsBase = (variant: QuotationVariant): number => {
    const reference = getBaseReferenceTotal();
    return reference > 0 ? Math.round(((computeVariantTotal(variant) / reference) - 1) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        {!baseCost && (
          <div className="text-center mt-4">
            <p className="text-gray-500">
              Configurá el equipo en la fase Alcance para ver las variantes disponibles
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Escenarios de alcance</h2>
          <p className="text-gray-600 mt-1">
            Compará alternativas reales de cobertura, entregables y precio antes de elegir qué mostrarle al cliente.
          </p>
          <Badge variant="outline" className="mt-2 bg-slate-50 text-slate-600">Los costos internos no se muestran al cliente</Badge>
        </div>
        
        <div className="flex flex-col gap-2 sm:flex-row">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2" style={{ height: 36, minWidth: 150, justifyContent: "center" }}>
                <Plus className="h-4 w-4" />
                Nueva variante
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear nueva variante</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={newVariant.name}
                  onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                  placeholder="Ej: Premium, Económico..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  value={newVariant.description}
                  onChange={(e) => setNewVariant({ ...newVariant, description: e.target.value })}
                  placeholder="Describí las características de esta variante..."
                />
              </div>
              {!quotationData.scopeSnapshot && <div>
                <label className="text-sm font-medium">Ajuste de Precio (%)</label>
                <Input
                  type="number"
                  value={newVariant.adjustmentPercentage}
                  onChange={(e) => setNewVariant({ ...newVariant, adjustmentPercentage: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Porcentaje de ajuste sobre el precio base (puede ser negativo)
                </p>
              </div>}
              {quotationData.scopeSnapshot && <p className="rounded-lg bg-indigo-50 p-3 text-xs text-indigo-700">La nueva alternativa parte del alcance configurado. El precio se recalcula desde el equipo; no se aplica un porcentaje arbitrario.</p>}
              <Button 
                onClick={createCustomVariant} 
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? 'Creando...' : 'Crear Variante'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {variants.map((variant) => (
          <Card
            key={variant.id} 
            className={`relative transition-all duration-200 ${
              selectedVariantIds.includes(variant.id)
                ? 'ring-2 ring-blue-500 shadow-lg' 
                : 'border-slate-200'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    checked={selectedVariantIds.includes(variant.id)}
                    onCheckedChange={() => toggleVariantSelection(variant.id)}
                    aria-label={`Incluir variante ${variant.variantName} en la propuesta`}
                    className="mt-1"
                  />
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {variant.variantName}
                    </CardTitle>
                    {variant.variantDescription && (
                      <p className="text-sm text-gray-600 mt-1">
                        {variant.variantDescription}
                      </p>
                    )}
                  </div>
                </div>
                {selectedVariantIds.includes(variant.id) && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    <Check className="h-3 w-3 mr-1" />
                    Para envío
                  </Badge>
                )}
                {(variant.isRecommended || variant.variantName === 'Intermedio') && !selectedVariantIds.includes(variant.id) && (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Recomendada</Badge>
                )}
                {variant.isLegacy && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Histórico</Badge>}
              </div>

              {variant.scopeSnapshot && (
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                  <Badge variant="outline">{variant.scopeSnapshot.coverage.markets.length} mercados</Badge>
                  <Badge variant="outline">{variant.scopeSnapshot.coverage.brands.length} marcas</Badge>
                  <Badge variant="outline">{variant.scopeSnapshot.deliverables.filter((item) => item.included).length} entregables</Badge>
                  <Badge variant="outline">Respuesta {variant.scopeSnapshot.coverage.slaLevel === 'real_time' ? 'tiempo real' : variant.scopeSnapshot.coverage.slaLevel === 'priority' ? 'prioritaria' : 'estándar'}</Badge>
                </div>
              )}
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Precio Principal */}
              <div className="text-center py-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(computeVariantTotal(variant))}
                </div>
                <div className="text-sm text-gray-500">Precio Total</div>
              </div>

              {/* Métricas reales del equipo */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="space-y-1">
                  <div className="flex items-center justify-center text-blue-600"><Users className="h-4 w-4" /></div>
                  <div className="text-sm font-medium">{baseTeamMembers?.length || 0}</div>
                  <div className="text-xs text-gray-500">Personas</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center text-green-600"><Clock className="h-4 w-4" /></div>
                  <div className="text-sm font-medium">{getVariantTotalHours(variant).toFixed(2)} h</div>
                  <div className="text-xs text-gray-500">Horas</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center text-purple-600"><DollarSign className="h-4 w-4" /></div>
                  <div className="text-sm font-medium">{variant.scopeSnapshot?.coverage.languages?.join(' + ').toUpperCase() || 'ES'}</div>
                  <div className="text-xs text-gray-500">Idiomas</div>
                </div>
              </div>

              {/* Equipo por variante — expandible */}
              {baseTeamMembers?.length > 0 && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); setExpandedTeamVariant(v => v === variant.id ? null : variant.id); }}
                    className="w-full text-xs text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 py-1"
                  >
                    <Users className="h-3 w-3" />
                    {expandedTeamVariant === variant.id ? 'Ocultar equipo' : 'Ver / ajustar equipo'}
                  </button>
                  {expandedTeamVariant === variant.id && (
                    <div className="border rounded-lg p-2 space-y-1.5 bg-gray-50" onClick={e => e.stopPropagation()}>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Horas por persona</div>
                      {baseTeamMembers.map(m => {
                        const inputKey = `${variant.id}-${m.id}`;
                        return (
                          <div key={m.id} className="flex items-center gap-2 text-xs">
                            <span className="flex-1 truncate text-gray-700">{m.personnelName || m.roleName}</span>
                            <input
                              type="number" min={0} step={1}
                              aria-label={`Horas de ${m.personnelName || m.roleName} en ${variant.variantName}`}
                              value={variantInputText[inputKey] ?? String(getEffectiveMemberHours(variant, m))}
                              onChange={e => { e.stopPropagation(); setVariantInputText(prev => ({ ...prev, [inputKey]: e.target.value })); }}
                              onBlur={e => {
                                e.stopPropagation();
                                const v = parseFloat(e.target.value);
                                setVariantTeamHours(prev => ({ ...prev, [inputKey]: isNaN(v) ? getDefaultMemberHours(variant, m) : Math.max(0, v) }));
                                setVariantInputText(prev => { const n = { ...prev }; delete n[inputKey]; return n; });
                              }}
                              onClick={e => e.stopPropagation()}
                              className="w-14 border rounded text-center py-0.5 px-1 text-xs bg-white"
                            />
                            <span className="text-gray-400">h</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Indicador de diferencia, expresado como inversión y no como multiplicador técnico. */}
              <div className="flex justify-center">
                {(() => {
                  const diff = getDifferenceVsBase(variant);
                  if (diff > 0) return <Badge variant="secondary" className="bg-green-100 text-green-800"><TrendingUp className="h-3 w-3 mr-1" />{diff}% más que la recomendada</Badge>;
                  if (diff < 0) return <Badge variant="secondary" className="bg-red-100 text-red-800"><TrendingDown className="h-3 w-3 mr-1" />{Math.abs(diff)}% menos que la recomendada</Badge>;
                  return <Badge variant="secondary" className="bg-gray-100 text-gray-800"><Minus className="h-3 w-3 mr-1" />Referencia</Badge>;
                })()}
              </div>

              {/* Botón de Eliminar (solo para variantes custom) */}
              {!['Básico', 'Intermedio', 'Full'].includes(variant.variantName) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-600 hover:text-red-800 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVariantPendingDeletion(variant.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparativa de Variantes */}
      {variants.length > 0 && (
        <Card>
          <CardHeader>
            {/* Legacy label "Diferencia vs cotización base" remains in historical exports; the UI uses business language. */}
            <CardTitle>Comparación rápida</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Variante</th>
                    <th className="text-center p-2">Alcance</th>
                    <th className="text-right p-2">Esfuerzo</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-center p-2">Diferencia de inversión</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => (
                    <tr key={variant.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{variant.variantName}</td>
                      <td className="p-2 text-center">{variant.scopeSnapshot ? `${variant.scopeSnapshot.deliverables.filter((item) => item.included).length} entregables · ${variant.scopeSnapshot.coverage.markets.length} mercados` : 'Histórico'}</td>
                      <td className="p-2 text-right">{getVariantTotalHours(variant).toFixed(1)} h</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(variant.totalAmount)}</td>
                      <td className="p-2 text-center">
                        {(() => {
                          const baseReferenceTotal = getBaseReferenceTotal();
                          if (baseReferenceTotal <= 0) return <span>-</span>;
                          const isARS = quotationData.quotationCurrency === 'ARS';
                          const convertedVariantAmount = computeVariantTotal(variant);
                          const convertedBaseAmount = baseReferenceTotal;
                          
                          if (convertedVariantAmount > convertedBaseAmount) {
                            const percentDiff = Math.round(((convertedVariantAmount / convertedBaseAmount) - 1) * 100);
                            const amountDiff = convertedVariantAmount - convertedBaseAmount;
                            return (
                              <div className="text-right">
                                <span className="text-green-600 font-medium">+{percentDiff}%</span>
                                <div className="text-xs text-gray-500">
                                  +{new Intl.NumberFormat(isARS ? 'es-AR' : 'en-US', {
                                    style: 'currency',
                                    currency: isARS ? 'ARS' : 'USD',
                                    minimumFractionDigits: isARS ? 0 : 2,
                                    maximumFractionDigits: isARS ? 0 : 2,
                                  }).format(amountDiff)}
                                </div>
                              </div>
                            );
                          } else if (convertedVariantAmount < convertedBaseAmount) {
                            const percentDiff = Math.round(((convertedVariantAmount / convertedBaseAmount) - 1) * 100);
                            const amountDiff = convertedVariantAmount - convertedBaseAmount;
                            return (
                              <div className="text-right">
                                <span className="text-red-600 font-medium">{percentDiff}%</span>
                                <div className="text-xs text-gray-500">
                                  {new Intl.NumberFormat(isARS ? 'es-AR' : 'en-US', {
                                    style: 'currency',
                                    currency: isARS ? 'ARS' : 'USD',
                                    minimumFractionDigits: isARS ? 0 : 2,
                                    maximumFractionDigits: isARS ? 0 : 2,
                                  }).format(amountDiff)}
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div className="text-right">
                                <span className="text-gray-500 font-medium">Base</span>
                                <div className="text-xs text-gray-500">
                                  {new Intl.NumberFormat(isARS ? 'es-AR' : 'en-US', {
                                    style: 'currency',
                                    currency: isARS ? 'ARS' : 'USD',
                                    minimumFractionDigits: isARS ? 0 : 2,
                                    maximumFractionDigits: isARS ? 0 : 2,
                                  }).format(0)}
                                </div>
                              </div>
                            );
                          }
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen de Selección */}
      {selectedVariantIds.length > 0 && (
        <div className="flex justify-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-800">
              <strong>{selectedVariantIds.length}</strong> escenario{selectedVariantIds.length > 1 ? 's' : ''} seleccionado{selectedVariantIds.length > 1 ? 's' : ''} para enviar al cliente
            </p>
            <p className="text-xs text-blue-600 mt-1">
              El cliente podrá elegir entre {selectedVariantIds.length > 1 ? 'estas opciones' : 'esta opción'}
            </p>
          </div>
        </div>
      )}

      {/* Botones de Finalización */}
      <div className="mt-8 flex flex-col gap-4 border-t border-gray-200 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          Revisá la vista para el cliente y aprobá solo cuando la propuesta esté lista.
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving || isFinalizing}
            className="border-gray-200 hover:bg-gray-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar borrador
              </>
            )}
          </Button>
          <Button
            onClick={() => setApprovalDialogOpen(true)}
            disabled={isSaving || isFinalizing || selectedVariantIds.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isFinalizing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando a revisión...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Solicitar aprobación
              </>
            )}
          </Button>
        </div>
      </div>

      <AlertDialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar esta versión a aprobación interna?</AlertDialogTitle>
            <AlertDialogDescription>
              Se congelarán {selectedVariantIds.length} alternativa{selectedVariantIds.length === 1 ? '' : 's'} en una revisión auditable. Otra persona deberá aprobarla antes del envío al cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar nuevamente</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalize} className="bg-emerald-600 hover:bg-emerald-700">
              Confirmar envío a revisión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={variantPendingDeletion !== null} onOpenChange={(open) => !open && setVariantPendingDeletion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta variante?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (variantPendingDeletion !== null) deleteVariant(variantPendingDeletion);
                setVariantPendingDeletion(null);
              }}
            >
              Eliminar variante
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function professionalVariantDefinitions(base: BlueprintDefinition) {
  const essential = structuredClone(base);
  essential.coverage.designLevel = "standard";
  essential.coverage.slaLevel = "standard";
  essential.deliverables = essential.deliverables.map((item) => ({
    ...item,
    included: item.type !== "workshop" && item.type !== "dashboard" && item.cadence !== "quarterly",
  }));

  const recommended = structuredClone(base);
  const expanded = structuredClone(base);
  expanded.coverage.designLevel = "executive";
  if (expanded.coverage.slaLevel === "standard") expanded.coverage.slaLevel = "priority";
  expanded.deliverables = expanded.deliverables.map((item) => ({ ...item, included: true }));

  return [
    { name: "Esencial", description: "Foco en los entregables imprescindibles y SLA estándar.", scope: essential, assumptions: ["Sin workshops ni dashboard", "Diseño estándar"], recommended: false },
    { name: "Recomendada", description: "Alcance equilibrado para convertir evidencia en decisiones.", scope: recommended, assumptions: ["Alcance y cadencia de la receta seleccionada"], recommended: true },
    { name: "Expandida", description: "Máxima profundidad, diseño ejecutivo y todos los módulos previstos.", scope: expanded, assumptions: ["Todos los entregables incluidos", "Diseño ejecutivo", "SLA prioritario"], recommended: false },
  ];
}

function teamForScope(scope: BlueprintDefinition, team: TeamMember[], roles: Array<{ id: number; name: string }>) {
  const workload = estimateBlueprintWorkload(scope);
  const grouped = new Map<string, TeamMember[]>();
  for (const member of team) {
    const key = roleKeyForName(member.roleName || roles.find((role) => role.id === member.roleId)?.name || "");
    grouped.set(key, [...(grouped.get(key) || []), member]);
  }
  return team.map((member) => {
    const key = roleKeyForName(member.roleName || roles.find((role) => role.id === member.roleId)?.name || "");
    const peers = grouped.get(key) || [member];
    const target = workload.byRole[key];
    if (target == null) return { ...member, hours: 0, cost: 0 };
    const peerBase = peers.reduce((sum, item) => sum + Number(item.hours || 0), 0);
    const share = peerBase > 0 ? Number(member.hours || 0) / peerBase : 1 / peers.length;
    const hours = Math.round(target * share * 2) / 2;
    return { ...member, hours, cost: hours * Number(member.rate || 0) };
  });
}

function roleKeyForName(name: string) {
  const normalized = name.toLocaleLowerCase("es");
  if (normalized.includes("director") || normalized.includes("cuentas")) return "director";
  if (normalized.includes("project") || normalized.includes(" pm") || normalized === "pm" || normalized.includes("proyecto")) return "pm";
  if (normalized.includes("data") || normalized.includes("datos")) return "data";
  if (normalized.includes("tech") || normalized.includes("tecnolog")) return "tech";
  if (normalized.includes("diseñ") || normalized.includes("design")) return "design";
  return "analyst";
}

function unitMetricsFor(scope: BlueprintDefinition, total: number) {
  const months = Math.max(1, scope.durationMonths);
  const deliveries = Math.max(1, scope.deliverables.filter((item) => item.included).reduce((sum, item) => sum + item.quantity, 0));
  return {
    perMonth: Number((total / months).toFixed(2)),
    perMarket: Number((total / Math.max(1, scope.coverage.markets.length)).toFixed(2)),
    perBrand: Number((total / Math.max(1, scope.coverage.brands.length)).toFixed(2)),
    perDeliverable: Number((total / deliveries).toFixed(2)),
  };
}
