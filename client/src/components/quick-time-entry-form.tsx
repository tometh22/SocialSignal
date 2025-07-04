
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Save, 
  DollarSign, 
  X, 
  Send,
  Zap,
  Target,
  TrendingUp,
  Star,
  Award,
  Sparkles,
  Timer
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const quickTimeEntrySchema = z.object({
  periodName: z.string().min(1, "El nombre del período es requerido"),
  startDate: z.string().min(1, "La fecha de inicio es requerida"),
  endDate: z.string().min(1, "La fecha de fin es requerida"),
  notes: z.string().optional()
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
  const [currentStep, setCurrentStep] = useState<'period' | 'team'>('period');
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<number, boolean>>({});

  const form = useForm<z.infer<typeof quickTimeEntrySchema>>({
    resolver: zodResolver(quickTimeEntrySchema),
    defaultValues: {
      periodName: "",
      startDate: "",
      endDate: "",
      notes: ""
    }
  });

  // Auto-generate period name based on dates
  const watchedStartDate = form.watch("startDate");
  const watchedEndDate = form.watch("endDate");

  useEffect(() => {
    if (watchedStartDate && watchedEndDate) {
      const start = new Date(watchedStartDate);
      const end = new Date(watchedEndDate);
      const startMonth = format(start, "MMMM", { locale: es });
      const endMonth = format(end, "MMMM", { locale: es });
      
      let suggestedName = "";
      if (startMonth === endMonth) {
        suggestedName = `${startMonth} ${start.getFullYear()}`;
      } else {
        suggestedName = `${startMonth} - ${endMonth} ${start.getFullYear()}`;
      }
      
      if (!form.getValues("periodName")) {
        form.setValue("periodName", suggestedName);
      }
    }
  }, [watchedStartDate, watchedEndDate, form]);

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
      setCurrentStep('team');
      toast({
        title: "✨ Período creado exitosamente",
        description: "Ahora puedes configurar las horas del equipo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al crear período",
        description: error.message || "Intenta nuevamente",
        variant: "destructive"
      });
    }
  });

  // Agregar detalle de horas con optimistic updates
  const addTimeDetail = useMutation({
    mutationFn: ({ quickTimeEntryId, data }: { quickTimeEntryId: number; data: any }) =>
      apiRequest(`/api/quick-time-entries/${quickTimeEntryId}/details`, "POST", data),
    onSuccess: (_, variables) => {
      setOptimisticUpdates(prev => ({ ...prev, [variables.data.personnelId]: true }));
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/quick-time-entries`] });
      
      setTimeout(() => {
        setOptimisticUpdates(prev => ({ ...prev, [variables.data.personnelId]: false }));
      }, 1000);
    }
  });

  // Enviar para aprobación
  const submitQuickEntry = useMutation({
    mutationFn: (entryId: number) =>
      apiRequest(`/api/quick-time-entries/${entryId}/submit`, "POST"),
    onSuccess: () => {
      toast({
        title: "🎉 ¡Registro enviado exitosamente!",
        description: "Tu registro ha sido enviado para aprobación",
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

    const validEntries = Object.entries(teamHours).filter(([_, data]) => data.hours > 0);
    
    if (validEntries.length === 0) {
      toast({
        title: "⚠️ Sin registros",
        description: "Agrega horas para al menos un miembro del equipo",
        variant: "destructive"
      });
      return;
    }

    const promises = validEntries.map(([personnelId, data]) => {
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
      return Promise.resolve();
    });

    try {
      await Promise.all(promises);
      toast({
        title: "✅ Horas guardadas exitosamente",
        description: `Se registraron ${validEntries.length} entradas de tiempo`,
      });
    } catch (error) {
      toast({
        title: "❌ Error al guardar",
        description: "Algunos registros no pudieron guardarse",
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

  const getProgressPercentage = () => {
    if (!Array.isArray(baseTeam) || baseTeam.length === 0) return 0;
    const membersWithHours = Object.values(teamHours).filter(data => data.hours > 0).length;
    return (membersWithHours / baseTeam.length) * 100;
  };

  if (loadingTeam) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
            <Timer className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Cargando equipo del proyecto</h3>
            <p className="text-gray-600 text-sm">Preparando la interfaz de registro...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!Array.isArray(baseTeam) || baseTeam.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 py-12"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mx-auto">
          <Users className="w-10 h-10 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Sin Equipo Base Configurado</h3>
          <p className="text-gray-600 mb-6">Este proyecto necesita un equipo base para registrar horas</p>
          <Button
            onClick={() => {
              apiRequest(`/api/projects/${projectId}/copy-quotation-team`, "POST")
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/base-team`] });
                  toast({
                    title: "🎉 Equipo configurado",
                    description: "El equipo de la cotización ha sido copiado al proyecto"
                  });
                })
                .catch(() => {
                  toast({
                    title: "❌ Error",
                    description: "Error al configurar el equipo",
                    variant: "destructive"
                  });
                });
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Configurar Equipo Automáticamente
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <motion.div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                currentStep === 'period' || currentQuickEntryId 
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg" 
                  : "bg-gray-200 text-gray-600"
              )}
              whileHover={{ scale: 1.05 }}
            >
              {currentQuickEntryId ? <CheckCircle2 className="w-5 h-5" /> : <CalendarIcon className="w-5 h-5" />}
            </motion.div>
            <span className={cn(
              "font-medium transition-colors",
              currentStep === 'period' || currentQuickEntryId ? "text-gray-900" : "text-gray-500"
            )}>
              Configurar Período
            </span>
          </div>
          
          <div className="flex-1 h-px bg-gradient-to-r from-blue-500 to-purple-600 mx-4 opacity-30" />
          
          <div className="flex items-center space-x-4">
            <motion.div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                currentStep === 'team' 
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg" 
                  : "bg-gray-200 text-gray-600"
              )}
              whileHover={{ scale: 1.05 }}
            >
              <Users className="w-5 h-5" />
            </motion.div>
            <span className={cn(
              "font-medium transition-colors",
              currentStep === 'team' ? "text-gray-900" : "text-gray-500"
            )}>
              Registrar Horas del Equipo
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Formulario de período */}
        {currentStep === 'period' && (
          <motion.div
            key="period"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-blue-50/30">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <CalendarIcon className="h-5 w-5 text-white" />
                  </div>
                  Definir Período de Registro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreateQuickEntry)} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-sm font-medium text-gray-700">Fecha de Inicio</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal h-11 border-2 transition-all duration-200",
                                      !field.value && "text-muted-foreground",
                                      "hover:border-blue-300 focus:border-blue-500"
                                    )}
                                  >
                                    {field.value ? (
                                      format(new Date(field.value), "dd/MM/yyyy", { locale: es })
                                    ) : (
                                      <span>Seleccionar fecha</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value ? new Date(field.value) : undefined}
                                  onSelect={(date) => field.onChange(date?.toISOString().split('T')[0])}
                                  disabled={(date) => date < new Date("1900-01-01")}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-sm font-medium text-gray-700">Fecha de Fin</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal h-11 border-2 transition-all duration-200",
                                      !field.value && "text-muted-foreground",
                                      "hover:border-blue-300 focus:border-blue-500"
                                    )}
                                  >
                                    {field.value ? (
                                      format(new Date(field.value), "dd/MM/yyyy", { locale: es })
                                    ) : (
                                      <span>Seleccionar fecha</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value ? new Date(field.value) : undefined}
                                  onSelect={(date) => field.onChange(date?.toISOString().split('T')[0])}
                                  disabled={(date) => date < new Date("1900-01-01")}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="periodName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Nombre del Período</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ej: Enero 2025, Primera quincena marzo" 
                              className="h-11 border-2 hover:border-blue-300 focus:border-blue-500 transition-all duration-200"
                              {...field} 
                            />
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
                          <FormLabel className="text-sm font-medium text-gray-700">Notas (opcional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Notas adicionales sobre este período..." 
                              className="border-2 hover:border-blue-300 focus:border-blue-500 transition-all duration-200 resize-none"
                              rows={3}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-3 pt-4">
                      <Button 
                        type="submit" 
                        disabled={createQuickEntry.isPending}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 h-11 font-medium"
                      >
                        {createQuickEntry.isPending ? (
                          <>
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                            />
                            Creando período...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Continuar al Registro
                          </>
                        )}
                      </Button>
                      {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} className="h-11">
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Registro de horas por equipo */}
        {currentStep === 'team' && currentQuickEntryId && (
          <motion.div
            key="team"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-green-50/30">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    Registrar Horas del Equipo
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-600">Progreso:</div>
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-green-500 to-blue-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${getProgressPercentage()}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="text-sm font-medium text-gray-700">
                      {Math.round(getProgressPercentage())}%
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.isArray(baseTeam) && baseTeam.map((member: any) => (
                    <motion.div 
                      key={member.personnelId} 
                      className="relative p-6 bg-white rounded-xl border-2 border-gray-100 hover:border-blue-200 transition-all duration-300 hover:shadow-lg"
                      whileHover={{ y: -2 }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {member.personnel?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <span className="text-lg font-semibold text-gray-900">{member.personnel?.name}</span>
                            <p className="text-sm text-gray-600">{member.role?.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <motion.p 
                            className="text-2xl font-bold text-green-600"
                            key={teamHours[member.personnelId]?.hours || 0}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            ${((teamHours[member.personnelId]?.hours || 0) * (teamHours[member.personnelId]?.customRate || member.hourlyRate)).toLocaleString()}
                          </motion.p>
                          <p className="text-sm text-gray-500">costo total</p>
                          <AnimatePresence>
                            {optimisticUpdates[member.personnelId] && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
                              >
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 items-end">
                        <div className="col-span-3">
                          <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Horas
                          </Label>
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
                            className="h-11 text-lg font-mono text-center border-2 hover:border-blue-300 focus:border-blue-500 transition-all duration-200"
                          />
                        </div>

                        <div className="col-span-3">
                          <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
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
                                "h-11 text-lg font-mono text-center pr-10 border-2 transition-all duration-200",
                                teamHours[member.personnelId]?.customRate 
                                  ? "border-amber-300 bg-amber-50 hover:border-amber-400 focus:border-amber-500" 
                                  : "hover:border-blue-300 focus:border-blue-500"
                              )}
                            />
                            {teamHours[member.personnelId]?.customRate && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUpdateTeamHours(
                                  member.personnelId, 
                                  teamHours[member.personnelId]?.hours || 0, 
                                  teamHours[member.personnelId]?.description || '',
                                  undefined
                                )}
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
                                title="Restaurar tarifa actual"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {teamHours[member.personnelId]?.customRate ? (
                            <Badge variant="secondary" className="mt-1 text-xs bg-amber-100 text-amber-800 border-amber-200">
                              <Award className="w-3 h-3 mr-1" />
                              Tarifa histórica
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Actual: ${member.hourlyRate}
                            </Badge>
                          )}
                        </div>

                        <div className="col-span-6">
                          <Label className="text-sm font-medium text-gray-700">Descripción del trabajo</Label>
                          <Input
                            placeholder="Describe las actividades realizadas..."
                            value={teamHours[member.personnelId]?.description || ''}
                            onChange={(e) => handleUpdateTeamHours(
                              member.personnelId, 
                              teamHours[member.personnelId]?.hours || 0, 
                              e.target.value,
                              teamHours[member.personnelId]?.customRate
                            )}
                            className="h-11 border-2 hover:border-blue-300 focus:border-blue-500 transition-all duration-200"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* Resumen mejorado */}
                  <motion.div 
                    className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white p-6 rounded-2xl shadow-2xl"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                    <div className="relative flex justify-between items-center">
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4" />
                            <p className="text-xs font-medium opacity-90 uppercase tracking-wide">Total Horas</p>
                          </div>
                          <motion.p 
                            className="text-3xl font-bold"
                            key={getTotalHours()}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            {getTotalHours()}h
                          </motion.p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4" />
                            <p className="text-xs font-medium opacity-90 uppercase tracking-wide">Costo Total</p>
                          </div>
                          <motion.p 
                            className="text-3xl font-bold"
                            key={getTotalCost()}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            ${getTotalCost().toLocaleString()}
                          </motion.p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4" />
                            <p className="text-xs font-medium opacity-90 uppercase tracking-wide">Tarifa Promedio</p>
                          </div>
                          <p className="text-xl font-semibold">
                            ${getTotalHours() > 0 ? (getTotalCost() / getTotalHours()).toFixed(2) : '0'}/h
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-5 w-5" />
                          <span className="text-sm font-medium">Equipo registrado</span>
                        </div>
                        <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-white rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${getProgressPercentage()}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <p className="text-xs mt-1 opacity-90">
                          {Object.values(teamHours).filter(data => data.hours > 0).length} de {baseTeam.length} miembros
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Botones de acción mejorados */}
                  <div className="flex gap-3 pt-6">
                    <Button 
                      onClick={handleSaveAllHours}
                      disabled={addTimeDetail.isPending || getTotalHours() === 0}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-12 font-medium"
                    >
                      {addTimeDetail.isPending ? (
                        <>
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                          />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar Horas ({Object.values(teamHours).filter(data => data.hours > 0).length})
                        </>
                      )}
                    </Button>

                    <Button 
                      onClick={handleSubmitForApproval}
                      disabled={submitQuickEntry.isPending || getTotalHours() === 0}
                      variant="outline"
                      className="flex-1 border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50 h-12 font-medium"
                    >
                      {submitQuickEntry.isPending ? (
                        <>
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"
                          />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar para Aprobación
                        </>
                      )}
                    </Button>

                    {onCancel && (
                      <Button type="button" variant="ghost" onClick={onCancel} className="h-12">
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
