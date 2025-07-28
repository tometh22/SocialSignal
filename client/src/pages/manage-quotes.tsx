import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Quotation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, CheckCircle, AlertCircle, Clock, Edit, Eye, Trash2, PenLine, Plus, X, MessageCircle, Filter, Loader2, Building2, Calendar, DollarSign, TrendingUp, Zap, Users } from "lucide-react";
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

  console.log('[QUOTES] 🚀 Inicializando página de gestión de cotizaciones');

  const { data: quotations, isLoading, refetch, error: quotationsError } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"]
  });

  const { data: clients = [], error: clientsError } = useQuery<Client[]>({
    queryKey: ["/api/clients"]
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
        setApprovedQuote(selectedQuote);
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
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
        icon: CheckCircle,
        label: 'Aprobada'
      },
      'pending': {
        variant: 'secondary' as const,
        className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
        icon: Clock,
        label: 'Pendiente'
      },
      'rejected': {
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200',
        icon: X,
        label: 'Rechazada'
      },
      'in-negotiation': {
        variant: 'outline' as const,
        className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200',
        icon: MessageCircle,
        label: 'En Negociación'
      },
      'draft': {
        variant: 'outline' as const,
        className: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
        icon: Edit,
        label: 'Borrador'
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`${config.className} inline-flex items-center gap-1 font-medium`}>
        <Icon className="h-3 w-3" />
        {config.label}
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
    totalValue: filteredQuotations.reduce((sum, q) => sum + q.totalAmount, 0),
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
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-6 mt-6">
            <Card className="bg-white shadow-lg border-0 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Cotizaciones</p>
                    <p className="text-2xl font-bold text-gray-900 leading-none">{stats.total}</p>
                  </div>
                  <div className="h-14 w-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <FileText className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg border-0 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Aprobadas</p>
                    <p className="text-2xl font-bold text-emerald-600 leading-none">{stats.approved}</p>
                  </div>
                  <div className="h-14 w-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <CheckCircle className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg border-0 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Pendientes</p>
                    <p className="text-2xl font-bold text-amber-600 leading-none">{stats.pending}</p>
                  </div>
                  <div className="h-14 w-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Clock className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg border-0 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Valor Total</p>
                    <p className="text-2xl font-bold text-blue-600 leading-none">
                      ${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <DollarSign className="h-7 w-7 text-white" />
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

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
                  {filteredQuotations.map((quote, index) => {
                    const client = getClient(quote.clientId);
                    const createdDate = new Date(quote.createdAt).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });

                    return (
                      <Card key={quote.id} className="group relative bg-white border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden">
                        <CardContent className="p-0">
                          {/* Header con gradiente */}
                          <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-4 border-b border-gray-100">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                {client?.logoUrl ? (
                                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden flex-shrink-0">
                                    <img 
                                      src={client.logoUrl} 
                                      alt={`${client.name} logo`} 
                                      className="w-full h-full object-contain p-1"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling.style.display = 'flex';
                                      }}
                                    />
                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl hidden items-center justify-center">
                                      <span className="text-white font-bold text-lg">
                                        {quote.projectName.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                                    <span className="text-white font-bold text-lg">
                                      {quote.projectName.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                                    {quote.projectName}
                                  </h3>
                                  <p className="text-sm text-gray-600 flex items-center">
                                    <Building2 className="h-3 w-3 mr-1 flex-shrink-0" />
                                    <span className="truncate">{getClientName(quote.clientId)}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end">
                                {getStatusBadge(quote.status)}
                              </div>
                            </div>
                          </div>

                          {/* Contenido principal */}
                          <div className="p-4 space-y-4">
                            {/* Información financiera */}
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600">Valor Total</span>
                                <span className="text-xl font-bold text-gray-900">
                                  ${quote.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-gray-500">Costo Base</span>
                                <span className="text-sm text-gray-600">
                                  ${quote.baseCost.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                                </span>
                              </div>
                            </div>

                            {/* Metadatos */}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <div className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                Creada: {createdDate}
                              </div>
                              <div className="flex items-center">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                ID: #{quote.id}
                              </div>
                            </div>

                            {/* Log de actividad reciente */}
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                              <div className="flex items-center mb-2">
                                <Zap className="h-3 w-3 text-blue-600 mr-1" />
                                <span className="text-xs font-medium text-blue-800">Actividad Reciente</span>
                              </div>
                              <div className="text-xs text-blue-700">
                                {quote.status === 'draft' && 'Cotización en borrador, lista para editar'}
                                {quote.status === 'pending' && 'Esperando aprobación del cliente'}
                                {quote.status === 'approved' && 'Aprobada - Lista para crear proyecto'}
                                {quote.status === 'rejected' && 'Rechazada por el cliente'}
                                {quote.status === 'in-negotiation' && 'En proceso de negociación'}
                              </div>
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="bg-gray-50 p-4 border-t border-gray-100">
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openStatusDialog(quote)}
                                className="w-full justify-center text-xs hover:bg-blue-50 hover:border-blue-300"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Estado
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/quotation/${quote.id}`)}
                                className="w-full justify-center text-xs hover:bg-green-50 hover:border-green-300"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Ver
                              </Button>

                              {quote.status === 'draft' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditQuotation(quote)}
                                  className="w-full justify-center text-xs hover:bg-orange-50 hover:border-orange-300"
                                >
                                  <PenLine className="h-3 w-3 mr-1" />
                                  Editar
                                </Button>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeleteDialog(quote)}
                                disabled={deletingQuoteId === quote.id}
                                className="w-full justify-center text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                              >
                                {deletingQuoteId === quote.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Procesando...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Eliminar
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
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
    </>
  );
}