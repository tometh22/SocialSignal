import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Plus, ArrowLeft, Settings, Calendar, Users, Edit, Trash2, 
  CheckCircle, X, FileText, Clock, DollarSign, Target
} from 'lucide-react';

// Types and interfaces
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

// Constants
const frequencyOptions = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
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
  
  // State management
  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null);
  const [activeTab, setActiveTab] = useState("templates");
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<{[key: number]: {hours: number, required: boolean}}>({});
  const [showTeamSection, setShowTeamSection] = useState(false);
  const [formData, setFormData] = useState({
    templateName: '',
    deliverableType: '',
    frequency: '',
    estimatedHours: '',
    baseBudget: '',
    description: '',
    autoCreateDaysInAdvance: '7'
  });

  // Queries with proper error handling and faster loading
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'recurring-templates'],
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'project-cycles'],
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['/api/personnel'],
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1
  });

  // Mutations
  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/recurring-templates', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'recurring-templates'] });
      toast({ title: "Plantilla creada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al crear plantilla", variant: "destructive" });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/recurring-templates/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'recurring-templates'] });
      toast({ title: "Plantilla eliminada" });
    }
  });

  // Helper functions
  const calculateTotalCost = () => {
    return Object.entries(selectedTeamMembers).reduce((total, [personnelId, assignment]) => {
      const person = personnel.find((p: any) => p.id === parseInt(personnelId));
      if (!person) return total;
      return total + (assignment.hours * (person.hourlyRate || 50));
    }, 0);
  };

  const resetWizard = () => {
    setShowWizard(false);
    setCurrentStep(1);
    setSelectedTeamMembers({});
    setShowTeamSection(false);
    setFormData({
      templateName: '',
      deliverableType: '',
      frequency: '',
      estimatedHours: '',
      baseBudget: '',
      description: '',
      autoCreateDaysInAdvance: '7'
    });
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleFormDataChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateTemplate = () => {
    const teamMembers = Object.entries(selectedTeamMembers).map(([personnelId, assignment]) => ({
      personnelId: parseInt(personnelId),
      estimatedHours: assignment.hours,
      isRequired: assignment.required
    }));

    const data = {
      parentProjectId: parseInt(projectId!),
      templateName: formData.templateName,
      deliverableType: formData.deliverableType,
      frequency: formData.frequency,
      estimatedHours: Object.values(selectedTeamMembers).reduce((sum, member) => sum + member.hours, 0) || parseFloat(formData.estimatedHours) || undefined,
      baseBudget: calculateTotalCost() || parseFloat(formData.baseBudget) || undefined,
      description: formData.description || undefined,
      autoCreateDaysInAdvance: parseInt(formData.autoCreateDaysInAdvance) || 7,
      teamMembers
    };

    createTemplateMutation.mutate(data);
    resetWizard();
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation(`/active-projects/${projectId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Proyecto
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Automatización del Proyecto</h1>
            <p className="text-muted-foreground">Configurar recurrencia y automatización para este proyecto específico</p>
          </div>
        </div>

        <div className="flex gap-2">
          {!showWizard && (
            <Button onClick={() => setShowWizard(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Configuración Recurrente
            </Button>
          )}
        </div>
      </div>

      {/* Wizard Component */}
      {showWizard && (
        <div className="bg-white border rounded-lg shadow-sm mb-6">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Configurar Automatización Recurrente</h2>
              <Button variant="outline" size="sm" onClick={resetWizard}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center mt-4 space-x-4">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step}
                  </div>
                  {step < 4 && (
                    <div className={`w-16 h-1 mx-2 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-2 text-sm text-gray-600">
              Paso {currentStep} de 4: {
                currentStep === 1 ? 'Información Básica' :
                currentStep === 2 ? 'Configuración de Tiempo' :
                currentStep === 3 ? 'Configuración Avanzada' :
                'Asignación de Equipo'
              }
            </div>
          </div>

          <div className="p-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="templateName">Nombre de Plantilla</Label>
                    <Input 
                      id="templateName"
                      value={formData.templateName}
                      onChange={(e) => handleFormDataChange('templateName', e.target.value)}
                      placeholder="Ej: Reporte Mensual de Análisis"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliverableType">Tipo de Entregable</Label>
                    <Select 
                      value={formData.deliverableType} 
                      onValueChange={(value) => handleFormDataChange('deliverableType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
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
            )}

            {/* Step 2: Timing Configuration */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frecuencia</Label>
                    <Select 
                      value={formData.frequency} 
                      onValueChange={(value) => handleFormDataChange('frequency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar frecuencia" />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencyOptions.map(freq => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedHours">Horas Estimadas</Label>
                    <Input 
                      id="estimatedHours"
                      type="number"
                      step="0.5"
                      value={formData.estimatedHours}
                      onChange={(e) => handleFormDataChange('estimatedHours', e.target.value)}
                      placeholder="40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseBudget">Presupuesto Base</Label>
                    <Input 
                      id="baseBudget"
                      type="number"
                      step="0.01"
                      value={formData.baseBudget}
                      onChange={(e) => handleFormDataChange('baseBudget', e.target.value)}
                      placeholder="5000"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Advanced Configuration */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea 
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleFormDataChange('description', e.target.value)}
                      placeholder="Describe el alcance y objetivos..."
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="autoCreateDaysInAdvance">Días de Anticipación</Label>
                    <Input 
                      id="autoCreateDaysInAdvance"
                      type="number"
                      min="1"
                      max="30"
                      value={formData.autoCreateDaysInAdvance}
                      onChange={(e) => handleFormDataChange('autoCreateDaysInAdvance', e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Recomendado: 7 días</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Team Assignment */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
                  <div>
                    <Label className="font-medium">Asignar Equipo</Label>
                    <p className="text-sm text-gray-600">Opcional: Selecciona miembros del equipo para calcular costos automáticamente</p>
                  </div>
                  <Switch 
                    checked={showTeamSection} 
                    onCheckedChange={setShowTeamSection}
                  />
                </div>
                
                {showTeamSection && (
                  <div className="space-y-3 border rounded-lg p-4 bg-gray-50 max-h-80 overflow-y-auto">
                    {personnel.map((person: any) => (
                      <div key={person.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            className="rounded w-4 h-4 text-blue-600"
                            checked={selectedTeamMembers[person.id] !== undefined}
                            onChange={(e) => handleTeamMemberToggle(person.id, e.target.checked)}
                          />
                          <div>
                            <p className="font-medium text-sm">{person.name}</p>
                            <p className="text-xs text-gray-500">${person.hourlyRate || 50}/hora</p>
                          </div>
                        </div>
                        {selectedTeamMembers[person.id] && (
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              className="w-20 h-8 text-xs"
                              min="0"
                              step="0.5"
                              placeholder="hrs"
                              value={selectedTeamMembers[person.id]?.hours || ''}
                              onChange={(e) => handleHoursChange(person.id, parseFloat(e.target.value) || 0)}
                            />
                            <span className="text-xs font-semibold text-blue-600">
                              ${((selectedTeamMembers[person.id]?.hours || 0) * (person.hourlyRate || 50)).toFixed(0)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {Object.keys(selectedTeamMembers).length > 0 && (
                      <div className="border-t pt-3 mt-4 bg-white rounded p-3">
                        <div className="flex justify-between items-center font-semibold text-sm">
                          <span>Costo Total Estimado:</span>
                          <span className="text-blue-600">${calculateTotalCost().toFixed(0)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between p-6 border-t bg-gray-50">
            <Button 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              Anterior
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetWizard}>
                Cancelar
              </Button>
              {currentStep < 4 ? (
                <Button 
                  onClick={nextStep}
                  disabled={
                    (currentStep === 1 && (!formData.templateName || !formData.deliverableType)) ||
                    (currentStep === 2 && !formData.frequency)
                  }
                >
                  Siguiente
                </Button>
              ) : (
                <Button 
                  onClick={handleCreateTemplate}
                  disabled={createTemplateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createTemplateMutation.isPending ? 'Creando...' : 'Crear Plantilla'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {!showWizard && (
        <div>
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="templates">
                <Settings className="h-4 w-4 mr-2" />
                Configuraciones Recurrentes ({templates.length})
              </TabsTrigger>
              <TabsTrigger value="cycles">
                <Calendar className="h-4 w-4 mr-2" />
                Ciclos Automáticos ({cycles.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="space-y-4">
              <div className="grid gap-4">
                {templatesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay configuraciones recurrentes establecidas
                  </div>
                ) : (
                  templates.map((template: RecurringTemplate) => (
                    <div key={template.id} className="border rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{template.templateName}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                          
                          <div className="flex flex-wrap gap-2 mt-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {template.deliverableType}
                            </span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                              {template.frequency}
                            </span>
                            {template.estimatedHours && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                                {template.estimatedHours}h estimadas
                              </span>
                            )}
                            {template.totalEstimatedCost && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                                ${template.totalEstimatedCost.toFixed(0)} estimado
                              </span>
                            )}
                          </div>

                          {template.teamMembers && template.teamMembers.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <h4 className="text-sm font-medium mb-2">Equipo Asignado:</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {template.teamMembers.map((member) => (
                                  <div key={member.id} className="text-xs bg-gray-50 p-2 rounded">
                                    <span className="font-medium">{member.personnelName}</span>
                                    <span className="text-muted-foreground"> - {member.estimatedHours}h (${member.totalCost})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingTemplate(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                            disabled={deleteTemplateMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="cycles" className="space-y-4">
              <div className="grid gap-4">
                {cyclesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : cycles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay ciclos automáticos generados
                  </div>
                ) : (
                  cycles.map((cycle: ProjectCycle) => (
                    <div key={cycle.id} className="border rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{cycle.cycleName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {cycle.startDate} - {cycle.endDate}
                          </p>
                          <span className={`inline-block px-2 py-1 rounded text-xs mt-2 ${
                            cycle.status === 'completed' ? 'bg-green-100 text-green-800' :
                            cycle.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {cycle.status}
                          </span>
                        </div>
                        {cycle.actualCost && (
                          <div className="text-right">
                            <p className="text-sm font-medium">${cycle.actualCost}</p>
                            {cycle.budgetVariance && (
                              <p className={`text-xs ${cycle.budgetVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {cycle.budgetVariance > 0 ? '+' : ''}${cycle.budgetVariance}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}