import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Clock, Users, Save, Send, Calendar } from "lucide-react";

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
  const [teamHours, setTeamHours] = useState<{ [key: number]: { hours: number; description: string } }>({});

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

  const handleUpdateTeamHours = (personnelId: number, hours: number, description: string) => {
    setTeamHours(prev => ({
      ...prev,
      [personnelId]: { hours, description }
    }));
  };

  const handleSaveAllHours = async () => {
    if (!currentQuickEntryId) return;

    const promises = Object.entries(teamHours).map(([personnelId, data]) => {
      if (data.hours > 0) {
        const teamMember = Array.isArray(baseTeam) ? baseTeam.find((member: any) => member.personnelId === parseInt(personnelId)) : null;
        if (teamMember) {
          return addTimeDetail.mutateAsync({
            quickTimeEntryId: currentQuickEntryId,
            data: {
              personnelId: parseInt(personnelId),
              roleId: teamMember.roleId,
              hours: data.hours,
              hourlyRate: teamMember.hourlyRate,
              totalCost: data.hours * teamMember.hourlyRate,
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
    return Object.entries(teamHours).reduce((sum, [personnelId, data]) => {
      const teamMember = Array.isArray(baseTeam) ? baseTeam.find((member: any) => member.personnelId === parseInt(personnelId)) : null;
      if (teamMember && data.hours > 0) {
        return sum + (data.hours * teamMember.hourlyRate);
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
              <Calendar className="h-5 w-5" />
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
                <div key={member.personnelId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{member.personnel?.name}</h4>
                      <p className="text-sm text-muted-foreground">{member.role?.name} - ${member.hourlyRate}/hora</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Horas</label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="0.0"
                        value={teamHours[member.personnelId]?.hours || ""}
                        onChange={(e) => {
                          const hours = parseFloat(e.target.value) || 0;
                          handleUpdateTeamHours(
                            member.personnelId,
                            hours,
                            teamHours[member.personnelId]?.description || ""
                          );
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Costo</label>
                      <Input
                        type="text"
                        value={`$${((teamHours[member.personnelId]?.hours || 0) * member.hourlyRate).toFixed(2)}`}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-sm font-medium mb-1 block">Descripción (opcional)</label>
                    <Input
                      placeholder="Descripción de las actividades..."
                      value={teamHours[member.personnelId]?.description || ""}
                      onChange={(e) => {
                        handleUpdateTeamHours(
                          member.personnelId,
                          teamHours[member.personnelId]?.hours || 0,
                          e.target.value
                        );
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Resumen */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Total Horas:</span> {getTotalHours().toFixed(1)}h
                  </div>
                  <div>
                    <span className="font-medium">Costo Total:</span> ${getTotalCost().toFixed(2)}
                  </div>
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