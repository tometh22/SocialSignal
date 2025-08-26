import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Quotation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/hooks/use-currency";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, CheckCircle, AlertCircle, Clock, Edit, Eye, Trash2, PenLine, Plus, X, MessageCircle, Filter, Loader2, Building2, Calendar, DollarSign, TrendingUp, Zap, Users, Handshake, Briefcase } from "lucide-react";
import { PageLayout } from "@/components/ui/page-layout";
import { Loader } from "@/components/ui/loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from 'wouter';
import ProjectTeamConfiguration from '@/components/project/project-team-configuration';

// Interfaces para los datos del cliente
interface Client {
  id: number;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string;
}

export default function ManageQuotes() {
  const [, navigate] = useLocation();
  const { formatCurrency: formatCurrencyWithConversion, convertFromUSD } = useCurrency();

  console.log('[QUOTES] 🚀 Inicializando página de gestión de cotizaciones');

  const { data: quotations, isLoading, refetch, error: quotationsError } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"]
  });

  const { data: clients = [], error: clientsError } = useQuery<Client[]>({
    queryKey: ["/api/clients"]
  });

  // Query to check which quotations have negotiation history
  const { data: negotiationData = {} } = useQuery<Record<number, boolean>>({
    queryKey: ["/api/quotations/negotiation-status"],
    enabled: !!quotations && quotations.length > 0,
    queryFn: async () => {
      if (!quotations) return {};
      
      // For each quotation that was approved, check if it has negotiation history
      const negotiationStatus: Record<number, boolean> = {};
      
      const approvedQuotations = quotations.filter(q => q.status === 'approved');
      
      await Promise.all(
        approvedQuotations.map(async (quotation) => {
          try {
            const response = await fetch(`/api/quotations/${quotation.id}/negotiation-history`, {
              credentials: 'include'
            });
            if (response.ok) {
              const history = await response.json();
              negotiationStatus[quotation.id] = history && history.length > 0;
            }
          } catch (error) {
            console.error(`Error fetching negotiation history for quotation ${quotation.id}:`, error);
          }
        })
      );
      
      return negotiationStatus;
    }
  });

  // Query to check which approved quotations already have projects
  const { data: quotationProjects = {} } = useQuery<Record<number, boolean>>({
    queryKey: ["/api/quotations/project-status"],
    enabled: !!quotations && quotations.length > 0,
    queryFn: async () => {
      if (!quotations) return {};
      
      const projectStatus: Record<number, boolean> = {};
      
      const approvedQuotations = quotations.filter(q => q.status === 'approved');
      
      await Promise.all(
        approvedQuotations.map(async (quotation) => {
          try {
            const response = await fetch(`/api/active-projects/quotation/${quotation.id}`, {
              credentials: 'include'
            });
            if (response.ok) {
              const projects = await response.json();
              projectStatus[quotation.id] = projects && projects.length > 0;
            }
          } catch (error) {
            console.error(`Error checking projects for quotation ${quotation.id}:`, error);
          }
        })
      );
      
      return projectStatus;
    }
  });

  // Log success/error after data is loaded
  useEffect(() => {
    if (quotations) {
      console.log(`[QUOTES] ✅ Cotizaciones cargadas exitosamente: ${quotations.length} elementos`);
    }
  }, [quotations]);

  useEffect(() => {
    if (quotationsError) {
      console.error(`[QUOTES] ❌ Error al cargar cotizaciones:`, quotationsError);
    }
  }, [quotationsError]);

  useEffect(() => {
    if (clients.length > 0) {
      console.log(`[QUOTES] ✅ Clientes cargados exitosamente: ${clients.length} elementos`);
    }
  }, [clients]);

  useEffect(() => {
    if (clientsError) {
      console.error(`[QUOTES] ❌ Error al cargar clientes:`, clientsError);
    }
  }, [clientsError]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false);
  const [approvedQuote, setApprovedQuote] = useState<Quotation | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [associatedProjects, setAssociatedProjects] = useState<any[]>([]);
  const [checkingProjects, setCheckingProjects] = useState(false);
  const [deletingQuoteId, setDeletingQuoteId] = useState<number | null>(null);
  const [showTeamConfiguration, setShowTeamConfiguration] = useState(false);
  const [teamConfigurationData, setTeamConfigurationData] = useState<any[]>([]);
  const { toast } = useToast();

  // Función auxiliar para obtener el nombre del cliente por ID
  const getClientName = (clientId: number) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : `Cliente ID: ${clientId}`;
  };

  // Función auxiliar para obtener el cliente completo por ID
  const getClient = (clientId: number) => {
    return clients.find(c => c.id === clientId);
  };

  // Filter quotations based on search term and status
  // Then sort by creation date (most recent first)
  const filteredQuotations = quotations
    ? quotations
        .filter((quote) => {
          const matchesSearch = quote.projectName.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
          return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
          // Sort by createdAt date in descending order (most recent first)
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        })
    : [];

  const handleStatusChange = async () => {
    if (!selectedQuote || !newStatus) {
      console.warn('[QUOTES] Intento de cambio de estado sin cotización o estado seleccionado');
      return;
    }

    console.log(`[QUOTES] Iniciando cambio de estado para cotización ID: ${selectedQuote.id}`);
    console.log(`[QUOTES] Estado anterior: ${selectedQuote.status} → Nuevo estado: ${newStatus}`);

    try {
      const startTime = performance.now();

      await apiRequest(
        `/api/quotations/${selectedQuote.id}/status`,
        "PATCH",
        { status: newStatus }
      );

      const endTime = performance.now();
      console.log(`[QUOTES] ✅ Estado actualizado exitosamente en ${(endTime - startTime).toFixed(2)}ms`);

      toast({
        title: "Estado actualizado",
        description: `El estado de la cotización "${selectedQuote.projectName}" ha sido actualizado a ${translateStatus(newStatus)}.`,
      });

      // Si la cotización fue aprobada, mostrar modal para crear proyecto
      if (newStatus === 'approved') {
        console.log(`[QUOTES] Cotización aprobada, preparando modal de creación de proyecto`);
        
        // Obtener la cotización actualizada con el precio negociado
        try {
          const response = await fetch(`/api/quotations/${selectedQuote.id}`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const updatedQuote = await response.json();
            console.log(`[QUOTES] Cotización actualizada obtenida:`, {
              originalPrice: selectedQuote.totalAmount,
              updatedPrice: updatedQuote.totalAmount
            });
            setApprovedQuote(updatedQuote);
          } else {
            // Si falla, usar la cotización original
            setApprovedQuote(selectedQuote);
          }
        } catch (error) {
          console.error(`[QUOTES] Error obteniendo cotización actualizada:`, error);
          setApprovedQuote(selectedQuote);
        }
        
        setCreateProjectDialogOpen(true);
      }

      refetch();
      setDialogOpen(false);
    } catch (error) {
      console.error(`[QUOTES] ❌ Error en actualización de estado:`, {
        quotationId: selectedQuote.id,
        oldStatus: selectedQuote.status,
        newStatus: newStatus,
        error: error instanceof Error ? error.message : error,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Error al actualizar estado",
        description: `No se pudo actualizar el estado de la cotización "${selectedQuote.projectName}". ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: "destructive",
      });
    }
  };

  const openStatusDialog = (quote: Quotation) => {
    setSelectedQuote(quote);
    setNewStatus(quote.status);
    setTimeout(() => {
      setDialogOpen(true);
    }, 10);
  };

  const openDeleteDialog = async (quote: Quotation) => {
    setSelectedQuote(quote);
    setCheckingProjects(true);

    try {
      const response = await fetch(`/api/active-projects/quotation/${quote.id}`);
      const projects = await response.json();
      setAssociatedProjects(projects || []);
    } catch (error) {
      console.error("Error checking associated projects:", error);
      setAssociatedProjects([]);
    } finally {
      setCheckingProjects(false);
      setDeleteDialogOpen(true);
    }
  };

  const handleCreateProject = async () => {
    if (!approvedQuote) return;

    // First, check if the quotation has only role-based team members
    try {
      const quotationTeamResponse = await fetch(`/api/quotation-team/${approvedQuote.id}`, {
        credentials: 'include'
      });
      
      if (quotationTeamResponse.ok) {
        const quotationTeam = await quotationTeamResponse.json();
        const hasOnlyRoles = quotationTeam.every((member: any) => member.personnelId === null);
        
        if (hasOnlyRoles && quotationTeam.length > 0) {
          // Show team configuration component
          setShowTeamConfiguration(true);
          setCreateProjectDialogOpen(false);
          return;
        }
      }
      
      // If no role-only members or request failed, proceed with normal project creation
      await createProjectWithCurrentTeam();
    } catch (error) {
      console.error('Error checking quotation team:', error);
      // Fallback to normal project creation
      await createProjectWithCurrentTeam();
    }
  };

  const createProjectWithCurrentTeam = async () => {
    if (!approvedQuote) return;

    try {
      const projectData = {
        name: approvedQuote.projectName,
        clientId: approvedQuote.clientId,
        quotationId: approvedQuote.id,
        description: `Proyecto basado en cotización aprobada: ${approvedQuote.projectName}`,
        budget: approvedQuote.totalAmount,
        status: 'active',
        startDate: new Date().toISOString().split('T')[0],
        estimatedHours: 0
      };

      const createdProject = await apiRequest('/api/active-projects', 'POST', projectData);

      // Copiar automáticamente el equipo de la cotización al proyecto
      try {
        await apiRequest(`/api/projects/${createdProject.id}/copy-quotation-team`, 'POST');
        console.log('✅ Equipo copiado automáticamente al proyecto desde la cotización');
      } catch (teamError) {
        console.warn('⚠️ Error al copiar equipo de la cotización:', teamError);
        // No fallar la creación del proyecto si falla la copia del equipo
      }

      toast({
        title: "Proyecto creado exitosamente",
        description: `El proyecto "${approvedQuote.projectName}" ha sido creado con su equipo asignado y está listo para comenzar.`,
      });

      setCreateProjectDialogOpen(false);
      setApprovedQuote(null);
      navigate(`/projects/${createdProject.id}`);
    } catch (error) {
      console.error('Error al crear proyecto:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el proyecto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleTeamConfigurationComplete = async (teamConfiguration: any[]) => {
    if (!approvedQuote) return;

    try {
      // First, create the project
      const projectData = {
        name: approvedQuote.projectName,
        clientId: approvedQuote.clientId,
        quotationId: approvedQuote.id,
        description: `Proyecto basado en cotización aprobada: ${approvedQuote.projectName}`,
        budget: approvedQuote.totalAmount,
        status: 'active',
        startDate: new Date().toISOString().split('T')[0],
        estimatedHours: 0
      };

      const createdProject = await apiRequest('/api/active-projects', 'POST', projectData);

      // Update quotation team members with the configured personnel
      for (const config of teamConfiguration) {
        await apiRequest(`/api/quotation-team/${approvedQuote.id}/assign-personnel`, 'PATCH', {
          roleId: config.roleId,
          personnelId: config.personnelId,
          hours: config.hours,
          rate: config.rate
        });
      }

      // Copy the updated team to the project
      await apiRequest(`/api/projects/${createdProject.id}/copy-quotation-team`, 'POST');

      toast({
        title: "Proyecto creado exitosamente",
        description: `El proyecto "${approvedQuote.projectName}" ha sido creado con el equipo configurado y está listo para comenzar.`,
      });

      setShowTeamConfiguration(false);
      setApprovedQuote(null);
      navigate(`/projects/${createdProject.id}`);
    } catch (error) {
      console.error('Error al crear proyecto con configuración de equipo:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el proyecto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleTeamConfigurationCancel = () => {
    setShowTeamConfiguration(false);
    setCreateProjectDialogOpen(true);
  };

  const handleSkipProjectCreation = () => {
    setCreateProjectDialogOpen(false);
    setApprovedQuote(null);

    toast({
      title: "Cotización aprobada",
      description: "La cotización ha sido aprobada. Puedes crear el proyecto más tarde desde la sección de proyectos.",
    });
  };

  const handleDeleteQuotation = async () => {
    if (!selectedQuote) {
      console.warn('[QUOTES] Intento de eliminación sin cotización seleccionada');
      return;
    }

    console.log(`[QUOTES] 🗑️ Iniciando eliminación de cotización:`, {
      id: selectedQuote.id,
      projectName: selectedQuote.projectName,
      status: selectedQuote.status,
      clientId: selectedQuote.clientId,
      timestamp: new Date().toISOString()
    });

    try {
      setDeletingQuoteId(selectedQuote.id);
      const startTime = performance.now();

      const response = await fetch(`/api/quotations/${selectedQuote.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const endTime = performance.now();
      console.log(`[QUOTES] Respuesta del servidor recibida en ${(endTime - startTime).toFixed(2)}ms`);

      let data;
      try {
        data = await response.json();
        console.log(`[QUOTES] Datos de respuesta parseados:`, data);
      } catch (e) {
        console.error('[QUOTES] ❌ Error al parsear respuesta JSON:', e);
        data = { success: response.ok, message: response.statusText };
      }

      if (response.status === 409) {
        console.warn(`[QUOTES] ⚠️ Conflicto al eliminar cotización - Proyectos asociados detectados`);
        setDeletingQuoteId(null);
        toast({
          title: "No se puede eliminar",
          description: "Esta cotización está siendo utilizada por proyectos activos y no puede ser eliminada.",
          variant: "destructive",
        });
        return;
      }

      if (response.ok && data.success) {
        console.log(`[QUOTES] ✅ Cotización eliminada exitosamente: ${selectedQuote.projectName}`);

        setTimeout(() => {
          toast({
            title: "Cotización eliminada",
            description: `La cotización "${selectedQuote.projectName}" ha sido eliminada correctamente.`,
          });

          refetch();
          setDeleteDialogOpen(false);
          setDeletingQuoteId(null);
        }, 800);
      } else {
        console.error(`[QUOTES] ❌ Error en eliminación:`, {
          status: response.status,
          statusText: response.statusText,
          data: data,
          quotationId: selectedQuote.id
        });

        setDeletingQuoteId(null);
        toast({
          title: "Error al eliminar",
          description: data.message || `No se pudo eliminar la cotización "${selectedQuote.projectName}".`,
          variant: "destructive",
        });
      }
    } catch (error) {
      setDeletingQuoteId(null);
      console.error(`[QUOTES] ❌ Error crítico al eliminar cotización:`, {
        quotationId: selectedQuote.id,
        quotationName: selectedQuote.projectName,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Error crítico",
        description: `Ocurrió un error inesperado al intentar eliminar la cotización "${selectedQuote.projectName}". ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'approved': {
        variant: 'default' as const,
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
        icon: CheckCircle,
        label: 'Aprobada'
      },
      'pending': {
        variant: 'secondary' as const,
        className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
        icon: Clock,
        label: 'Pendiente'
      },
      'rejected': {
        variant: 'destructive' as const,
        className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
        icon: X,
        label: 'Rechazada'
      },
      'in-negotiation': {
        variant: 'outline' as const,
        className: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
        icon: MessageCircle,
        label: 'En Negociación'
      },
      'draft': {
        variant: 'outline' as const,
        className: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
        icon: Edit,
        label: 'Borrador'
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge 
        variant={config.variant} 
        className={`${config.className} inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border whitespace-nowrap`}
      >
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{config.label}</span>
      </Badge>
    );
  };

  const translateStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'Pendiente',
      'approved': 'Aprobada',
      'rejected': 'Rechazada',
      'in-negotiation': 'En Negociación',
      'draft': 'Borrador'
    };
    return statusMap[status] || status;
  };

  const handleEditQuotation = (quotation: Quotation) => {
    console.log('🔧 Editando cotización:', quotation.id, quotation.projectName);
    navigate(`/optimized-quote/${quotation.id}`);
  };

  // Calculate statistics
  const stats = {
    total: filteredQuotations.length,
    approved: filteredQuotations.filter(q => q.status === 'approved').length,
    pending: filteredQuotations.filter(q => q.status === 'pending').length,
    rejected: filteredQuotations.filter(q => q.status === 'rejected').length,
    inNegotiation: filteredQuotations.filter(q => q.status === 'in-negotiation').length,
    totalValue: filteredQuotations.reduce((sum, q) => sum + q.totalAmount, 0),
    conversionRate: filteredQuotations.length > 0 
      ? (filteredQuotations.filter(q => q.status === 'approved').length / filteredQuotations.length) * 100 
      : 0,
    rejectionRate: filteredQuotations.length > 0 
      ? (filteredQuotations.filter(q => q.status === 'rejected').length / filteredQuotations.length) * 100 
      : 0,
  };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'approved':
                return 'success';
            case 'pending':
                return 'secondary';
            case 'rejected':
                return 'destructive';
            default:
                return 'default';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'approved':
                return 'Aprobada';
            case 'pending':
                return 'Pendiente';
            case 'rejected':
                return 'Rechazada';
            case 'in-negotiation':
                return 'En Negociación';
            case 'draft':
                return 'Borrador';
            default:
                return 'Desconocido';
        }
    };

  return (
    <>
      <PageLayout
      title="Gestión de Cotizaciones"
      description="Administra y da seguimiento a todas las cotizaciones del sistema"
      breadcrumbs={[
        { label: "Gestión de Cotizaciones", current: true }
      ]}
      actions={
        <Button
          onClick={() => navigate("/optimized-quote")}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva Cotización
        </Button>
      }
    >

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Stats Cards - Diseño más compacto y profesional */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Total</p>
                    <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Aprobadas</p>
                    <p className="text-xl font-bold text-emerald-600">{stats.approved}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Pendientes</p>
                    <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Valor Total</p>
                    <p className="text-lg font-bold text-blue-600">
                      ${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Conversión</p>
                    <p className="text-xl font-bold text-green-600">{stats.conversionRate.toFixed(1)}%</p>
                    <p className="text-[10px] text-gray-400">Aprobadas/Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <X className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Rechazos</p>
                    <p className="text-xl font-bold text-red-600">{stats.rejectionRate.toFixed(1)}%</p>
                    <p className="text-[10px] text-gray-400">Rechazadas/Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters mejorados */}
          <Card className="bg-white shadow-lg border-0 mb-6">
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    placeholder="Buscar por nombre de proyecto..."
                    className="pl-12 h-11 border-gray-200 rounded-lg bg-gray-50 focus:bg-white transition-colors text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-56">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11 border-gray-200 rounded-lg bg-gray-50 focus:bg-white text-sm">
                      <Filter className="h-4 w-4 mr-2 text-gray-400" />
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Estados</SelectItem>
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="approved">Aprobada</SelectItem>
                      <SelectItem value="rejected">Rechazada</SelectItem>
                      <SelectItem value="in-negotiation">En Negociación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Card */}
          <Card className="bg-white shadow-lg border-0 rounded-xl overflow-hidden mb-8">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 py-4">
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
                <Users className="h-5 w-5 mr-2 text-slate-600" />
                Lista de Cotizaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader variant="dots" size="lg" text="Cargando cotizaciones..." />
                </div>
              ) : filteredQuotations.length > 0 ? (

                <div className="grid grid-cols-1 gap-4 p-6">
                  {filteredQuotations.map((quote, index) => {
                    const client = getClient(quote.clientId);
                    const createdDate = new Date(quote.createdAt).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });

                    const clientInitials = client?.name
                      ?.split(' ')
                      .map(word => word[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || quote.projectName.slice(0, 2).toUpperCase();

                    // Calculate team members from quote data - for now, set to 0
                    // TODO: Fetch team members from quotationTeamMembers table
                    let teamMembersCount = 0;

                    return (
                      <Card key={quote.id} className="group bg-white border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden relative">
                        {/* Status badges - NEW LOCATION: Top right corner */}
                        <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
                          {getStatusBadge(quote.status)}
                          {negotiationData[quote.id] && quote.status === 'approved' && (
                            <Badge 
                              variant="outline" 
                              className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-medium px-3 py-1 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Handshake className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>Negociada</span>
                            </Badge>
                          )}
                          {quote.status === 'approved' && quotationProjects[quote.id] && (
                            <Badge 
                              variant="outline" 
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium px-3 py-1 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>Proyecto Activo</span>
                            </Badge>
                          )}
                        </div>

                        <div className="flex">
                          {/* Status color indicator */}
                          <div className={`w-1.5 ${
                            quote.status === 'approved' ? 'bg-gradient-to-b from-emerald-500 to-emerald-600' :
                            quote.status === 'pending' ? 'bg-gradient-to-b from-amber-500 to-amber-600' :
                            quote.status === 'in-negotiation' ? 'bg-gradient-to-b from-purple-500 to-purple-600' :
                            quote.status === 'rejected' ? 'bg-gradient-to-b from-red-500 to-red-600' :
                            'bg-gradient-to-b from-gray-400 to-gray-500'
                          }`} />
                          
                          <CardContent className="flex-1 p-5">
                            <div className="flex items-start justify-between gap-4">
                              {/* Main content area */}
                              <div className="flex items-start gap-4 flex-1">
                                {/* Client Logo */}
                                <div className="flex-shrink-0">
                                  {client?.logoUrl ? (
                                    <div className="w-14 h-14 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                                      <img 
                                        src={client.logoUrl} 
                                        alt={`${client.name} logo`} 
                                        className="w-full h-full object-contain p-1"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          const nextElement = e.currentTarget.nextElementSibling;
                                          if (nextElement && nextElement instanceof HTMLElement) {
                                            nextElement.style.display = 'flex';
                                          }
                                        }}
                                      />
                                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 hidden items-center justify-center">
                                        <span className="text-white font-bold text-base">
                                          {clientInitials}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                                      <span className="text-white font-bold text-base">
                                        {clientInitials}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Project Details */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <h3 className="font-bold text-base text-gray-900 line-clamp-1 mb-1 group-hover:text-blue-600 transition-colors">
                                        {quote.projectName}
                                      </h3>
                                      <p className="text-sm text-gray-600">
                                        {getClientName(quote.clientId)}
                                      </p>
                                    </div>
                                    

                                  </div>

                                  {/* Additional info row */}
                                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3.5 w-3.5" />
                                      {createdDate}
                                    </span>
                                    {quote.projectType && (
                                      <span className="flex items-center gap-1">
                                        <Briefcase className="h-3.5 w-3.5" />
                                        {quote.projectType === 'always-on' ? 'Always-On' : 
                                         quote.projectType === 'monitoring' ? 'Monitoreo' : 'One-Shot'}
                                      </span>
                                    )}
                                    {teamMembersCount > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        {teamMembersCount} miembros
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Value and actions section */}
                              <div className="flex flex-col items-end gap-3">
                                <div className="text-right">
                                  {/* Price section with better visual hierarchy */}
                                  <div className="mb-3">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                      {quote.projectType === 'always-on' ? 'Precio Mensual' : 'Precio Total'}
                                    </p>
                                    <p className="text-2xl font-bold text-gray-900">
                                      {(() => {
                                        // Mostrar cotización en su moneda original
                                        const currency = quote.quotationCurrency || 'ARS';
                                        const displayAmount = currency === 'ARS' ? quote.totalAmount : convertFromUSD(quote.totalAmount, currency);
                                        return formatCurrencyWithConversion(displayAmount, currency);
                                      })()}
                                    </p>
                                  </div>
                                  
                                  {/* Cost and Markup info with better styling */}
                                  <div className="space-y-2 border-t pt-2">
                                    <div className="flex items-center justify-between gap-8 text-xs">
                                      <span className="text-gray-500">Costo:</span>
                                      <span className="font-medium text-gray-700">
                                        {(() => {
                                          const currency = quote.quotationCurrency || 'ARS';
                                          const displayAmount = currency === 'ARS' ? quote.baseCost : convertFromUSD(quote.baseCost, currency);
                                          return formatCurrencyWithConversion(displayAmount, currency);
                                        })()}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-8 text-xs">
                                      <span className="text-gray-500">Markup:</span>
                                      <span className={`font-bold ${
                                        (() => {
                                          // Calcular el factor real basado en costo base + ajuste de complejidad
                                          const totalBaseCost = quote.baseCost + (quote.complexityAdjustment || 0);
                                          const realFactor = totalBaseCost > 0 ? (quote.totalAmount / totalBaseCost) : 1;
                                          return realFactor >= 2.5 ? 'text-emerald-600' :
                                                 realFactor >= 2.0 ? 'text-blue-600' :
                                                 realFactor >= 1.5 ? 'text-amber-600' :
                                                 'text-red-600';
                                        })()
                                      }`}>
                                        {(() => {
                                          // DEBUG: Verificar qué datos está recibiendo
                                          console.log(`🔍 DEBUG Quote ${quote.id}:`, {
                                            baseCost: quote.baseCost,
                                            complexityAdjustment: quote.complexityAdjustment,
                                            totalAmount: quote.totalAmount
                                          });
                                          // Calcular el factor real basado en costo base + ajuste de complejidad
                                          const totalBaseCost = quote.baseCost + (quote.complexityAdjustment || 0);
                                          const realFactor = totalBaseCost > 0 ? (quote.totalAmount / totalBaseCost) : 1;
                                          const markupPercentage = ((realFactor - 1) * 100).toFixed(0);
                                          return `${markupPercentage}% (${realFactor.toFixed(1)}x)`;
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/quotation/${quote.id}`)}
                                    className="h-8 px-3 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                                    Ver
                                  </Button>
                                  
                                  {quote.status === 'draft' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditQuotation(quote)}
                                      className="h-8 px-3 text-xs text-gray-600 hover:text-amber-600 hover:bg-amber-50"
                                    >
                                      <PenLine className="h-3.5 w-3.5 mr-1.5" />
                                      Editar
                                    </Button>
                                  )}
                                  
                                  {quote.status === 'approved' && !quotationProjects[quote.id] && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => {
                                        setApprovedQuote(quote);
                                        setCreateProjectDialogOpen(true);
                                      }}
                                      className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                                    >
                                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                                      Crear Proyecto
                                    </Button>
                                  )}
                                  
                                  <div className="ml-2 border-l border-gray-200 pl-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openStatusDialog(quote)}
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDeleteDialog(quote)}
                                      disabled={deletingQuoteId === quote.id}
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                                    >
                                      {deletingQuoteId === quote.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                    );
                  })}
                </div>

              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {searchTerm || statusFilter !== "all"
                      ? "No hay cotizaciones que coincidan"
                      : "No hay cotizaciones disponibles"}
                  </h3>
                  <p className="text-slate-600 mb-6">
                    {searchTerm || statusFilter !== "all"
                      ? "Prueba ajustando los filtros de búsqueda."
                      : "Comienza creando tu primera cotización."}
                  </p>
                  {!searchTerm && statusFilter === "all" && (
                    <Button onClick={() => navigate("/optimized-quote")} className="bg-slate-700 hover:bg-slate-800">
                      <Plus className="mr-2 h-4 w-4" />
                      Crear Primera Cotización
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageLayout>

      {/* Dialogs remain the same but with improved styling */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center">
              <Edit className="h-5 w-5 mr-2 text-indigo-600" />
              Actualizar Estado de Cotización
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Cambia el estado de esta cotización. Actualizarla a "En Negociación" permite realizar ajustes adicionales.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Estado Actual:</h4>
              {selectedQuote && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  {getStatusBadge(selectedQuote.status)}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Nuevo Estado:</h4>
              <select 
                value={newStatus || selectedQuote?.status || ""} 
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              >
                <option value="draft">Borrador</option>
                <option value="pending">Pendiente</option>
                <option value="approved">Aprobada</option>
                <option value="rejected">Rechazada</option>
                <option value="in-negotiation">En Negociación</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button 
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700" 
              onClick={handleStatusChange}
            >
              Actualizar Estado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog with improved styling */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-0 shadow-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-lg font-semibold">
              {associatedProjects.length > 0 ? (
                <>
                  <AlertCircle className="h-5 w-5 mr-2 text-amber-600" />
                  No se puede eliminar
                </>
              ) : (
                <>
                  <Trash2 className="h-5 w-5 mr-2 text-red-600" />
                  ¿Confirmar eliminación?
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              {checkingProjects ? (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  <span>Verificando proyectos asociados...</span>
                </div>
              ) : associatedProjects.length > 0 ? (
                <div className="space-y-4">
                  <p>
                    Esta cotización no puede ser eliminada porque tiene {associatedProjects.length} proyecto(s) activo(s) asociado(s):
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    {associatedProjects.map((project) => (
                      <div key={project.id} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <span className="font-medium">Proyecto ID {project.id}</span>
                        <span className="text-gray-600">({project.status})</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Para eliminar esta cotización, primero debe completar o eliminar los proyectos asociados.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="mb-4">Esta acción no se puede deshacer. La cotización será eliminada permanentemente.</p>
                  {selectedQuote && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <p className="font-medium text-sm mb-2">Detalles de la cotización:</p>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>Proyecto: <span className="font-semibold text-gray-900">{selectedQuote.projectName}</span></p>
                        <p>ID: <span className="font-semibold text-gray-900">{selectedQuote.id}</span></p>
                        <p>Estado: {getStatusBadge(selectedQuote.status)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl">
              {associatedProjects.length > 0 ? "Entendido" : "Cancelar"}
            </AlertDialogCancel>
            {associatedProjects.length === 0 && !checkingProjects && (
              <AlertDialogAction
                onClick={handleDeleteQuotation}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Project Dialog with improved styling */}
      <Dialog open={createProjectDialogOpen} onOpenChange={setCreateProjectDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Cotización Aprobada
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              La cotización ha sido aprobada exitosamente. ¿Deseas crear un proyecto basado en esta cotización?
            </DialogDescription>
          </DialogHeader>

          {approvedQuote && (
            <div className="py-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                <h4 className="font-semibold text-emerald-900 mb-4 flex items-center">
                  <Building2 className="h-4 w-4 mr-2" />
                  Detalles del proyecto a crear:
                </h4>
                <div className="space-y-3 text-sm text-emerald-800">
                  <div className="flex justify-between items-center">
                    <span>Nombre del proyecto:</span>
                    <span className="font-medium">{approvedQuote.projectName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Cliente:</span>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const client = getClient(approvedQuote.clientId);
                        return client?.logoUrl ? (
                          <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0">
                            <img 
                              src={client.logoUrl} 
                              alt={`${client.name} logo`} 
                              className="h-full w-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {getClientName(approvedQuote.clientId).charAt(0)}
                          </div>
                        );
                      })()}
                      <span className="font-medium">{getClientName(approvedQuote.clientId)}</span>
                    </div>
                  </div>
                  <div className="border-t border-emerald-200 pt-3 space-y-2">
                    {(() => {
const baseCostTotal = approvedQuote.baseCost + (approvedQuote.complexityAdjustment || 0);
                      const finalAmount = approvedQuote.totalAmount || 0;
                      const marginAmount = finalAmount - baseCostTotal;

                      return (
                        <>
                          <div className="flex justify-between">
                            <span>Costo estimado:</span>
                            <span className="font-mono">${baseCostTotal.toFixed(0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Precio al cliente:</span>
                            <span className="font-bold text-emerald-900 font-mono">${finalAmount.toFixed(0)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Margen de ganancia:</span>
                            <span className="font-medium">
                              ${marginAmount > 0 ? marginAmount.toFixed(0) : '0'}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={handleSkipProjectCreation} className="rounded-xl">
              Crear más tarde
            </Button>
            <Button onClick={handleCreateProject} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Crear Proyecto Ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Configuration Modal */}
      {showTeamConfiguration && approvedQuote && (
        <ProjectTeamConfiguration
          quotationId={approvedQuote.id}
          quotationName={approvedQuote.projectName}
          onConfigurationComplete={handleTeamConfigurationComplete}
          onCancel={handleTeamConfigurationCancel}
        />
      )}
    </>
  );
}