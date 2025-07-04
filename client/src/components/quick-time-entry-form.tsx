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
  Timer,
  Eye,
  Edit3,
  BarChart3,
  Filter,
  Search,
  ArrowRight,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Maximize2,
  Minimize2,
  RefreshCw
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
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  const [filterTeam, setFilterTeam] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

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
    enabled: !!projectId,
    onSuccess: (data) => {
      console.log('🔍 Base team loaded:', data);
      console.log('🔍 Team members count:', data?.length || 0);
      if (Array.isArray(data)) {
        data.forEach((member, index) => {
          console.log(`  ${index + 1}. ${member.personnel?.name} - ${member.role?.name} - $${member.hourlyRate}`);
        });
      }
    },
    onError: (error) => {
      console.error('❌ Error loading base team:', error);
    }
  });

  // Crear entrada rápida de tiempo
  const createQuickEntry = useMutation({
    mutationFn: (data: z.infer<typeof quickTimeEntrySchema>) =>
      apiRequest(`/api/projects/${projectId}/quick-time-entries`, "POST", data),
    onSuccess: (newEntry) => {
      setCurrentQuickEntryId(newEntry.id);
      setCurrentStep('team');
      toast({
        title: "🎯 Período configurado exitosamente",
        description: "Ahora puedes registrar las horas del equipo",
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
        title: "🚀 ¡Registro enviado exitosamente!",
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

  const filteredTeam = Array.isArray(baseTeam) ? baseTeam.filter((member: any) => {
    const personnelName = member.personnel?.name || '';
    const roleName = member.role?.name || '';
    const matchesFilter = personnelName.toLowerCase().includes(filterTeam.toLowerCase()) ||
                         roleName.toLowerCase().includes(filterTeam.toLowerCase());

    if (!matchesFilter && filterTeam) {
      console.log(`🔍 Filtered out: ${personnelName} - ${roleName}`);
    }

    return matchesFilter;
  }) : [];

  // Log del equipo filtrado
  console.log('🔍 Filtered team:', filteredTeam.length, 'members');
  console.log('🔍 Filter text:', filterTeam);

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
    console.log('⚠️ No base team found or invalid data:', { baseTeam, isArray: Array.isArray(baseTeam), length: baseTeam?.length });

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
          <div className="bg-gray-100 p-4 rounded-lg mb-4 text-left">
            <p className="text-sm text-gray-600">
              <strong>Debug info:</strong><br/>
              ProjectId: {projectId}<br/>
              BaseTeam type: {typeof baseTeam}<br/>
              BaseTeam length: {baseTeam?.length || 'N/A'}<br/>
              Loading: {loadingTeam ? 'Yes' : 'No'}
            </p>
          </div>
          <Button
            onClick={() => {
              console.log('🔄 Attempting to copy quotation team...');
              apiRequest(`/api/projects/${projectId}/copy-quotation-team`, "POST")
                .then((result) => {
                  console.log('✅ Copy quotation team success:', result);
                  queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/base-team`] });
                  toast({
                    title: "🎉 Equipo configurado",
                    description: "El equipo de la cotización ha sido copiado al proyecto"
                  });
                })
                .catch((error) => {
                  console.error('❌ Copy quotation team error:', error);
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
      {/* Header con navegación mejorada */}
      <div className="relative bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <motion.div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                  currentStep === 'period' || currentQuickEntryId 
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white" 
                    : "bg-white text-gray-400 border-2 border-gray-200"
                )}
                whileHover={{ scale: 1.05 }}
              >
                {currentQuickEntryId ? <CheckCircle2 className="w-5 h-5" /> : "1"}
              </motion.div>
              <div>
                <span className={cn(
                  "font-semibold transition-colors",
                  currentStep === 'period' || currentQuickEntryId ? "text-gray-900" : "text-gray-500"
                )}>
                  Configurar Período
                </span>
                <p className="text-sm text-gray-600">Define las fechas y nombre del período</p>
              </div>
            </div>
          </div>

          <ArrowRight className="w-5 h-5 text-gray-400" />

          <div className="flex items-center space-x-3">
            <motion.div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                currentStep === 'team' 
                  ? "bg-gradient-to-r from-green-500 to-blue-600 text-white" 
                  : "bg-white text-gray-400 border-2 border-gray-200"
              )}
              whileHover={{ scale: 1.05 }}
            >
              {currentStep === 'team' ? <Users className="w-5 h-5" /> : "2"}
            </motion.div>
            <div>
              <span className={cn(
                "font-semibold transition-colors",
                currentStep === 'team' ? "text-gray-900" : "text-gray-500"
              )}>
                Registrar Horas
              </span>
              <p className="text-sm text-gray-600">Configura las horas del equipo</p>
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
            initial={{ width: currentStep === 'period' ? '0%' : '50%' }}
            animate={{ width: currentStep === 'period' ? '50%' : '100%' }}
            transition={{ duration: 0.5 }}
          />
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
            <Card className="border-0 shadow-2xl bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <CalendarIcon className="h-6 w-6" />
                  </div>
                  Registro Rápido de Horas por Período
                </CardTitle>
                <p className="text-blue-100 mt-2">Define el período de tiempo para registrar las horas del equipo</p>
              </div>
              <CardContent className="p-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreateQuickEntry)} className="space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col space-y-3">
                            <FormLabel className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                              <PlayCircle className="w-4 h-4 text-green-600" />
                              Fecha de Inicio
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-4 text-left font-medium h-12 border-2 transition-all duration-200 bg-gray-50 hover:bg-white",
                                      !field.value && "text-muted-foreground",
                                      "hover:border-blue-300 focus:border-blue-500 focus:bg-white"
                                    )}
                                  >
                                    {field.value ? (
                                      <div className="flex items-center gap-1">
                                        <CalendarIcon className="w-3 h-3 text-blue-600" />
                                        <span className="text-sm">{format(new Date(field.value), "dd/MM/yyyy", { locale: es })}</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <CalendarIcon className="w-3 h-3 text-gray-400" />
                                        <span className="text-sm">Seleccionar fecha</span>
                                      </div>
                                    )}
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
                          <FormItem className="flex flex-col space-y-3">
                            <FormLabel className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                              <StopCircle className="w-4 h-4 text-red-600" />
                              Fecha de Fin
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-4 text-left font-medium h-12 border-2 transition-all duration-200 bg-gray-50 hover:bg-white",
                                      !field.value && "text-muted-foreground",
                                      "hover:border-blue-300 focus:border-blue-500 focus:bg-white"
                                    )}
                                  >
                                    {field.value ? (
                                      <div className="flex items-center gap-1">
                                        <CalendarIcon className="w-3 h-3 text-blue-600" />
                                        <span className="text-sm">{format(new Date(field.value), "dd/MM/yyyy", { locale: es })}</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <CalendarIcon className="w-3 h-3 text-gray-400" />
                                        <span className="text-sm">Seleccionar fecha</span>
                                      </div>
                                    )}
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
                        <FormItem className="space-y-3">
                          <FormLabel className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-purple-600" />
                            Nombre del Período
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ej: Enero 2025, Primera quincena marzo" 
                              className="h-12 border-2 hover:border-blue-300 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white text-base font-medium"
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
                        <FormItem className="space-y-3">
                          <FormLabel className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-gray-600" />
                            Notas Adicionales (opcional)
                          </FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Agrega cualquier información relevante sobre este período..." 
                              className="border-2 hover:border-blue-300 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white resize-none text-base"
                              rows={4}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-4 pt-6 border-t border-gray-100">
                      <Button 
                        type="submit" 
                        disabled={createQuickEntry.isPending}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        {createQuickEntry.isPending ? (
                          <>
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"
                            />
                            Creando período...
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-5 h-5 mr-3" />
                            Continuar al Registro de Horas
                          </>
                        )}
                      </Button>
                      {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} className="h-14 px-6 border-2">
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
            <Card className="border-0 shadow-2xl bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <Users className="h-6 w-6" />
                      </div>
                      Registro de Horas del Equipo
                    </CardTitle>
                    <p className="text-green-100 mt-2">Configura las horas trabajadas para cada miembro del equipo</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-green-100 mb-1">Progreso del equipo</div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-3 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-white rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${getProgressPercentage()}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <span className="text-xl font-bold">{Math.round(getProgressPercentage())}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-8">
                {/* Controles de vista y filtros */}
                <div className="flex items-center justify-between mb-8 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-gray-500" />
                      <Input
                        placeholder="Buscar miembro del equipo..."
                        value={filterTeam}
                        onChange={(e) => setFilterTeam(e.target.value)}
                        className="w-64 h-10 border-2 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={viewMode === 'compact' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('compact')}
                        className="h-10"
                      >
                        <Minimize2 className="w-4 h-4 mr-2" />
                        Compacto
                      </Button>
                      <Button
                        variant={viewMode === 'detailed' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('detailed')}
                        className="h-10"
                      >
                        <Maximize2 className="w-4 h-4 mr-2" />
                        Detallado
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      <Users className="w-4 h-4 mr-1" />
                      {filteredTeam.length} miembros
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      {Object.values(teamHours).filter(data => data.hours > 0).length} con horas
                    </Badge>
                  </div>
                </div>

                <div className="space-y-6">
                  {filteredTeam.map((member: any) => (
                    <motion.div 
                      key={member.personnelId} 
                      className="relative p-6 bg-gradient-to-r from-gray-50 to-white rounded-2xl border-2 border-gray-100 hover:border-blue-200 transition-all duration-300 hover:shadow-lg group"
                      whileHover={{ y: -2 }}
                      layout
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                              {member.personnel?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </div>
                            <AnimatePresence>
                              {optimisticUpdates[member.personnelId] && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0 }}
                                  className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                                >
                                  <CheckCircle2 className="w-5 h-5 text-white" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{member.personnel?.name}</h3>
                            <p className="text-gray-600 font-medium">{member.role?.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                <DollarSign className="w-3 h-3 mr-1" />
                                ${member.hourlyRate}/hora
                              </Badge>
                              {teamHours[member.personnelId]?.hours > 0 && (
                                <Badge variant="outline" className="text-xs text-green-700 border-green-200 bg-green-50">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {teamHours[member.personnelId]?.hours}h registradas
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right"><motion.div 
                            className="text-3xl font-bold text-green-600"
                            key={teamHours[member.personnelId]?.hours || 0}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            ${((teamHours[member.personnelId]?.hours || 0) * (teamHours[member.personnelId]?.customRate || member.hourlyRate)).toLocaleString()}
                          </motion.div>
                          <p className="text-sm text-gray-500 font-medium">costo total</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 items-end">
                        <div className="col-span-2">
                          <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            Horas
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            max="500"
                            step="0.5"
                            placeholder="0"
                            value={teamHours[member.personnelId]?.hours || ''}
                            onChange={(e) => handleUpdateTeamHours(
                              member.personnelId, 
                              parseFloat(e.target.value) || 0, 
                              teamHours[member.personnelId]?.description || '',
                              teamHours[member.personnelId]?.customRate
                            )}
                            className="h-12 text-xl font-mono text-center border-2 hover:border-blue-300 focus:border-blue-500 transition-all duration-200 bg-white"
                          />
                        </div>

                        <div className="col-span-3">
                          <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
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
                                "h-12 text-lg font-mono text-center pr-12 border-2 transition-all duration-200 bg-white",
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
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
                                title="Restaurar tarifa actual"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {teamHours[member.personnelId]?.customRate ? (
                            <Badge variant="secondary" className="mt-2 text-xs bg-amber-100 text-amber-800 border-amber-200">
                              <Award className="w-3 h-3 mr-1" />
                              Tarifa histórica
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="mt-2 text-xs">
                              Actual: ${member.hourlyRate}
                            </Badge>
                          )}
                        </div>

                        <div className="col-span-7">
                          <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                            Descripción del trabajo realizado
                          </Label>
                          <Input
                            placeholder="Describe las actividades, entregables o tareas realizadas..."
                            value={teamHours[member.personnelId]?.description || ''}
                            onChange={(e) => handleUpdateTeamHours(
                              member.personnelId, 
                              teamHours[member.personnelId]?.hours || 0, 
                              e.target.value,
                              teamHours[member.personnelId]?.customRate
                            )}
                            className="h-12 border-2 hover:border-blue-300 focus:border-blue-500 transition-all duration-200 bg-white text-base"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* Resumen financiero mejorado */}
                  <motion.div 
                    className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white p-8 rounded-3xl shadow-2xl"
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12" />

                    <div className="relative">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-2xl font-bold mb-2">Resumen del Período</h3>
                          <p className="text-white/80">Métricas y totales del registro</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-6 h-6" />
                          <span className="text-sm font-medium">Dashboard</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-6">
                        <div className="text-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Clock className="h-5 w-5 text-blue-300" />
                            <p className="text-xs font-semibold opacity-90 uppercase tracking-wide">Total Horas</p>
                          </div>
                          <motion.p 
                            className="text-4xl font-bold"
                            key={getTotalHours()}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            {getTotalHours()}h
                          </motion.p>
                        </div>

                        <div className="text-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <DollarSign className="h-5 w-5 text-green-300" />
                            <p className="text-xs font-semibold opacity-90 uppercase tracking-wide">Costo Total</p>
                          </div>
                          <motion.p 
                            className="text-4xl font-bold"
                            key={getTotalCost()}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            ${getTotalCost().toLocaleString()}
                          </motion.p>
                        </div>

                        <div className="text-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <TrendingUp className="h-5 w-5 text-purple-300" />
                            <p className="text-xs font-semibold opacity-90 uppercase tracking-wide">Tarifa Promedio</p>
                          </div>
                          <p className="text-3xl font-bold">
                            ${getTotalHours() > 0 ? (getTotalCost() / getTotalHours()).toFixed(2) : '0'}/h
                          </p>
                        </div>

                        <div className="text-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Target className="h-5 w-5 text-orange-300" />
                            <p className="text-xs font-semibold opacity-90 uppercase tracking-wide">Progreso</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-2xl font-bold">{Math.round(getProgressPercentage())}%</p>
                            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-orange-400 to-pink-400 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${getProgressPercentage()}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                            <p className="text-xs opacity-80">
                              {Object.values(teamHours).filter(data => data.hours > 0).length} de {baseTeam.length} miembros
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Botones de acción mejorados */}
                  <div className="flex gap-4 pt-8 border-t border-gray-100">
                    <Button 
                      onClick={handleSaveAllHours}
                      disabled={addTimeDetail.isPending || getTotalHours() === 0}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      {addTimeDetail.isPending ? (
                        <>
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"
                          />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5 mr-3" />
                          Guardar Todas las Horas ({Object.values(teamHours).filter(data => data.hours > 0).length})
                        </>
                      )}
                    </Button>

                    <Button 
                      onClick={handleSubmitForApproval}
                      disabled={submitQuickEntry.isPending || getTotalHours() === 0}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      {submitQuickEntry.isPending ? (
                        <>
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"
                          />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-3" />
                          Enviar para Aprobación
                        </>
                      )}
                    </Button>

                    {onCancel && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={onCancel} 
                        className="h-14 px-6 border-2 hover:bg-gray-50"
                      >
                        <X className="h-5 w-5 mr-2" />
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