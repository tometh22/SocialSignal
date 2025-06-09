import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Clock, Calendar, Users, DollarSign, Play, Pause, Settings, 
  Plus, Edit, Trash2, RotateCcw, CheckCircle, AlertCircle,
  ArrowLeft, CalendarDays, Target, TrendingUp, HelpCircle, FileText, Repeat
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RecurringTemplate {
  id: number;
  parentProjectId: number;
  templateName: string;
  deliverableType: string;
  frequency: string;
  dayOfMonth?: number;
  dayOfWeek?: number;
  estimatedHours?: number;
  baseBudget?: number;
  description?: string;
  isActive: boolean;
  autoCreateDaysInAdvance: number;
  createdAt: string;
  teamMembers?: TemplateTeamMember[];
  totalEstimatedCost?: number;
}

interface TemplateTeamMember {
  id: number;
  templateId: number;
  personnelId: number;
  personnelName: string;
  roleName: string;
  hourlyRate: number;
  estimatedHours: number;
  isRequired: boolean;
  totalCost: number;
}

interface ProjectCycle {
  id: number;
  parentProjectId: number;
  templateId?: number;
  cycleName: string;
  cycleType: string;
  startDate: string;
  endDate: string;
  status: string;
  subprojectId?: number;
  actualCost?: number;
  budgetVariance?: number;
  completedAt?: string;
  createdAt: string;
}

interface Personnel {
  id: number;
  name: string;
  roleId: number;
  hourlyRate: number;
}

const frequencyOptions = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
];

const dayOfWeekOptions = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

const deliverableTypes = [
  { value: 'informe_mensual', label: 'Informe Mensual' },
  { value: 'reporte_semanal', label: 'Reporte Semanal' },
  { value: 'dashboard_actualizado', label: 'Dashboard Actualizado' },
  { value: 'analisis_competencia', label: 'Análisis de Competencia' },
  { value: 'monitoreo_marca', label: 'Monitoreo de Marca' },
];

export default function RecurringTemplatesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null);
  const [activeTab, setActiveTab] = useState("templates");
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<{[key: number]: {hours: number, required: boolean}}>({});
  const [showTeamSection, setShowTeamSection] = useState(false);

  // Queries with proper error handling and faster loading
  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ['/api/projects', projectId, 'recurring-templates'],
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'cycles'],
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['/api/personnel'],
    staleTime: 10 * 60 * 1000, // Cache personnel for 10 minutes
    retry: 1
  });

  // Mutations
  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/recurring-templates`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'recurring-templates'] });
      setIsCreateDialogOpen(false);
      toast({ title: "Plantilla creada exitosamente" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest(`/api/recurring-templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'recurring-templates'] });
      setEditingTemplate(null);
      toast({ title: "Plantilla actualizada exitosamente" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/recurring-templates/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'recurring-templates'] });
      toast({ title: "Plantilla eliminada exitosamente" });
    },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/projects/${projectId}/auto-generate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'cycles'] });
      toast({ title: "Subproyectos generados exitosamente" });
    },
  });

  const completeCycleMutation = useMutation({
    mutationFn: (cycleId: number) => apiRequest(`/api/project-cycles/${cycleId}/complete`, {
      method: 'PATCH',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'cycles'] });
      toast({ title: "Ciclo completado exitosamente" });
    },
  });

  const calculateTotalCost = () => {
    return Object.entries(selectedTeamMembers).reduce((total, [personnelId, assignment]) => {
      const person = personnel.find((p: any) => p.id === parseInt(personnelId));
      if (!person) return total;
      return total + (assignment.hours * (person.hourlyRate || 50));
    }, 0);
  };

  const handleCreateTemplate = (formData: FormData) => {
    const teamMembers = Object.entries(selectedTeamMembers).map(([personnelId, assignment]) => ({
      personnelId: parseInt(personnelId),
      estimatedHours: assignment.hours,
      isRequired: assignment.required
    }));

    const data = {
      parentProjectId: parseInt(projectId!),
      templateName: formData.get('templateName'),
      deliverableType: formData.get('deliverableType'),
      frequency: formData.get('frequency'),
      dayOfMonth: formData.get('dayOfMonth') ? parseInt(formData.get('dayOfMonth') as string) : null,
      dayOfWeek: formData.get('dayOfWeek') ? parseInt(formData.get('dayOfWeek') as string) : null,
      estimatedHours: Object.values(selectedTeamMembers).reduce((sum, member) => sum + member.hours, 0),
      baseBudget: calculateTotalCost(),
      description: formData.get('description'),
      autoCreateDaysInAdvance: parseInt(formData.get('autoCreateDaysInAdvance') as string) || 7,
      teamMembers
    };

    createTemplateMutation.mutate(data);
  };

  const handleTeamMemberToggle = (personnelId: number, isSelected: boolean) => {
    if (isSelected) {
      setSelectedTeamMembers(prev => ({
        ...prev,
        [personnelId]: { hours: 0, required: true }
      }));
    } else {
      setSelectedTeamMembers(prev => {
        const newState = { ...prev };
        delete newState[personnelId];
        return newState;
      });
    }
  };

  const handleHoursChange = (personnelId: number, hours: number) => {
    setSelectedTeamMembers(prev => ({
      ...prev,
      [personnelId]: { ...prev[personnelId], hours }
    }));
  };

  const handleAutoGenerate = (templateId: number) => {
    const today = new Date();
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(today.getMonth() + 3);

    autoGenerateMutation.mutate({
      templateId,
      periodStart: today.toISOString(),
      periodEnd: threeMonthsLater.toISOString(),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-blue-500';
      case 'upcoming': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    return frequencyOptions.find(f => f.value === frequency)?.label || frequency;
  };

  if (templatesLoading || cyclesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => setLocation('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Proyectos
          </Button>
        </div>
        <div className="text-center py-12">Cargando plantillas recurrentes...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Proyectos
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Gestión de Recurrencia</h1>
            <p className="text-muted-foreground">Plantillas y automatización para proyectos Always-On</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Plantilla
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-6">
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  <Repeat className="h-6 w-6 text-blue-600" />
                  Crear Plantilla Recurrente
                </DialogTitle>
                <p className="text-muted-foreground">
                  Configura una plantilla para automatizar la creación de proyectos recurrentes
                </p>
              </DialogHeader>
              
              <TooltipProvider>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateTemplate(new FormData(e.currentTarget));
                }} className="space-y-6">
                  
                  {/* Basic Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">Información Básica</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="templateName" className="text-sm font-medium">Nombre de Plantilla</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Nombre identificativo para esta plantilla. Ejemplo: "Reporte Mensual de Redes Sociales"</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input 
                          id="templateName" 
                          name="templateName" 
                          placeholder="Ej: Reporte Mensual de Análisis"
                          className="h-11"
                          required 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="deliverableType" className="text-sm font-medium">Tipo de Entregable</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Categoría del producto o servicio que se entregará al cliente</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Select name="deliverableType" required>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Seleccionar tipo de entregable" />
                          </SelectTrigger>
                          <SelectContent>
                            {deliverableTypes.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Timing & Budget Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="h-5 w-5 text-green-600" />
                      <h3 className="text-lg font-semibold">Configuración de Tiempo y Presupuesto</h3>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="frequency" className="text-sm font-medium">Frecuencia</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Con qué frecuencia se debe generar automáticamente este proyecto</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Select name="frequency" required>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Seleccionar frecuencia" />
                          </SelectTrigger>
                          <SelectContent>
                            {frequencyOptions.map(freq => (
                              <SelectItem key={freq.value} value={freq.value}>
                                <div className="flex items-center gap-2">
                                  <Repeat className="h-4 w-4" />
                                  {freq.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="estimatedHours" className="text-sm font-medium">Horas Estimadas</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Tiempo estimado para completar este proyecto (se calcula automáticamente si asignas equipo)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="estimatedHours" 
                            name="estimatedHours" 
                            type="number" 
                            step="0.5"
                            placeholder="Ej: 40"
                            className="h-11 pl-10"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="baseBudget" className="text-sm font-medium">Presupuesto Base</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Presupuesto estimado para este proyecto (se calcula automáticamente si asignas equipo)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="baseBudget" 
                            name="baseBudget" 
                            type="number" 
                            step="0.01"
                            placeholder="Ej: 5000"
                            className="h-11 pl-10"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Configuration */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Settings className="h-5 w-5 text-purple-600" />
                      <h3 className="text-lg font-semibold">Configuración Avanzada</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="description" className="text-sm font-medium">Descripción</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Descripción detallada de lo que incluye este proyecto recurrente</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Textarea 
                          id="description" 
                          name="description" 
                          placeholder="Describe el alcance y objetivos del proyecto..."
                          className="min-h-[100px] resize-none"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="autoCreateDaysInAdvance" className="text-sm font-medium">Días de Anticipación</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Cuántos días antes de la fecha objetivo se debe crear automáticamente el proyecto</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="relative">
                          <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="autoCreateDaysInAdvance" 
                            name="autoCreateDaysInAdvance" 
                            type="number" 
                            defaultValue="7"
                            min="1"
                            max="30"
                            className="h-11 pl-10"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Recomendado: 7 días</p>
                      </div>
                    </div>
                  </div>

                  {/* Team Assignment Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="h-5 w-5 text-orange-600" />
                      <h3 className="text-lg font-semibold">Asignación de Equipo</h3>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-orange-50 to-yellow-50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-base font-medium">Activar Asignación de Equipo</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Asigna miembros del equipo con horas específicas para calcular automáticamente el costo real del proyecto</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-sm text-muted-foreground">Selecciona el equipo y las horas estimadas para calcular el costo del proyecto</p>
                      </div>
                      <Switch 
                        checked={showTeamSection} 
                        onCheckedChange={setShowTeamSection}
                      />
                    </div>
                  
                  {showTeamSection && (
                    <div className="space-y-4 border rounded-lg p-4 bg-gray-50 max-h-80 overflow-y-auto">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {personnel.map((person: any) => (
                          <div key={person.id} className="flex items-center justify-between p-2 border rounded bg-white text-sm">
                            <div className="flex items-center space-x-2 flex-1">
                              <input
                                type="checkbox"
                                className="rounded w-4 h-4"
                                checked={selectedTeamMembers[person.id] !== undefined}
                                onChange={(e) => handleTeamMemberToggle(person.id, e.target.checked)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{person.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  ${person.hourlyRate || 50}/h
                                </p>
                              </div>
                            </div>
                            
                            {selectedTeamMembers[person.id] && (
                              <div className="flex items-center space-x-1 ml-2">
                                <Input
                                  type="number"
                                  className="w-16 h-8 text-xs"
                                  min="0"
                                  step="0.5"
                                  placeholder="hrs"
                                  value={selectedTeamMembers[person.id]?.hours || ''}
                                  onChange={(e) => handleHoursChange(person.id, parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-xs font-medium min-w-0 text-right">
                                  ${((selectedTeamMembers[person.id]?.hours || 0) * (person.hourlyRate || 50)).toFixed(0)}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {Object.keys(selectedTeamMembers).length > 0 && (
                        <div className="border-t pt-3 mt-4 bg-white rounded p-3">
                          <div className="flex justify-between items-center font-semibold text-sm">
                            <span>Costo Total Estimado:</span>
                            <span className="text-base text-blue-600">${calculateTotalCost().toFixed(0)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Total de horas: {Object.values(selectedTeamMembers).reduce((sum, member) => sum + member.hours, 0)}h
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button type="button" variant="outline" size="lg" onClick={() => {
                      setIsCreateDialogOpen(false);
                      setSelectedTeamMembers({});
                      setShowTeamSection(false);
                    }}>
                      Cancelar
                    </Button>
                    <Button type="submit" size="lg" disabled={createTemplateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                      {createTemplateMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Creando...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Crear Plantilla
                        </div>
                      )}
                    </Button>
                  </div>
                </form>
              </TooltipProvider>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">
            <Settings className="h-4 w-4 mr-2" />
            Plantillas ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="cycles">
            <CalendarDays className="h-4 w-4 mr-2" />
            Ciclos ({cycles.length})
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay plantillas configuradas</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crea plantillas para automatizar la generación de subproyectos recurrentes
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Plantilla
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {templates.map((template: RecurringTemplate) => (
                <Card key={template.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {template.templateName}
                          <Badge variant={template.isActive ? "default" : "secondary"}>
                            {template.isActive ? "Activa" : "Inactiva"}
                          </Badge>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {deliverableTypes.find(t => t.value === template.deliverableType)?.label}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAutoGenerate(template.id)}
                          disabled={autoGenerateMutation.isPending}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Generar
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{getFrequencyLabel(template.frequency)}</span>
                      </div>
                      {template.estimatedHours && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{template.estimatedHours}h estimadas</span>
                        </div>
                      )}
                      {template.baseBudget && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>${template.baseBudget.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span>{template.autoCreateDaysInAdvance} días anticipación</span>
                      </div>
                    </div>

                    {/* Team Assignment Display */}
                    {template.teamMembers && template.teamMembers.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-muted-foreground">Equipo Asignado</p>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Costo Total: </span>
                            <span className="font-semibold text-blue-600">
                              ${template.totalEstimatedCost?.toFixed(0) || '0'}
                            </span>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          {template.teamMembers.map((member: any) => (
                            <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="font-medium">{member.personnelName}</span>
                                <span className="text-muted-foreground">({member.roleName})</span>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{member.estimatedHours}h</div>
                                <div className="text-xs text-muted-foreground">${member.totalCost}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                        {template.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Cycles Tab */}
        <TabsContent value="cycles" className="space-y-4">
          {cycles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay ciclos programados</h3>
                <p className="text-muted-foreground text-center">
                  Los ciclos aparecerán aquí cuando generes subproyectos desde las plantillas
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {cycles.map((cycle: ProjectCycle) => (
                <Card key={cycle.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {cycle.cycleName}
                          <Badge variant="outline" className={`${getStatusColor(cycle.status)} text-white`}>
                            {cycle.status === 'completed' ? 'Completado' :
                             cycle.status === 'active' ? 'Activo' :
                             cycle.status === 'upcoming' ? 'Próximo' : cycle.status}
                          </Badge>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {getFrequencyLabel(cycle.cycleType)} • {new Date(cycle.startDate).toLocaleDateString()} - {new Date(cycle.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      {cycle.status !== 'completed' && cycle.status !== 'cancelled' && (
                        <Button
                          size="sm"
                          onClick={() => completeCycleMutation.mutate(cycle.id)}
                          disabled={completeCycleMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Completar
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {cycle.actualCost && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>Costo Real: ${cycle.actualCost.toLocaleString()}</span>
                        </div>
                      )}
                      {cycle.budgetVariance && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className={`h-4 w-4 ${cycle.budgetVariance > 0 ? 'text-red-500' : 'text-green-500'}`} />
                          <span className={cycle.budgetVariance > 0 ? 'text-red-600' : 'text-green-600'}>
                            Varianza: {cycle.budgetVariance > 0 ? '+' : ''}${cycle.budgetVariance.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {cycle.completedAt && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Completado: {new Date(cycle.completedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}