import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Clock, Users, Calendar } from "lucide-react";

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
  const [teamHours, setTeamHours] = useState<Record<number, number>>({});

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
        .filter(([_, hours]) => hours > 0)
        .map(([personnelId, hours]) => {
          const member = Array.isArray(baseTeam) ? baseTeam.find((m: any) => m.personnelId === parseInt(personnelId)) : null;
          if (member) {
            return apiRequest(`/api/time-entries`, "POST", {
              projectId,
              personnelId: parseInt(personnelId),
              date: data.startDate,
              hours,
              totalCost: hours * member.hourlyRate,
              hourlyRateAtTime: member.hourlyRate,
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
    if (Object.values(teamHours).some(h => h > 0)) {
      createTimeEntries.mutate(data);
    } else {
      toast({
        title: "Sin horas",
        description: "Debes agregar horas para al menos un miembro del equipo",
        variant: "destructive"
      });
    }
  };

  const getTotalHours = () => Object.values(teamHours).reduce((sum, hours) => sum + hours, 0);
  
  const getTotalCost = () => {
    if (!baseTeam) return 0;
    return Object.entries(teamHours).reduce((sum, [personnelId, hours]) => {
      const member = baseTeam.find((m: any) => m.personnelId === parseInt(personnelId));
      return sum + (member ? hours * member.hourlyRate : 0);
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

  if (!baseTeam || baseTeam.length === 0) {
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
                  
                  {baseTeam.map((member: any) => (
                    <div key={member.personnelId} className="grid grid-cols-3 gap-3 items-center">
                      <div>
                        <p className="font-medium text-sm">{member.personnel?.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role?.name}</p>
                      </div>
                      
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="Horas"
                        value={teamHours[member.personnelId] || ""}
                        onChange={(e) => setTeamHours(prev => ({
                          ...prev,
                          [member.personnelId]: parseFloat(e.target.value) || 0
                        }))}
                      />
                      
                      <div className="text-sm text-muted-foreground">
                        ${((teamHours[member.personnelId] || 0) * member.hourlyRate).toFixed(2)}
                      </div>
                    </div>
                  ))}

                  <div className="border-t pt-3 grid grid-cols-2 gap-4 text-sm font-medium">
                    <div>Total: {getTotalHours().toFixed(1)}h</div>
                    <div>Costo: ${getTotalCost().toFixed(2)}</div>
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