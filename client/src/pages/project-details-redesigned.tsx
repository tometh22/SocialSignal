import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Users,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Settings,
  FileText,
  BarChart3,
  Timer,
  Plus,
  Edit,
  Eye,
  Activity,
  Zap,
  Briefcase,
  MapPin,
  Mail,
  Phone,
  Building,
  Percent,
  CalendarClock,
  Gauge,
  Trash2,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import WeeklyTimeRegister from "@/components/weekly-time-register";

interface ProjectMetric {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color: string;
  bgColor: string;
  change?: number;
}

interface TimeEntry {
  id: number;
  personnelId: number;
  personnelName: string;
  date: string;
  hours: number;
  description?: string;
  roleName?: string;
  hourlyRate?: number;
}

// Component for ProjectTeamSection with enhanced functionality
function ProjectTeamSection({ projectId, timeEntries, project }: { projectId: string; timeEntries: any[]; project: any }) {
  const { toast } = useToast();
  
  const { data: baseTeam = [], isLoading: teamLoading, refetch } = useQuery({
    queryKey: ["/api/projects", projectId, "base-team"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/base-team`);
      if (!response.ok) {
        throw new Error('Failed to fetch team');
      }
      return response.json();
    },
    enabled: !!projectId,
  });

  const copyTeamMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/copy-quotation-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to copy team');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Equipo copiado desde la cotización correctamente",
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo copiar el equipo de la cotización",
        variant: "destructive",
      });
    },
  });

  // Para contratos Always On, filtrar solo horas del mes actual
  const filteredTimeEntries = useMemo(() => {
    const projectData = project as any;
    const isAlwaysOnContract = projectData?.quotation?.projectType === 'fee-mensual';
    
    if (!isAlwaysOnContract) return timeEntries;
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    return timeEntries.filter((entry: any) => {
      const entryDate = new Date(entry.date);
      return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
    });
  }, [timeEntries, project]);

  // Calcular tiempo registrado por miembro
  const getTimeWorkedByMember = (personnelId: number) => {
    return filteredTimeEntries
      .filter((entry: any) => entry.personnelId === personnelId)
      .reduce((total: number, entry: any) => total + (entry.hours || 0), 0);
  };

  const getProgressPercentage = (workedHours: number, estimatedHours: number) => {
    if (estimatedHours === 0) return 0;
    return Math.round((workedHours / estimatedHours) * 100);
  };

  if (teamLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!baseTeam || baseTeam.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No hay equipo asignado a este proyecto</p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => copyTeamMutation.mutate()}
          disabled={copyTeamMutation.isPending}
        >
          {copyTeamMutation.isPending ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              Copiando...
            </>
          ) : (
            <>
              <Users className="h-4 w-4 mr-2" />
              Copiar Equipo de Cotización
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {baseTeam.map((member: any) => {
        const workedHours = getTimeWorkedByMember(member.personnelId);
        const progressPercent = getProgressPercentage(workedHours, member.estimatedHours || 0);
        
        return (
          <div key={member.id} className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
                    {member.personnel?.name?.split(' ').map((n: string) => n[0]).join('') || 'MB'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{member.personnel?.name || 'Miembro del Equipo'}</p>
                  <p className="text-xs text-muted-foreground">{member.role?.name || 'Rol no especificado'}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    {member.estimatedHours || 0}h est.
                  </Badge>
                  <span className="text-sm font-medium">${member.hourlyRate || 0}/h</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {member.isActive ? 'Activo' : 'Inactivo'}
                </p>
              </div>
            </div>
            
            {/* Barra de progreso y tiempo registrado */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Registrado: {workedHours}h de {member.estimatedHours || 0}h
                </span>
                <span className="font-medium text-blue-600">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progressPercent >= 100 ? 'bg-green-500' : 
                    progressPercent >= 75 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
              {workedHours > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Costo real: ${(workedHours * (member.hourlyRate || 0)).toFixed(0)}</span>
                  <span>
                    {progressPercent > 100 ? 
                      `+${(workedHours - (member.estimatedHours || 0)).toFixed(1)}h extra` : 
                      `${((member.estimatedHours || 0) - workedHours).toFixed(1)}h restantes`
                    }
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      <div className="pt-3 border-t space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas Estimadas:</span>
              <span className="font-medium">
                {baseTeam.reduce((sum: number, member: any) => sum + (member.estimatedHours || 0), 0)}h
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Costo Estimado:</span>
              <span className="font-medium">
                ${baseTeam.reduce((sum: number, member: any) => 
                  sum + ((member.estimatedHours || 0) * (member.hourlyRate || 0)), 0
                ).toFixed(0)}
              </span>
            </div>
          </div>
          <div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas Trabajadas:</span>
              <span className="font-medium text-blue-600">
                {baseTeam.reduce((sum: number, member: any) => sum + getTimeWorkedByMember(member.personnelId), 0).toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Costo Real:</span>
              <span className="font-medium text-blue-600">
                ${baseTeam.reduce((sum: number, member: any) => {
                  const workedHours = getTimeWorkedByMember(member.personnelId);
                  return sum + (workedHours * (member.hourlyRate || 0));
                }, 0).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Progreso general del proyecto */}
        <div className="pt-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Progreso General:</span>
            <span className="font-medium">
              {(() => {
                const totalEstimated = baseTeam.reduce((sum: number, member: any) => sum + (member.estimatedHours || 0), 0);
                const totalWorked = baseTeam.reduce((sum: number, member: any) => sum + getTimeWorkedByMember(member.personnelId), 0);
                const percentage = totalEstimated > 0 ? Math.round((totalWorked / totalEstimated) * 100) : 0;
                return `${percentage}%`;
              })()}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                (() => {
                  const totalEstimated = baseTeam.reduce((sum: number, member: any) => sum + (member.estimatedHours || 0), 0);
                  const totalWorked = baseTeam.reduce((sum: number, member: any) => sum + getTimeWorkedByMember(member.personnelId), 0);
                  const percentage = totalEstimated > 0 ? Math.round((totalWorked / totalEstimated) * 100) : 0;
                  return percentage >= 100 ? 'bg-green-500' : 
                         percentage >= 75 ? 'bg-yellow-500' : 'bg-blue-500';
                })()
              }`}
              style={{ 
                width: `${Math.min((() => {
                  const totalEstimated = baseTeam.reduce((sum: number, member: any) => sum + (member.estimatedHours || 0), 0);
                  const totalWorked = baseTeam.reduce((sum: number, member: any) => sum + getTimeWorkedByMember(member.personnelId), 0);
                  return totalEstimated > 0 ? Math.round((totalWorked / totalEstimated) * 100) : 0;
                })(), 100)}%` 
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailsRedesigned() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);

  // Datos del proyecto
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(project as any)?.clientId}`],
    enabled: !!(project as any)?.clientId,
  });

  // Debug: Log client data to verify logoUrl is present
  console.log('Client data:', client);

  const { data: timeEntries = [] } = useQuery({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: !!projectId,
  });

  const { data: baseTeam = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId,
  });

  // Cálculos principales
  const metrics = useMemo(() => {
    if (!project || !Array.isArray(timeEntries)) return [];

    const projectData = project as any;
    const isAlwaysOnContract = projectData.quotation?.projectType === 'fee-mensual';
    
    // Para contratos Always On, calcular solo el mes actual
    let filteredTimeEntries = timeEntries;
    let estimatedHours = 0;
    let budget = 0;
    let periodLabel = "";
    
    if (isAlwaysOnContract) {
      // Filtrar solo entradas del mes actual (julio 2025)
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      
      filteredTimeEntries = timeEntries.filter((entry: TimeEntry) => {
        const entryDate = new Date(entry.date);
        return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
      });
      
      // Para contratos Always On, usar el costo base mensual como referencia
      budget = projectData.quotation?.baseCost || 0; // Costo estimado mensual
      estimatedHours = budget / 12; // Aproximación de horas mensuales
      periodLabel = `${currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
    } else {
      // Para proyectos normales, usar toda la información
      budget = projectData.quotation?.totalAmount || projectData.deliverableBudget || 0;
      estimatedHours = budget / 100; // Aproximación
      periodLabel = "total del proyecto";
    }
    
    const totalHours = filteredTimeEntries.reduce((sum: number, entry: TimeEntry) => sum + (entry.hours || 0), 0);
    const totalCost = filteredTimeEntries.reduce((sum: number, entry: TimeEntry) => 
      sum + ((entry.hours || 0) * (entry.hourlyRate || 100)), 0);
    
    const progressPercentage = estimatedHours > 0 ? (totalHours / estimatedHours) * 100 : 0;
    const costEfficiency = budget > 0 ? ((budget - totalCost) / budget) * 100 : 0;

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'active': return { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' };
        case 'paused': return { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' };
        case 'completed': return { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
        default: return { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' };
      }
    };

    const statusConfig = getStatusColor(projectData.status);

    return [
      {
        label: isAlwaysOnContract ? "Presupuesto Mensual" : "Presupuesto Total",
        value: `$${budget.toLocaleString()}`,
        subtitle: isAlwaysOnContract ? 
          `${periodLabel} - ${costEfficiency > 0 ? 'Ahorro' : 'Sobrecosto'}: ${Math.abs(costEfficiency).toFixed(1)}%` :
          `${costEfficiency > 0 ? 'Ahorro' : 'Sobrecosto'}: ${Math.abs(costEfficiency).toFixed(1)}%`,
        icon: DollarSign,
        color: "text-green-700",
        bgColor: "bg-gradient-to-br from-green-50 to-green-100",
        change: costEfficiency
      },
      {
        label: isAlwaysOnContract ? `Horas ${periodLabel}` : "Horas Registradas",
        value: `${totalHours.toFixed(1)}h`,
        subtitle: totalHours === 0 && isAlwaysOnContract ? 
          "Sin registros este mes" : 
          `de ${estimatedHours.toFixed(0)}h estimadas`,
        icon: Clock,
        color: "text-blue-700",
        bgColor: "bg-gradient-to-br from-blue-50 to-blue-100",
        change: progressPercentage > 100 ? -(progressPercentage - 100) : progressPercentage - 100
      },
      {
        label: "Progreso",
        value: `${progressPercentage.toFixed(1)}%`,
        subtitle: progressPercentage > 100 ? "Excedido" : "En progreso",
        icon: Target,
        color: progressPercentage > 100 ? "text-red-700" : "text-purple-700",
        bgColor: progressPercentage > 100 ? "bg-gradient-to-br from-red-50 to-red-100" : "bg-gradient-to-br from-purple-50 to-purple-100",
        change: progressPercentage - 50
      },
      {
        label: "Estado",
        value: projectData.status === 'active' ? 'Activo' : 
               projectData.status === 'paused' ? 'Pausado' : 
               projectData.status === 'completed' ? 'Completado' : 'Desconocido',
        subtitle: projectData.completionStatus || "Sin actualizar",
        icon: projectData.status === 'active' ? Play : projectData.status === 'paused' ? Pause : CheckCircle2,
        color: statusConfig.color,
        bgColor: statusConfig.bg,
      }
    ];
  }, [project, timeEntries]);

  const recentTimeEntries = useMemo(() => {
    if (!Array.isArray(timeEntries)) return [];
    
    const projectData = project as any;
    const isAlwaysOnContract = projectData?.quotation?.projectType === 'fee-mensual';
    
    let filteredEntries = timeEntries;
    
    // Para contratos Always On, mostrar solo entradas del mes actual
    if (isAlwaysOnContract) {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      
      filteredEntries = timeEntries.filter((entry: TimeEntry) => {
        const entryDate = new Date(entry.date);
        return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
      });
    }
    
    return filteredEntries
      .sort((a: TimeEntry, b: TimeEntry) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [timeEntries, project]);

  const teamStats = useMemo(() => {
    if (!Array.isArray(timeEntries) || !Array.isArray(baseTeam)) return [];
    
    const projectData = project as any;
    const isAlwaysOnContract = projectData?.quotation?.projectType === 'fee-mensual';
    
    let filteredEntries = timeEntries;
    
    // Para contratos Always On, calcular estadísticas solo del mes actual
    if (isAlwaysOnContract) {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      
      filteredEntries = timeEntries.filter((entry: TimeEntry) => {
        const entryDate = new Date(entry.date);
        return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
      });
    }
    
    const memberStats = new Map();
    
    filteredEntries.forEach((entry: TimeEntry) => {
      if (!memberStats.has(entry.personnelId)) {
        memberStats.set(entry.personnelId, {
          id: entry.personnelId,
          name: entry.personnelName,
          hours: 0,
          entries: 0,
          lastActivity: entry.date
        });
      }
      
      const stats = memberStats.get(entry.personnelId);
      stats.hours += entry.hours;
      stats.entries += 1;
      
      if (new Date(entry.date) > new Date(stats.lastActivity)) {
        stats.lastActivity = entry.date;
      }
    });

    return Array.from(memberStats.values())
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  }, [timeEntries, baseTeam, project]);

  // Mutación para eliminar entrada de tiempo
  const deleteTimeEntryMutation = useMutation({
    mutationFn: async (entryId: number) => {
      return apiRequest(`/api/time-entries/${entryId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      toast({
        title: "✅ Registro eliminado",
        description: "El registro se ha eliminado correctamente"
      });
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo eliminar el registro",
        variant: "destructive"
      });
    }
  });

  const handleDeleteTimeEntry = (entryId: number) => {
    setEntryToDelete(entryId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (entryToDelete) {
      deleteTimeEntryMutation.mutate(entryToDelete);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Proyecto no encontrado</h2>
          <p className="text-gray-600 mb-4">El proyecto solicitado no existe o no tienes permisos para verlo.</p>
          <Button onClick={() => setLocation("/active-projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Proyectos
          </Button>
        </div>
      </div>
    );
  }

  const projectData = project as any;
  const clientData = client as any;
  const projectName = projectData?.quotation?.projectName || projectData?.name || "Proyecto sin nombre";
  const clientName = clientData?.name || "Cliente desconocido";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header compacto */}
      <div className="bg-gradient-to-r from-white via-blue-50 to-purple-50 border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          {/* Título del proyecto */}
          <div className="mb-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {projectName}
            </h1>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {/* Botón Proyectos alineado con los otros botones */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/active-projects")}
                className="hover:bg-gray-100 h-8"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Proyectos
              </Button>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setShowQuickRegister(!showQuickRegister);
                    // Cerrar tabs automáticamente cuando se abre el registro
                    if (!showQuickRegister) {
                      setActiveTab("overview");
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 h-8"
                >
                  <Timer className="h-3 w-3 mr-1" />
                  Registrar Tiempo
                </Button>
                
                <Button variant="outline" size="sm" onClick={() => setLocation(`/project-analytics/${projectId}`)} className="h-8">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Analíticas
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                  onClick={() => setLocation(`/project-settings/${projectId}`)}
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Configurar
                </Button>
              </div>
              
              {/* Badges de estado e información del cliente */}
              <div className="flex items-center gap-3">
                <Badge 
                  variant="outline" 
                  className={`${metrics[3]?.color} ${metrics[3]?.bgColor} border-current text-xs py-1`}
                >
                  {metrics[3]?.value}
                </Badge>
                {projectData.isAlwaysOnMacro && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs py-1">
                    Always-On
                  </Badge>
                )}
                
                {/* Logo e información del cliente compacta */}
                <div className="flex items-center gap-2 text-gray-600 bg-white/60 backdrop-blur-sm px-3 py-2 rounded-full border border-gray-200">
                  {clientData?.logoUrl ? (
                    <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
                      <img 
                        src={clientData.logoUrl} 
                        alt={`${clientName} logo`} 
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {clientName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium text-sm leading-tight">{clientName}</span>
                    {clientData?.contactEmail && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-2 w-2 text-gray-400" />
                        <span className="text-xs text-gray-500">{clientData.contactEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Métricas principales compactas */}
          <div className="grid grid-cols-4 gap-3">
            {metrics.map((metric, index) => {
              const IconComponent = metric.icon;
              return (
                <Card key={index} className={`${metric.bgColor} border-0 hover:shadow-md transition-all duration-200`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">{metric.label}</p>
                        <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
                        {metric.subtitle && (
                          <p className="text-xs text-gray-500 mt-0.5">{metric.subtitle}</p>
                        )}
                      </div>
                      <div className={`p-2 rounded-full shadow-md ${metric.color.replace('text-', 'bg-').replace('-700', '-500')}`}>
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    {metric.change !== undefined && (
                      <div className="mt-1">
                        <div className={`flex items-center text-xs ${metric.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <TrendingUp className="h-2 w-2 mr-1" />
                          {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Registro rápido de tiempo */}
      {showQuickRegister && (
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <WeeklyTimeRegister
            projectId={Number(projectId)}
            onSuccess={() => {
              setShowQuickRegister(false);
              queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
              toast({
                title: "Tiempo registrado exitosamente",
                description: "Las horas han sido registradas en el proyecto",
              });
            }}
            onCancel={() => setShowQuickRegister(false)}
          />
        </div>
      )}

      {/* Contenido principal con tabs */}
      <div className="px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="overview" className="flex items-center gap-2 text-sm">
              <Eye className="h-3 w-3" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center gap-2 text-sm">
              <Clock className="h-3 w-3" />
              Tiempo
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2 text-sm">
              <Users className="h-3 w-3" />
              Equipo
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2 text-sm">
              <FileText className="h-3 w-3" />
              Detalles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Grid de 3 columnas para mejor uso del espacio */}
            <div className="grid grid-cols-3 gap-4">
              {/* Progreso del proyecto */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Gauge className="h-4 w-4 text-blue-600" />
                    Progreso del Proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">Avance General</span>
                      <span className="font-bold">{metrics[2]?.value}</span>
                    </div>
                    <Progress value={parseFloat(metrics[2]?.value.replace('%', '') || '0')} className="h-3" />
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Horas trabajadas</span>
                      <span className="font-semibold">{metrics[1]?.value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Presupuesto usado</span>
                      <span className="font-semibold">{metrics[0]?.subtitle}</span>
                    </div>
                  </div>

                  {parseFloat(metrics[2]?.value.replace('%', '') || '0') > 100 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="font-medium text-xs">Proyecto excedido</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actividad reciente */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-green-600" />
                    Actividad Reciente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recentTimeEntries.length > 0 ? (
                      recentTimeEntries.slice(0, 3).map((entry: TimeEntry, index) => (
                        <div key={entry.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {entry.personnelName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-xs">{entry.personnelName}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(entry.date).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-xs">{entry.hours}h</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No hay registros aún</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Información útil del proyecto */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-purple-600" />
                    Información del Proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Tipo de entregable</p>
                    <p className="font-semibold text-sm">{projectData.deliverableType || "No especificado"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Fecha de inicio</p>
                    <p className="font-semibold text-sm">
                      {projectData.startDate ? new Date(projectData.startDate).toLocaleDateString('es-ES') : "No definida"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Fecha estimada de fin</p>
                    <p className="font-semibold text-sm">
                      {projectData.expectedEndDate ? new Date(projectData.expectedEndDate).toLocaleDateString('es-ES') : "No definida"}
                    </p>
                  </div>
                  {projectData.notes && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Notas</p>
                      <p className="text-xs text-gray-800 line-clamp-2">{projectData.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="time" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-blue-600" />
                    Registros de Tiempo
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/active-projects/${projectId}/time-entries`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Todos
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(timeEntries) && timeEntries.length > 0 ? (
                    timeEntries.slice(0, 10).map((entry: TimeEntry) => (
                      <div key={entry.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 group">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {entry.personnelName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{entry.personnelName}</p>
                            <p className="text-sm text-gray-500">{entry.roleName}</p>
                            {entry.description && (
                              <p className="text-xs text-gray-400 mt-1">{entry.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold text-lg">{entry.hours}h</p>
                            <p className="text-sm text-gray-500">
                              {new Date(entry.date).toLocaleDateString('es-ES')}
                            </p>
                            {entry.hourlyRate && (
                              <p className="text-xs text-gray-400">
                                ${(entry.hours * entry.hourlyRate).toFixed(0)}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTimeEntry(entry.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={deleteTimeEntryMutation.isPending}
                          >
                            {deleteTimeEntryMutation.isPending && entryToDelete === entry.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Timer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No hay registros de tiempo</h3>
                      <p className="text-gray-600 mb-4">Comienza registrando las primeras horas de trabajo.</p>
                      <Button onClick={() => setShowQuickRegister(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Registrar Tiempo
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Equipo del Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectTeamSection projectId={projectId!} timeEntries={timeEntries} project={project} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-600" />
                    Información del Proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Tipo</p>
                    <p className="font-semibold">{projectData.deliverableType || "No especificado"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Fecha de inicio</p>
                    <p className="font-semibold">
                      {projectData.startDate ? new Date(projectData.startDate).toLocaleDateString('es-ES') : "No definida"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Fecha estimada de fin</p>
                    <p className="font-semibold">
                      {projectData.expectedEndDate ? new Date(projectData.expectedEndDate).toLocaleDateString('es-ES') : "No definida"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Estado de completitud</p>
                    <p className="font-semibold">{projectData.completionStatus || "Sin actualizar"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gray-600" />
                    Descripción y Notas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projectData.notes ? (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Descripción</p>
                        <p className="text-gray-800 leading-relaxed">{projectData.notes}</p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No hay descripción disponible</p>
                        <Button variant="outline" size="sm" className="mt-2">
                          <Edit className="h-4 w-4 mr-2" />
                          Agregar descripción
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Diálogo de confirmación para eliminar registro */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Eliminar Registro de Tiempo
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este registro de tiempo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setEntryToDelete(null);
              }}
              disabled={deleteTimeEntryMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteTimeEntryMutation.isPending}
            >
              {deleteTimeEntryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

