import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, DollarSign, Calendar, User, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Schema para crear/editar ajustes de precio
const priceAdjustmentSchema = z.object({
  previousPrice: z.number().positive("El precio anterior debe ser positivo"),
  newPrice: z.number().positive("El nuevo precio debe ser positivo"),
  effectiveDate: z.string().min(1, "La fecha efectiva es requerida"),
  reason: z.string().min(5, "El motivo debe tener al menos 5 caracteres"),
  changeType: z.enum(["increase", "decrease", "scope_change", "market_adjustment"], {
    required_error: "Debe seleccionar un tipo de cambio"
  }),
  clientNotified: z.boolean().default(false),
  clientApproval: z.boolean().optional(),
  approvalDate: z.string().optional(),
  notes: z.string().optional(),
});

type PriceAdjustmentFormData = z.infer<typeof priceAdjustmentSchema>;

interface ProjectPriceAdjustment {
  id: number;
  projectId: number;
  previousPrice: number;
  newPrice: number;
  adjustmentPercentage: number;
  effectiveDate: string;
  reason: string;
  changeType: string;
  clientNotified: boolean;
  clientApproval: boolean | null;
  approvalDate: string | null;
  notes: string | null;
  createdBy: number;
  createdAt: string;
  createdByName?: string;
}

interface ProjectPriceAdjustmentsProps {
  projectId: number;
  currentPrice?: number;
}

const getChangeTypeLabel = (type: string) => {
  const labels = {
    increase: "Incremento",
    decrease: "Descuento",
    scope_change: "Cambio de alcance",
    market_adjustment: "Ajuste de mercado"
  };
  return labels[type as keyof typeof labels] || type;
};

const getChangeTypeColor = (type: string) => {
  const colors = {
    increase: "bg-red-100 text-red-800",
    decrease: "bg-green-100 text-green-800",
    scope_change: "bg-blue-100 text-blue-800",
    market_adjustment: "bg-yellow-100 text-yellow-800"
  };
  return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
};

const getApprovalStatus = (approval: boolean | null) => {
  if (approval === null) return { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" };
  if (approval === true) return { label: "Aprobado", color: "bg-green-100 text-green-800" };
  return { label: "Rechazado", color: "bg-red-100 text-red-800" };
};

export function ProjectPriceAdjustments({ projectId, currentPrice }: ProjectPriceAdjustmentsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<ProjectPriceAdjustment | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query para obtener ajustes de precio del proyecto
  const { data: adjustments = [], isLoading } = useQuery<ProjectPriceAdjustment[]>({
    queryKey: [`/api/projects/${projectId}/price-adjustments`],
    enabled: !!projectId,
  });

  // Query para obtener precio actual del proyecto
  const { data: priceData } = useQuery<{ currentPrice: number }>({
    queryKey: [`/api/projects/${projectId}/current-price`],
    enabled: !!projectId,
  });

  const form = useForm<PriceAdjustmentFormData>({
    resolver: zodResolver(priceAdjustmentSchema),
    defaultValues: {
      previousPrice: currentPrice || priceData?.currentPrice || 0,
      newPrice: 0,
      effectiveDate: new Date().toISOString().split('T')[0],
      reason: "",
      changeType: "increase",
      clientNotified: false,
      notes: "",
    },
  });

  // Mutación para crear ajuste de precio
  const createMutation = useMutation({
    mutationFn: (data: PriceAdjustmentFormData) => {
      const adjustmentPercentage = ((data.newPrice - data.previousPrice) / data.previousPrice) * 100;
      return apiRequest(`/api/projects/${projectId}/price-adjustments`, {
        method: "POST",
        body: {
          ...data,
          adjustmentPercentage,
          effectiveDate: new Date(data.effectiveDate).toISOString(),
          approvalDate: data.approvalDate ? new Date(data.approvalDate).toISOString() : null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/price-adjustments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/current-price`] });
      toast({
        title: "Ajuste de precio creado",
        description: "El ajuste de precio se ha registrado correctamente.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear ajuste",
        description: error.message || "No se pudo crear el ajuste de precio",
        variant: "destructive",
      });
    },
  });

  // Mutación para eliminar ajuste de precio
  const deleteMutation = useMutation({
    mutationFn: (adjustmentId: number) =>
      apiRequest(`/api/price-adjustments/${adjustmentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/price-adjustments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/current-price`] });
      toast({
        title: "Ajuste eliminado",
        description: "El ajuste de precio se ha eliminado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar el ajuste",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PriceAdjustmentFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (adjustment: ProjectPriceAdjustment) => {
    setEditingAdjustment(adjustment);
    form.reset({
      previousPrice: adjustment.previousPrice,
      newPrice: adjustment.newPrice,
      effectiveDate: adjustment.effectiveDate.split('T')[0],
      reason: adjustment.reason,
      changeType: adjustment.changeType as any,
      clientNotified: adjustment.clientNotified,
      clientApproval: adjustment.clientApproval || undefined,
      approvalDate: adjustment.approvalDate?.split('T')[0] || undefined,
      notes: adjustment.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (adjustmentId: number) => {
    if (confirm("¿Está seguro de que desea eliminar este ajuste de precio?")) {
      deleteMutation.mutate(adjustmentId);
    }
  };

  const formatCurrency = (amount: number) => {
    return `ARS ${amount.toLocaleString('es-AR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Ajustes de Precio del Proyecto</CardTitle>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                onClick={() => {
                  setEditingAdjustment(null);
                  form.reset({
                    previousPrice: priceData?.currentPrice || currentPrice || 0,
                    newPrice: 0,
                    effectiveDate: new Date().toISOString().split('T')[0],
                    reason: "",
                    changeType: "increase",
                    clientNotified: false,
                    notes: "",
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Ajuste
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingAdjustment ? "Editar Ajuste de Precio" : "Nuevo Ajuste de Precio"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="previousPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Precio Anterior</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="newPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nuevo Precio</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="effectiveDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha Efectiva</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="changeType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Cambio</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="increase">Incremento</SelectItem>
                              <SelectItem value="decrease">Descuento</SelectItem>
                              <SelectItem value="scope_change">Cambio de alcance</SelectItem>
                              <SelectItem value="market_adjustment">Ajuste de mercado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motivo del Ajuste</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describa el motivo del ajuste de precio..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notas Adicionales</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Notas opcionales..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Guardando..." : "Guardar Ajuste"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Cargando ajustes de precio...</div>
        ) : !adjustments || adjustments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>No hay ajustes de precio registrados para este proyecto.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {adjustments.map((adjustment: ProjectPriceAdjustment) => {
              const approvalStatus = getApprovalStatus(adjustment.clientApproval);
              return (
                <div
                  key={adjustment.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getChangeTypeColor(adjustment.changeType)}>
                          {getChangeTypeLabel(adjustment.changeType)}
                        </Badge>
                        <Badge className={approvalStatus.color}>
                          {approvalStatus.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(adjustment.effectiveDate), "dd/MM/yyyy", { locale: es })}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          Anterior: {formatCurrency(adjustment.previousPrice)}
                        </span>
                        <span className="text-sm font-medium">
                          Nuevo: {formatCurrency(adjustment.newPrice)}
                        </span>
                        <span className={`text-sm font-medium ${
                          adjustment.adjustmentPercentage > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {adjustment.adjustmentPercentage > 0 ? '+' : ''}
                          {adjustment.adjustmentPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{adjustment.reason}</p>
                      {adjustment.notes && (
                        <p className="text-xs text-muted-foreground italic">
                          Notas: {adjustment.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {adjustment.createdByName} • {format(new Date(adjustment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(adjustment)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(adjustment.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {priceData?.currentPrice && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium">Precio Actual del Proyecto:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(priceData.currentPrice)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}