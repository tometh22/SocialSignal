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
  const { data: quotations, isLoading, refetch } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

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
  const filteredQuotations = quotations
    ? quotations.filter((quote) => {
        const matchesSearch = quote.projectName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
    : [];

  const handleStatusChange = async () => {
    if (!selectedQuote || !newStatus) {
      return;
    }

    try {
      await apiRequest(
        `/api/quotations/${selectedQuote.id}/status`,
        "PATCH",
        { status: newStatus }
      );

      toast({
        title: "Estado actualizado",
        description: `El estado de la cotización ha sido actualizado a ${translateStatus(newStatus)}.`,
      });

      // Si la cotización fue aprobada, mostrar modal para crear proyecto
      if (newStatus === 'approved') {
        setApprovedQuote(selectedQuote);
        setCreateProjectDialogOpen(true);
      }

      refetch();
      setDialogOpen(false);
    } catch (error) {
      console.error(`[CLIENT] Error en actualización de estado:`, error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la cotización.",
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

      const createdProject = await apiRequest('/api/projects', 'POST', projectData);

      toast({
        title: "Proyecto creado exitosamente",
        description: `El proyecto "${approvedQuote.projectName}" ha sido creado y está listo para comenzar.`,
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
    if (!selectedQuote) return;

    try {
      setDeletingQuoteId(selectedQuote.id);

      const response = await fetch(`/api/quotations/${selectedQuote.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error('[CLIENT] Error al parsear respuesta JSON:', e);
        data = { success: response.ok, message: response.statusText };
      }

      if (response.status === 409) {
        setDeletingQuoteId(null);
        toast({
          title: "No se puede eliminar",
          description: "Esta cotización está siendo utilizada por proyectos activos y no puede ser eliminada.",
          variant: "destructive",
        });
        return;
      }

      if (response.ok && data.success) {
        setTimeout(() => {
          toast({
            title: "Cotización eliminada",
            description: "La cotización ha sido eliminada correctamente.",
          });

          refetch();
          setDeleteDialogOpen(false);
          setDeletingQuoteId(null);
        }, 800);
      } else {
        setDeletingQuoteId(null);
        toast({
          title: "Error",
          description: data.message || "No se pudo eliminar la cotización.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setDeletingQuoteId(null);
      console.error(`[CLIENT] Error al eliminar cotización:`, error);
      toast({
        title: "Error",
        description: "Ocurrió un error al intentar eliminar la cotización.",
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 pb-16">
        {/* Header con fondo blanco */}
        <div className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Breadcrumbs */}
            <nav className="flex items-center space-x-2 text-sm text-slate-600 pt-4 pb-2">
              <span>Dashboard</span>
              <span>/</span>
              <span className="text-slate-900 font-medium">Gestión de Cotizaciones</span>
            </nav>

            {/* Title and Action */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-8 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  Gestión de Cotizaciones
                </h1>
                <p className="text-slate-600 text-lg">
                  Administra y da seguimiento a todas las cotizaciones del sistema
                </p>
              </div>
              <Button 
                onClick={() => navigate("/optimized-quote")}
                className="bg-slate-900 text-white hover:bg-slate-800 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <Plus className="mr-2 h-5 w-5" />
                Nueva Cotización
              </Button>
            </div>
          </div>
        </div>

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
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {filteredQuotations.map((quote, index) => (
                    <Card key={quote.id} className="shadow-md hover:shadow-lg transition-shadow duration-200">
                      <CardContent className="p-4">
                        <div className="flex flex-col">
                          <div className="flex items-center mb-2">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                              <span className="text-blue-600 font-semibold">{quote.projectName.charAt(0).toUpperCase()}</span>
                            </div>
                            <h3 className="text-lg font-semibold">{quote.projectName}</h3>
                          </div>
                          <div className="text-sm text-gray-500 mb-2">
                            Cliente: {getClientName(quote.clientId)}
                          </div>
                          <div className="flex items-center mb-2">
                            Estado: {getStatusBadge(quote.status)}
                          </div>
                          <div className="text-right font-bold text-gray-700">
                            Total: ${quote.totalAmount.toLocaleString()}
                          </div>
                          <div className="flex justify-end mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="mr-2"
                              onClick={() => openStatusDialog(quote)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Estado
                            </Button>
                            {quote.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mr-2"
                                onClick={() => handleEditQuotation(quote)}
                              >
                                <PenLine className="h-4 w-4 mr-1" />
                                Editar
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="mr-2"
                              onClick={() => navigate(`/quotation/${quote.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(quote)}
                              disabled={deletingQuoteId === quote.id}
                            >
                              {deletingQuoteId === quote.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  <span>...</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Eliminar
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
      </div>

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