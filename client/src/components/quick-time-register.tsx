import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Clock, Users, Calendar, DollarSign, X } from "lucide-react";
import { cn } from "@/lib/utils";

const periodFormSchema = z.object({
  periodName: z.string().min(1, "Nombre del período requerido"),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().min(1, "Fecha de fin requerida")
});

interface QuickTimeRegisterProps {
  projectId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function QuickTimeRegister({ projectId, onSuccess, onCancel }: QuickTimeRegisterProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamHours, setTeamHours] = useState<Record<number, { hours: number; customRate?: number }>>({});

  const form = useForm<z.infer<typeof periodFormSchema>>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: {
      periodName: "",
      startDate: "",
      endDate: ""
    }
  });

  // Obtener equipo base del proyecto
  const { data: baseTeam, isLoading: loadingTeam } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId
  });

  // Copiar equipo de cotización
  const copyTeamMutation = useMutation({
    mutationFn: () => apiRequest(`/api/projects/${projectId}/copy-quotation-team`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/base-team`] });
      toast({
        title: "Equipo copiado",
        description: "El equipo de la cotización se ha configurado para el proyecto"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo copiar el equipo de la cotización",
        variant: "destructive"
      });
    }
  });

  // Crear registro masivo de tiempo
  const createTimeEntries = useMutation({
    mutationFn: async (data: z.infer<typeof periodFormSchema>) => {
      const promises = Object.entries(teamHours)
        .filter(([_, data]) => data.hours > 0)
        .map(([personnelId, hoursData]) => {
          const member = Array.isArray(baseTeam) ? baseTeam.find((m: any) => m.personnelId === parseInt(personnelId)) : null;
          if (member) {
            const effectiveRate = hoursData.customRate !== undefined ? hoursData.customRate : member.hourlyRate;
            return apiRequest(`/api/time-entries`, "POST", {
              projectId,
              personnelId: parseInt(personnelId),
              date: data.startDate,
              hours: hoursData.hours,
              totalCost: hoursData.hours * effectiveRate,
              hourlyRateAtTime: effectiveRate,
              entryType: "hours",
              description: `${data.periodName} - Registro rápido`,
              isDateRange: true,
              startDate: data.startDate,
              endDate: data.endDate,
              periodDescription: data.periodName
            });
          }
          return Promise.resolve();
        });

      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Horas registradas",
        description: "Todas las horas han sido registradas exitosamente"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/time-entries`] });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al registrar las horas",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: z.infer<typeof periodFormSchema>) => {
    if (Object.values(teamHours).some(h => h.hours > 0)) {
      createTimeEntries.mutate(data);
    } else {
      toast({
        title: "Sin horas",
        description: "Debes agregar horas para al menos un miembro del equipo",
        variant: "destructive"
      });
    }
  };

  const getTotalHours = () => Object.values(teamHours).reduce((sum, data) => sum + data.hours, 0);
  
  const getTotalCost = () => {
    if (!Array.isArray(baseTeam)) return 0;
    return Object.entries(teamHours).reduce((sum, [personnelId, hoursData]) => {
      const member = baseTeam.find((m: any) => m.personnelId === parseInt(personnelId));
      if (member) {
        const effectiveRate = hoursData.customRate !== undefined ? hoursData.customRate : member.hourlyRate;
        return sum + (hoursData.hours * effectiveRate);
      }
      return sum;
    }, 0);
  };

  if (loadingTeam) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Cargando equipo del proyecto...
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
            Configurar Equipo Base
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Para usar el registro rápido, primero necesitas configurar el equipo base del proyecto.
          </p>
          <Button
            onClick={() => copyTeamMutation.mutate()}
            disabled={copyTeamMutation.isPending}
            className="w-full"
          >
            {copyTeamMutation.isPending ? "Copiando..." : "Copiar Equipo de Cotización"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Registro Rápido de Horas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="periodName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período</FormLabel>
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
                      <FormLabel>Fecha Inicio</FormLabel>
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
                      <FormLabel>Fecha Fin</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="button"
                onClick={() => setShowTeamForm(!showTeamForm)}
                variant="outline"
                className="w-full"
              >
                {showTeamForm ? "Ocultar" : "Mostrar"} Equipo
              </Button>

              {showTeamForm && (
                <div className="space-y-4 border rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Horas por Miembro del Equipo
                  </h4>
                  
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

                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-6">
                          <Label className="text-xs text-slate-600">Horas</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="0"
                            value={teamHours[member.personnelId]?.hours || 0}
                            onChange={(e) => setTeamHours(prev => ({
                              ...prev,
                              [member.personnelId]: {
                                hours: parseFloat(e.target.value) || 0,
                                customRate: prev[member.personnelId]?.customRate
                              }
                            }))}
                            className="h-9 text-sm font-mono text-right"
                          />
                        </div>

                        <div className="col-span-6">
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
                              value={teamHours[member.personnelId]?.customRate ?? ''}
                              onChange={(e) => setTeamHours(prev => ({
                                ...prev,
                                [member.personnelId]: {
                                  hours: prev[member.personnelId]?.hours || 0,
                                  customRate: parseFloat(e.target.value) || undefined
                                }
                              }))}
                              className={cn(
                                "h-9 text-sm font-mono text-right pr-8",
                                teamHours[member.personnelId]?.customRate ? "border-amber-300 bg-amber-50" : "border-slate-300"
                              )}
                            />
                            {teamHours[member.personnelId]?.customRate && (
                              <button
                                type="button"
                                onClick={() => setTeamHours(prev => ({
                                  ...prev,
                                  [member.personnelId]: {
                                    hours: prev[member.personnelId]?.hours || 0,
                                    customRate: undefined
                                  }
                                }))}
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
                      </div>
                    </div>
                  ))}

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
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={createTimeEntries.isPending || getTotalHours() === 0}
                  className="flex-1"
                >
                  {createTimeEntries.isPending ? "Registrando..." : "Registrar Horas"}
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
    </div>
  );
}