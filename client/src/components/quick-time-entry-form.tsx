import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Calendar as CalendarIcon, Clock, Users, AlertCircle, CheckCircle2, Plus, Save, DollarSign, X, Send } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const quickTimeEntrySchema = z.object({
  periodName: z.string().min(1, "El nombre del período es requerido"),
  startDate: z.string().min(1, "La fecha de inicio es requerida"),
  endDate: z.string().min(1, "La fecha de fin es requerida"),
  notes: z.string().optional()
});

const quickTimeEntryDetailSchema = z.object({
  hours: z.number().min(0.1, "Las horas deben ser mayor a 0"),
  description: z.string().optional()
});

interface QuickTimeEntryFormProps {
  projectId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function QuickTimeEntryForm({ projectId, onSuccess, onCancel }: QuickTimeEntryFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentQuickEntryId, setCurrentQuickEntryId] = useState<number | null>(null);
  const [teamHours, setTeamHours] = useState<Record<number, { hours: number; description: string; customRate?: number }>>({});

  const form = useForm<z.infer<typeof quickTimeEntrySchema>>({
    resolver: zodResolver(quickTimeEntrySchema),
    defaultValues: {
      periodName: "",
      startDate: "",
      endDate: "",
      notes: ""
    }
  });

  // Obtener equipo base del proyecto
  const { data: baseTeam = [], isLoading: loadingTeam } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId
  });

  // Crear entrada rápida de tiempo
  const createQuickEntry = useMutation({
    mutationFn: (data: z.infer<typeof quickTimeEntrySchema>) =>
      apiRequest(`/api/projects/${projectId}/quick-time-entries`, "POST", data),
    onSuccess: (newEntry) => {
      setCurrentQuickEntryId(newEntry.id);
      toast({
        title: "Registro creado",
        description: "Ahora puedes agregar las horas del equipo"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el registro",
        variant: "destructive"
      });
    }
  });

  // Agregar detalle de horas
  const addTimeDetail = useMutation({
    mutationFn: ({ quickTimeEntryId, data }: { quickTimeEntryId: number; data: any }) =>
      apiRequest(`/api/quick-time-entries/${quickTimeEntryId}/details`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/quick-time-entries`] });
    }
  });

  // Enviar para aprobación
  const submitQuickEntry = useMutation({
    mutationFn: (entryId: number) =>
      apiRequest(`/api/quick-time-entries/${entryId}/submit`, "POST"),
    onSuccess: () => {
      toast({
        title: "Registro enviado",
        description: "El registro ha sido enviado para aprobación"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/quick-time-entries`] });
      onSuccess?.();
    }
  });

  const handleCreateQuickEntry = async (data: z.infer<typeof quickTimeEntrySchema>) => {
    createQuickEntry.mutate(data);
  };

  const handleUpdateTeamHours = (personnelId: number, hours: number, description: string, customRate?: number) => {
    setTeamHours(prev => ({
      ...prev,
      [personnelId]: { hours, description, customRate }
    }));
  };

  const handleSaveAllHours = async () => {
    if (!currentQuickEntryId) return;

    const promises = Object.entries(teamHours).map(([personnelId, data]) => {
      if (data.hours > 0) {
        const teamMember = Array.isArray(baseTeam) ? baseTeam.find((member: any) => member.personnelId === parseInt(personnelId)) : null;
        if (teamMember) {
          const effectiveRate = data.customRate !== undefined ? data.customRate : teamMember.hourlyRate;
          return addTimeDetail.mutateAsync({
            quickTimeEntryId: currentQuickEntryId,
            data: {
              personnelId: parseInt(personnelId),
              roleId: teamMember.roleId,
              hours: data.hours,
              hourlyRate: effectiveRate,
              totalCost: data.hours * effectiveRate,
              description: data.description
            }
          });
        }
      }
      return Promise.resolve();
    });

    try {
      await Promise.all(promises);
      toast({
        title: "Horas guardadas",
        description: "Todas las horas han sido registradas correctamente"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al guardar algunas horas",
        variant: "destructive"
      });
    }
  };

  const handleSubmitForApproval = () => {
    if (currentQuickEntryId) {
      submitQuickEntry.mutate(currentQuickEntryId);
    }
  };

  const getTotalHours = () => {
    return Object.values(teamHours).reduce((sum, data) => sum + (data.hours || 0), 0);
  };

  const getTotalCost = () => {
    if (!Array.isArray(baseTeam)) return 0;

    return Object.entries(teamHours).reduce((sum, [personnelId, data]) => {
      const teamMember = baseTeam.find((member: any) => member.personnelId === parseInt(personnelId));
      if (teamMember && data.hours > 0) {
        const effectiveRate = data.customRate || teamMember.hourlyRate;
        return sum + (data.hours * effectiveRate);
      }
      return sum;
    }, 0);
  };

  if (loadingTeam) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Cargando equipo del proyecto...</div>
        </CardContent>
      </Card>
    );
  }

  if (!Array.isArray(baseTeam) || baseTeam.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sin Equipo Base
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground mb-4">
            Este proyecto no tiene un equipo base configurado.
          </div>
          <Button
            onClick={() => {
              // Copiar equipo de cotización
              apiRequest(`/api/projects/${projectId}/copy-quotation-team`, "POST")
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/base-team`] });
                  toast({
                    title: "Equipo copiado",
                    description: "El equipo de la cotización ha sido copiado al proyecto"
                  });
                })
                .catch(() => {
                  toast({
                    title: "Error",
                    description: "Error al copiar el equipo de la cotización",
                    variant: "destructive"
                  });
                });
            }}
            className="w-full"
          >
            Copiar Equipo de Cotización
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Formulario de período */}
      {!currentQuickEntryId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Definir Período de Registro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateQuickEntry)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="periodName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Período</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Enero 2025, Primera quincena marzo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Inicio</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Fin</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas (opcional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notas adicionales sobre este período..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button type="submit" disabled={createQuickEntry.isPending}>
                    {createQuickEntry.isPending ? "Creando..." : "Continuar"}
                  </Button>
                  {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Registro de horas por equipo */}
      {currentQuickEntryId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Registrar Horas del Equipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.isArray(baseTeam) && baseTeam.map((member: any) => (
                <div key={member.personnelId} className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-slate-700">{member.personnel?.name}</span>
                            <p className="text-xs text-slate-500">{member.role?.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-emerald-600">
                              ${((teamHours[member.personnelId]?.hours || 0) * (teamHours[member.personnelId]?.customRate || member.hourlyRate)).toFixed(2)}
                            </p>
                            <p className="text-xs text-slate-500">costo total</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3">
                            <Label className="text-xs text-slate-600">Horas</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder="0"
                              value={teamHours[member.personnelId]?.hours || ''}
                              onChange={(e) => handleUpdateTeamHours(
                                member.personnelId, 
                                parseFloat(e.target.value) || 0, 
                                teamHours[member.personnelId]?.description || '',
                                teamHours[member.personnelId]?.customRate
                              )}
                              className="h-9 text-sm font-mono text-right"
                            />
                          </div>

                          <div className="col-span-3">
                            <Label className="text-xs text-slate-600 flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Tarifa/Hora
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={member.hourlyRate.toString()}
                                value={teamHours[member.personnelId]?.customRate || ''}
                                onChange={(e) => handleUpdateTeamHours(
                                  member.personnelId, 
                                  teamHours[member.personnelId]?.hours || 0, 
                                  teamHours[member.personnelId]?.description || '',
                                  parseFloat(e.target.value) || undefined
                                )}
                                className={cn(
                                  "h-9 text-sm font-mono text-right pr-8",
                                  teamHours[member.personnelId]?.customRate ? "border-amber-300 bg-amber-50" : "border-slate-300"
                                )}
                              />
                              {teamHours[member.personnelId]?.customRate && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTeamHours(
                                    member.personnelId, 
                                    teamHours[member.personnelId]?.hours || 0, 
                                    teamHours[member.personnelId]?.description || '',
                                    undefined
                                  )}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-600 hover:text-amber-800"
                                  title="Restaurar tarifa actual"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              {teamHours[member.personnelId]?.customRate ? (
                                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                                  Tarifa histórica
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Tarifa actual: ${member.hourlyRate}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="col-span-6">
                            <Label className="text-xs text-slate-600">Descripción del trabajo</Label>
                            <Input
                              placeholder="Describe las actividades realizadas..."
                              value={teamHours[member.personnelId]?.description || ''}
                              onChange={(e) => handleUpdateTeamHours(
                                member.personnelId, 
                                teamHours[member.personnelId]?.hours || 0, 
                                e.target.value,
                                teamHours[member.personnelId]?.customRate
                              )}
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>
              ))}

              {/* Resumen */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Total Horas</p>
                  <p className="text-2xl font-bold text-blue-600">{getTotalHours()}h</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Costo Total</p>
                  <p className="text-2xl font-bold text-emerald-600">${getTotalCost().toLocaleString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Tarifa promedio</p>
                <p className="text-lg font-semibold text-slate-700">
                  ${getTotalHours() > 0 ? (getTotalCost() / getTotalHours()).toFixed(2) : '0'}/h
                </p>
              </div>
            </div>

              {/* Botones de acción */}
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleSaveAllHours}
                  disabled={addTimeDetail.isPending || getTotalHours() === 0}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {addTimeDetail.isPending ? "Guardando..." : "Guardar Horas"}
                </Button>

                <Button 
                  onClick={handleSubmitForApproval}
                  disabled={submitQuickEntry.isPending || getTotalHours() === 0}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {submitQuickEntry.isPending ? "Enviando..." : "Enviar para Aprobación"}
                </Button>

                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}