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
import { Clock, Users, Calendar, DollarSign, X, Save } from "lucide-react";
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

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Fecha Inicio</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-9 text-sm" />
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
                      <FormLabel className="text-sm">Fecha Fin</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-9 text-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-center">
                <Button
                  type="button"
                  onClick={() => setShowTeamForm(!showTeamForm)}
                  variant={showTeamForm ? "secondary" : "default"}
                  size="sm"
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-all duration-200",
                    showTeamForm 
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
                      : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                  )}
                >
                  {showTeamForm ? (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      Ocultar Equipo
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      Configurar Horas del Equipo
                    </>
                  )}
                </Button>
              </div>

              {showTeamForm && (
                <div className="space-y-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-lg p-4 border border-blue-100 shadow-sm">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-2">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <h4 className="text-base font-semibold text-gray-800 mb-1">Registro de Horas del Equipo</h4>
                    <p className="text-xs text-gray-600">Configura las horas y tarifas para cada miembro del equipo</p>
                  </div>
                  
                  <div className="grid gap-3">
                    {Array.isArray(baseTeam) && baseTeam.map((member: any, index) => (
                      <div key={member.personnelId} className="group relative bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
                        {/* Header con nombre y costo total */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                              {member.personnel?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </div>
                            <div>
                              <h5 className="font-medium text-gray-800 text-sm">{member.personnel?.name}</h5>
                              <p className="text-xs text-gray-500">{member.role?.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-emerald-600">
                              ${((teamHours[member.personnelId]?.hours || 0) * (teamHours[member.personnelId]?.customRate || member.hourlyRate)).toFixed(2)}
                            </div>
                            <p className="text-xs text-gray-500">Total</p>
                          </div>
                        </div>

                        {/* Grid de inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Campo de Horas */}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                              <Clock className="h-3 w-3 text-blue-600" />
                              Horas
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="0.0"
                                value={teamHours[member.personnelId]?.hours || ''}
                                onChange={(e) => setTeamHours(prev => ({
                                  ...prev,
                                  [member.personnelId]: {
                                    hours: parseFloat(e.target.value) || 0,
                                    customRate: prev[member.personnelId]?.customRate
                                  }
                                }))}
                                className="text-right text-sm font-semibold pr-8 h-8 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">hrs</span>
                            </div>
                          </div>

                          {/* Campo de Tarifa */}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-green-600" />
                              Tarifa/Hora
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={`${member.hourlyRate}`}
                                value={teamHours[member.personnelId]?.customRate ?? ''}
                                onChange={(e) => setTeamHours(prev => ({
                                  ...prev,
                                  [member.personnelId]: {
                                    hours: prev[member.personnelId]?.hours || 0,
                                    customRate: parseFloat(e.target.value) || undefined
                                  }
                                }))}
                                className={cn(
                                  "text-right text-sm font-semibold pr-8 h-8 transition-colors",
                                  teamHours[member.personnelId]?.customRate 
                                    ? "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-amber-500" 
                                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                )}
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                              {teamHours[member.personnelId]?.customRate ? (
                                <button
                                  type="button"
                                  onClick={() => setTeamHours(prev => ({
                                    ...prev,
                                    [member.personnelId]: {
                                      hours: prev[member.personnelId]?.hours || 0,
                                      customRate: undefined
                                    }
                                  }))}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-200 hover:bg-amber-300 rounded-full flex items-center justify-center text-amber-700 hover:text-amber-800 transition-colors"
                                  title="Restaurar tarifa actual"
                                >
                                  <X className="h-2 w-2" />
                                </button>
                              ) : (
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">/h</span>
                              )}
                            </div>
                            
                            {/* Badge indicador */}
                            <div className="flex justify-center mt-1">
                              {teamHours[member.personnelId]?.customRate ? (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs px-2 py-0">
                                  📅 Histórica
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-600 border-gray-300 text-xs px-2 py-0">
                                  💼 Actual: ${member.hourlyRate}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumen Final Compacto */}
                  <div className="bg-white rounded-lg p-3 border border-blue-200 shadow-sm">
                    <div className="text-center mb-2">
                      <h5 className="text-sm font-semibold text-gray-800">Resumen del Registro</h5>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded">
                        <div className="text-xl font-bold text-blue-600">{getTotalHours().toFixed(1)}</div>
                        <p className="text-xs font-medium text-blue-700">Horas</p>
                      </div>
                      
                      <div className="text-center p-2 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded">
                        <div className="text-xl font-bold text-emerald-600">${getTotalCost().toLocaleString()}</div>
                        <p className="text-xs font-medium text-emerald-700">Costo</p>
                      </div>
                      
                      <div className="text-center p-2 bg-gradient-to-br from-purple-50 to-purple-100 rounded">
                        <div className="text-xl font-bold text-purple-600">
                          ${getTotalHours() > 0 ? (getTotalCost() / getTotalHours()).toFixed(0) : '0'}
                        </div>
                        <p className="text-xs font-medium text-purple-700">Promedio</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-center pt-3">
                <Button 
                  type="submit" 
                  disabled={createTimeEntries.isPending || getTotalHours() === 0}
                  size="sm"
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-all duration-200",
                    getTotalHours() > 0 
                      ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white" 
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  )}
                >
                  {createTimeEntries.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Registrar {getTotalHours().toFixed(1)}h - ${getTotalCost().toLocaleString()}
                    </>
                  )}
                </Button>
                
                {onCancel && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onCancel}
                    size="sm"
                    className="px-4 py-2 text-sm border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                  >
                    <X className="h-4 w-4 mr-2" />
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