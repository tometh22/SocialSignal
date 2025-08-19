import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, TrendingUp, TrendingDown, Minus, Eye, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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

interface QuotationVariantsDisplayProps {
  quotationId: number;
  quotationStatus: string;
  quotationCurrency?: string;
  baseTotal: number;
  onVariantApproved?: (variant: QuotationVariant) => void;
}

export function QuotationVariantsDisplay({ 
  quotationId, 
  quotationStatus, 
  quotationCurrency = 'ARS',
  baseTotal,
  onVariantApproved 
}: QuotationVariantsDisplayProps) {
  const [variants, setVariants] = useState<QuotationVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingVariant, setApprovingVariant] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchVariants();
  }, [quotationId]);

  const fetchVariants = async () => {
    try {
      setLoading(true);
      const response = await apiRequest(`/api/quotations/${quotationId}/variants`, 'GET');
      setVariants(response || []);
    } catch (error) {
      console.error('Error fetching variants:', error);
      setVariants([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const isARS = quotationCurrency === 'ARS';
    return new Intl.NumberFormat(isARS ? 'es-AR' : 'en-US', {
      style: 'currency',
      currency: isARS ? 'ARS' : 'USD',
      minimumFractionDigits: isARS ? 0 : 2,
      maximumFractionDigits: isARS ? 0 : 2,
    }).format(amount);
  };

  const handleApproveVariant = async (variant: QuotationVariant) => {
    try {
      setApprovingVariant(variant.id);
      
      // Actualizar el estado de la cotización a aprobada
      await apiRequest(`/api/quotations/${quotationId}`, {
        method: 'PATCH',
        body: {
          status: 'approved',
          selectedVariantId: variant.id,
          totalAmount: variant.totalAmount,
          baseCost: variant.baseCost,
          complexityAdjustment: variant.complexityAdjustment,
          markupAmount: variant.markupAmount
        }
      });

      // Marcar la variante como seleccionada
      await apiRequest(`/api/quotations/${quotationId}/variants/${variant.id}/select`, {
        method: 'PATCH'
      });

      toast({
        title: "Variante aprobada",
        description: `Se ha aprobado la variante "${variant.variantName}" y actualizado la cotización.`,
        variant: "default",
      });

      // Refrescar variantes para mostrar la seleccionada
      await fetchVariants();
      
      // Llamar al callback si existe
      if (onVariantApproved) {
        onVariantApproved(variant);
      }

    } catch (error: any) {
      console.error('Error approving variant:', error);
      toast({
        title: "Error al aprobar variante",
        description: error.message || 'No se pudo aprobar la variante',
        variant: "destructive",
      });
    } finally {
      setApprovingVariant(null);
    }
  };

  const getPercentageDifference = (variantTotal: number, baseTotal: number) => {
    return Math.round(((variantTotal / baseTotal) - 1) * 100);
  };

  const getMarkupPercentage = (markupAmount: number, baseCost: number) => {
    return Math.round((markupAmount / baseCost) * 100);
  };

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="rounded-full p-1.5 bg-purple-50">
              <Eye className="text-purple-500 h-3.5 w-3.5" />
            </div>
            Variantes de Cotización
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variants.length === 0) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="rounded-full p-1.5 bg-purple-50">
              <Eye className="text-purple-500 h-3.5 w-3.5" />
            </div>
            Variantes de Cotización
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No se encontraron variantes para esta cotización</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="rounded-full p-1.5 bg-purple-50">
            <Eye className="text-purple-500 h-3.5 w-3.5" />
          </div>
          Variantes de Cotización
          <Badge variant="outline" className="ml-auto text-xs font-medium">
            {variants.length} opciones
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-200">
                <TableHead className="font-medium text-slate-600 text-xs py-2">Variante</TableHead>
                <TableHead className="font-medium text-slate-600 text-xs py-2 text-right">Costo Base</TableHead>
                <TableHead className="font-medium text-slate-600 text-xs py-2 text-right">Markup</TableHead>
                <TableHead className="font-medium text-slate-600 text-xs py-2 text-right">Total</TableHead>
                <TableHead className="font-medium text-slate-600 text-xs py-2 text-center">Diferencia</TableHead>
                <TableHead className="font-medium text-slate-600 text-xs py-2 text-center">Estado</TableHead>
                {quotationStatus === 'pending' && (
                  <TableHead className="font-medium text-slate-600 text-xs py-2 text-center">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id} className={variant.isSelected ? "bg-green-50" : ""}>
                  <TableCell className="py-3">
                    <div>
                      <p className="font-medium text-sm text-slate-800">{variant.variantName}</p>
                      {variant.variantDescription && (
                        <p className="text-xs text-slate-500 mt-0.5">{variant.variantDescription}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm">
                    {formatCurrency(variant.baseCost)}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm">
                    {formatCurrency(variant.markupAmount)}
                  </TableCell>
                  <TableCell className="py-3 text-right font-medium text-sm">
                    {formatCurrency(variant.totalAmount)}
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    {variant.totalAmount > baseTotal ? (
                      <div className="text-center">
                        <span className="text-green-600 font-medium text-sm">
                          +{getPercentageDifference(variant.totalAmount, baseTotal)}%
                        </span>
                        <div className="text-xs text-slate-500">
                          Markup: {getMarkupPercentage(variant.markupAmount, variant.baseCost)}%
                        </div>
                      </div>
                    ) : variant.totalAmount < baseTotal ? (
                      <div className="text-center">
                        <span className="text-red-600 font-medium text-sm">
                          {getPercentageDifference(variant.totalAmount, baseTotal)}%
                        </span>
                        <div className="text-xs text-slate-500">
                          Markup: {getMarkupPercentage(variant.markupAmount, variant.baseCost)}%
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <span className="text-slate-500 font-medium text-sm">Base</span>
                        <div className="text-xs text-slate-500">
                          Markup: {getMarkupPercentage(variant.markupAmount, variant.baseCost)}%
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    {variant.isSelected ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Seleccionada
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-slate-600">
                        Disponible
                      </Badge>
                    )}
                  </TableCell>
                  {quotationStatus === 'pending' && (
                    <TableCell className="py-3 text-center">
                      {!variant.isSelected && (
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleApproveVariant(variant)}
                          disabled={approvingVariant === variant.id}
                        >
                          {approvingVariant === variant.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
                              Aprobando...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Aprobar
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {quotationStatus === 'pending' && (
          <>
            <Separator />
            <div className="p-4 bg-blue-50">
              <p className="text-xs text-blue-700 mb-2 font-medium">
                💡 Instrucciones para aprobar variantes:
              </p>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• Selecciona "Aprobar" en la variante que deseas confirmar</li>
                <li>• Al aprobar una variante, la cotización cambiará a estado "Aprobada"</li>
                <li>• Podrás crear el proyecto basado en la variante seleccionada</li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default QuotationVariantsDisplay;