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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { useLocation } from 'wouter';
import { useCurrency } from '@/hooks/use-currency';

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
  const { toast } = useToast();
  const { saveQuotation } = useOptimizedQuote();
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
    console.log('🎨 Creating local variants with:', { 
      baseCost, 
      complexityAdjustment, 
      markupAmount, 
      totalAmount,
      currency: quotationData.quotationCurrency,
      exchangeRate
    });
    setLoading(true);
    
    // Check if we have valid data
    if (!baseCost || baseCost === 0) {
      console.warn('⚠️ baseCost is 0 or invalid, cannot create variants');
      setLoading(false);
      return;
    }

    // Ajustar valores según la moneda seleccionada
    let adjustedBaseCost = baseCost;
    let adjustedComplexityAdjustment = complexityAdjustment;
    let adjustedMarkupAmount = markupAmount;
    let adjustedTotalAmount = totalAmount;

    if (quotationData.quotationCurrency === 'ARS') {
      adjustedBaseCost = baseCost * exchangeRate;
      adjustedComplexityAdjustment = complexityAdjustment * exchangeRate;
      adjustedMarkupAmount = markupAmount * exchangeRate;
      adjustedTotalAmount = totalAmount * exchangeRate;
    }
    
    // IMPORTANTE: Intermedio es la BASE (cotización original sin cambios)
    // Básico y Full usan MISMO markup factor pero ajustan solo costo base
    const baseMarkupFactor = 2.0; // Fijo x2 como establece la cotización original
    
    const localVariants = [
      { 
        id: -1,
        quotationId: quotationId || 0,
        variantName: 'Básico', 
        variantDescription: 'Versión esencial con funcionalidades básicas',
        variantOrder: 1,
        baseCost: adjustedBaseCost * 0.75,
        complexityAdjustment: adjustedComplexityAdjustment * 0.75,
        // Recalcular markup con el MISMO factor pero sobre los costos reducidos
        markupAmount: (adjustedBaseCost * 0.75 + adjustedComplexityAdjustment * 0.75) * (baseMarkupFactor - 1),
        totalAmount: (adjustedBaseCost * 0.75 + adjustedComplexityAdjustment * 0.75) * baseMarkupFactor,
        isSelected: false,
        createdAt: new Date().toISOString()
      },
      { 
        id: -2,
        quotationId: quotationId || 0,
        variantName: 'Intermedio', 
        variantDescription: 'Versión estándar con funcionalidades completas',
        variantOrder: 2,
        baseCost: adjustedBaseCost, // BASE SIN CAMBIOS
        complexityAdjustment: adjustedComplexityAdjustment, // BASE SIN CAMBIOS
        markupAmount: adjustedMarkupAmount, // BASE SIN CAMBIOS
        totalAmount: adjustedTotalAmount, // BASE SIN CAMBIOS - Esta es la cotización original
        isSelected: true, // Esta debe estar seleccionada por defecto
        createdAt: new Date().toISOString()
      },
      { 
        id: -3,
        quotationId: quotationId || 0,
        variantName: 'Full', 
        variantDescription: 'Versión premium con todas las funcionalidades',
        variantOrder: 3,
        baseCost: adjustedBaseCost * 1.8,
        complexityAdjustment: adjustedComplexityAdjustment * 1.8,
        // Recalcular markup con el MISMO factor pero sobre los costos aumentados
        markupAmount: (adjustedBaseCost * 1.8 + adjustedComplexityAdjustment * 1.8) * (baseMarkupFactor - 1),
        totalAmount: (adjustedBaseCost * 1.8 + adjustedComplexityAdjustment * 1.8) * baseMarkupFactor,
        isSelected: false,
        createdAt: new Date().toISOString()
      }
    ];
    
    console.log('🎨 Created variants:', localVariants);
    setVariants(localVariants);
    setSelectedVariantIds([-1, -2, -3]); // Select all variants by default for client presentation
    setLoading(false);
  };

  const createDefaultVariants = async () => {
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
        // IMPORTANTE: Para variantes, aplicar MISMO markup factor pero solo ajustar costos base
        const costAdjustmentFactor = (1 + variant.adjustmentPercentage / 100);
        const adjustedBaseCost = baseCost * costAdjustmentFactor;
        const adjustedComplexity = complexityAdjustment * costAdjustmentFactor;
        
        // CALCULAR markup basado en la cotización original (x2 exacto)
        // La cotización original: costo base + complejidad, luego x2
        const originalMarkupFactor = 2.0; // Fijo x2 como en la cotización base
        const adjustedMarkup = (adjustedBaseCost + adjustedComplexity) * (originalMarkupFactor - 1);
        const adjustedTotal = (adjustedBaseCost + adjustedComplexity) * originalMarkupFactor;

        await apiRequest(`/api/quotations/${quotationId}/variants`, 'POST', {
          variantName: variant.name,
          variantDescription: variant.description,
          variantOrder: variant.order,
          baseCost: adjustedBaseCost,
          complexityAdjustment: adjustedComplexity,
          markupAmount: adjustedMarkup,
          totalAmount: adjustedTotal,
          isSelected: variant.name === 'Intermedio' // Select intermediate as default
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
      const adjustmentFactor = 1 + (newVariant.adjustmentPercentage / 100);
      
      const variantData = {
        id: -(variants.length + 1), // Use negative ID for local variants
        quotationId: quotationId || 0,
        variantName: newVariant.name,
        variantDescription: newVariant.description,
        variantOrder: variants.length + 1,
        baseCost: baseCost * adjustmentFactor,
        complexityAdjustment: complexityAdjustment * adjustmentFactor,
        markupAmount: markupAmount * adjustmentFactor,
        totalAmount: totalAmount * adjustmentFactor,
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

      if (quotationId && quotationId > 0) {
        // Update in database for existing quotations
        await apiRequest(`/api/quotation-variants/${variantId}`, 'PATCH', { 
          isSelected: !isCurrentlySelected 
        });
        await fetchVariants();
      } else {
        // Update local variants for new quotations
        setVariants(prev => prev.map(v => ({
          ...v,
          isSelected: v.id === variantId ? !isCurrentlySelected : v.isSelected
        })));
      }
      
      setSelectedVariantIds(newSelectedIds);
      
      // Notify about all selected variants
      const selectedVariants = variants.filter(v => newSelectedIds.includes(v.id));
      if (onVariantSelected && selectedVariants.length > 0) {
        // Pass the first selected variant for compatibility, but ideally this would pass all
        onVariantSelected(selectedVariants[0]);
      }

      toast({
        title: isCurrentlySelected ? "Variante deseleccionada" : "Variante seleccionada",
        description: `${newSelectedIds.length} variante(s) seleccionada(s) para enviar al cliente`
      });
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
    
    // IMPORTANTE: Las variantes están guardadas en USD, pero necesitamos mostrarlas en la moneda elegida
    let finalAmount = amount;
    if (isARS) {
      finalAmount = amount * exchangeRate; // Convertir USD a ARS
    }
    
    console.log('🪙 formatCurrency conversion:', {
      originalAmount: amount,
      currency: quotationData.quotationCurrency,
      exchangeRate,
      finalAmount,
      isARS
    });
    
    return new Intl.NumberFormat(isARS ? 'es-AR' : 'en-US', {
      style: 'currency',
      currency: isARS ? 'ARS' : 'USD',
      minimumFractionDigits: isARS ? 0 : 2,
      maximumFractionDigits: isARS ? 0 : 2,
    }).format(finalAmount);
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
        description: "No se pudo guardar la cotización.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    try {
      setIsFinalizing(true);
      console.log("🚀 Iniciando finalización de cotización...");
      console.log("🔍 Estado actual del contexto:", {
        quotationData: quotationData,
        teamMembersLength: quotationData.teamMembers?.length || 0,
        selectedVariantIds: selectedVariantIds
      });
      
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
        console.log("⚠️ No hay variantes seleccionadas, creando cotización base");
      }
      
      await saveQuotation('pending'); // Cambiar a pending en lugar de approved
      console.log("✅ Cotización guardada exitosamente como pending");
      
      toast({
        title: "Cotización creada",
        description: "La cotización se ha creada exitosamente y está pendiente de aprobación.",
      });
      setLocation('/manage-quotes');
    } catch (error: any) {
      console.error("❌ Error al finalizar:", error);
      console.error("❌ Error details:", error.message);
      console.error("❌ Error stack:", error.stack);
      console.error("❌ quotationData at error:", quotationData);
      
      const errorMessage = error.message || 'Error desconocido';
      toast({
        title: "Error al finalizar",
        description: `No se pudo finalizar la cotización: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  const calculateTeamHours = (variant: QuotationVariant) => {
    // Calculate team hours based on base cost and average hourly rate
    const avgHourlyRate = 25; // Average rate in USD equivalent
    const estimatedHours = Math.round(variant.baseCost / avgHourlyRate);
    
    // Ensure we return a valid number
    return isNaN(estimatedHours) ? 0 : Math.max(0, estimatedHours);
  };

  const calculateTeamSize = (variant: QuotationVariant) => {
    // Estimar tamaño del equipo basándose en el nivel de complejidad
    const baseTeamSize = baseTeamMembers?.length || 3; // Default to 3 if no team members
    
    // Safely handle complexity calculation
    if (!complexityAdjustment || complexityAdjustment === 0) {
      // If no complexity adjustment, use ratio based on cost
      const costRatio = variant.totalAmount / totalAmount;
      return Math.max(1, Math.round(baseTeamSize * costRatio));
    }
    
    const complexityFactor = variant.complexityAdjustment / complexityAdjustment;
    return Math.max(1, Math.round(baseTeamSize * complexityFactor));
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
              Configura el equipo en el paso anterior para ver las variantes disponibles
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Variantes de Cotización</h2>
          <p className="text-gray-600 mt-1">
            Selecciona las variantes que quieres enviar al cliente para su elección
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const allSelected = selectedVariantIds.length === variants.length;
              if (allSelected) {
                setSelectedVariantIds([]);
                setVariants(prev => prev.map(v => ({ ...v, isSelected: false })));
              } else {
                const allIds = variants.map(v => v.id);
                setSelectedVariantIds(allIds);
                setVariants(prev => prev.map(v => ({ ...v, isSelected: true })));
              }
            }}
          >
            {selectedVariantIds.length === variants.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nueva Variante
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Variante</DialogTitle>
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
                  placeholder="Describe las características de esta variante..."
                />
              </div>
              <div>
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
              </div>
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
            className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
              variant.isSelected 
                ? 'ring-2 ring-blue-500 shadow-lg' 
                : 'hover:shadow-md'
            }`}
            onClick={() => toggleVariantSelection(variant.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    checked={selectedVariantIds.includes(variant.id)}
                    onCheckedChange={() => toggleVariantSelection(variant.id)}
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
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Precio Principal */}
              <div className="text-center py-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(variant.totalAmount)}
                </div>
                <div className="text-sm text-gray-500">Precio Total</div>
              </div>

              {/* Métricas Clave */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="space-y-1">
                  <div className="flex items-center justify-center text-blue-600">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium">{calculateTeamSize(variant)}</div>
                  <div className="text-xs text-gray-500">Personas</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center text-green-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium">{calculateTeamHours(variant)}h</div>
                  <div className="text-xs text-gray-500">Horas</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center text-purple-600">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium">
                    {formatCurrency(variant.baseCost)}
                  </div>
                  <div className="text-xs text-gray-500">Base</div>
                </div>
              </div>

              {/* Indicador de Diferencia */}
              <div className="flex justify-center">
                {variant.totalAmount > quotationData.totalAmount ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{Math.round(((variant.totalAmount / quotationData.totalAmount) - 1) * 100)}%
                  </Badge>
                ) : variant.totalAmount < quotationData.totalAmount ? (
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    {Math.round(((variant.totalAmount / quotationData.totalAmount) - 1) * 100)}%
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                    <Minus className="h-3 w-3 mr-1" />
                    Base
                  </Badge>
                )}
              </div>

              {/* Botón de Acción */}
              <Button 
                variant={selectedVariantIds.includes(variant.id) ? "secondary" : "default"}
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVariantSelection(variant.id);
                }}
              >
                {selectedVariantIds.includes(variant.id) ? 'Para Envío' : 'Incluir'}
              </Button>

              {/* Botón de Eliminar (solo para variantes custom) */}
              {!['Básico', 'Intermedio', 'Full'].includes(variant.variantName) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-600 hover:text-red-800 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteVariant(variant.id);
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
            <CardTitle>Comparativa de Variantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Variante</th>
                    <th className="text-right p-2">Costo Base</th>
                    <th className="text-right p-2">Markup</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-center p-2">Margen vs Base</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => (
                    <tr key={variant.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{variant.variantName}</td>
                      <td className="p-2 text-right">{formatCurrency(variant.baseCost)}</td>
                      <td className="p-2 text-right">x{(variant.totalAmount / (variant.baseCost + variant.complexityAdjustment)).toFixed(1)}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(variant.totalAmount)}</td>
                      <td className="p-2 text-center">
                        {(() => {
                          // Encontrar la variante base (Básico) como referencia
                          const baseVariant = variants.find(v => v.variantName === 'Básico') || variants[0];
                          if (!baseVariant) return <span>-</span>;
                          
                          if (variant.totalAmount > baseVariant.totalAmount) {
                            const percentDiff = Math.round(((variant.totalAmount / baseVariant.totalAmount) - 1) * 100);
                            const amountDiff = variant.totalAmount - baseVariant.totalAmount;
                            return (
                              <div className="text-right">
                                <span className="text-green-600 font-medium">+{percentDiff}%</span>
                                <div className="text-xs text-gray-500">
                                  +{formatCurrency(amountDiff)}
                                </div>
                              </div>
                            );
                          } else if (variant.totalAmount < baseVariant.totalAmount) {
                            const percentDiff = Math.round(((variant.totalAmount / baseVariant.totalAmount) - 1) * 100);
                            const amountDiff = variant.totalAmount - baseVariant.totalAmount;
                            return (
                              <div className="text-right">
                                <span className="text-red-600 font-medium">{percentDiff}%</span>
                                <div className="text-xs text-gray-500">
                                  {formatCurrency(amountDiff)}
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div className="text-right">
                                <span className="text-gray-500 font-medium">Base</span>
                                <div className="text-xs text-gray-500">
                                  {formatCurrency(0)}
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
              <strong>{selectedVariantIds.length}</strong> variante{selectedVariantIds.length > 1 ? 's' : ''} seleccionada{selectedVariantIds.length > 1 ? 's' : ''} para enviar al cliente
            </p>
            <p className="text-xs text-blue-600 mt-1">
              El cliente podrá elegir entre {selectedVariantIds.length > 1 ? 'estas opciones' : 'esta opción'}
            </p>
          </div>
        </div>
      )}

      {/* Botones de Finalización */}
      <div className="flex justify-between items-center pt-8 border-t border-gray-200 mt-8">
        <div className="text-sm text-gray-600">
          Este es el último paso del proceso de cotización
        </div>
        <div className="flex gap-3">
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
                Guardar Borrador
              </>
            )}
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={isSaving || isFinalizing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isFinalizing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Finalizar Cotización
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}