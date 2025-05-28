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
import { Search, FileText, CheckCircle, AlertCircle, Clock, Edit, Eye, Trash2, PenLine } from "lucide-react";
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
  const [newStatus, setNewStatus] = useState("");
  const { toast } = useToast();
  
  // Función auxiliar para obtener el nombre del cliente por ID
  const getClientName = (clientId: number) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : `Cliente ID: ${clientId}`;
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
    console.log(`[CLIENT] Iniciando actualización de estado`, { selectedQuote, newStatus });
    
    if (!selectedQuote || !newStatus) {
      console.log(`[CLIENT] Faltan datos:`, { selectedQuote: !!selectedQuote, newStatus });
      return;
    }

    try {
      console.log(`[CLIENT] Enviando PATCH a /api/quotations/${selectedQuote.id}/status con status: ${newStatus}`);
      
      await apiRequest(
        `/api/quotations/${selectedQuote.id}/status`,
        "PATCH",
        { status: newStatus }
      );
      
      console.log(`[CLIENT] Actualización exitosa`);
      
      toast({
        title: "Estado actualizado",
        description: `El estado de la cotización ha sido actualizado a ${translateStatus(newStatus)}.`,
      });
      
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
    setDialogOpen(true);
  };
  
  const openDeleteDialog = (quote: Quotation) => {
    setSelectedQuote(quote);
    setDeleteDialogOpen(true);
  };
  
  const handleDeleteQuotation = async () => {
    if (!selectedQuote) return;
    
    try {
      console.log(`[CLIENT] Intentando eliminar cotización ID ${selectedQuote.id}`);
      
      // Usamos fetch directamente en lugar de apiRequest para tener más control sobre el manejo de respuestas
      const response = await fetch(`/api/quotations/${selectedQuote.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[CLIENT] Respuesta del servidor:`, response.status);
      
      // Intentamos obtener la respuesta JSON, pero manejamos casos donde no sea posible
      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error('[CLIENT] Error al parsear respuesta JSON:', e);
        // Si no hay JSON, creamos un objeto con el estado de la respuesta
        data = { success: response.ok, message: response.statusText };
      }
      
      console.log(`[CLIENT] Datos recibidos:`, data);
      
      // Manejar los diferentes casos según el código HTTP
      if (response.status === 409) {
        console.log(`[CLIENT] La cotización está en uso (409 Conflict)`);
        toast({
          title: "No se puede eliminar",
          description: "Esta cotización está siendo utilizada por proyectos activos y no puede ser eliminada.",
          variant: "destructive",
        });
        return;
      }
      
      if (response.ok && data.success) {
        toast({
          title: "Cotización eliminada",
          description: "La cotización ha sido eliminada correctamente.",
        });
        
        refetch();
        setDeleteDialogOpen(false);
      } else {
        // Si hay un error del servidor o success: false
        toast({
          title: "Error",
          description: data.message || "No se pudo eliminar la cotización.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`[CLIENT] Error al eliminar cotización:`, error);
      toast({
        title: "Error",
        description: "Ocurrió un error al intentar eliminar la cotización.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "in-negotiation":
        return <Edit className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in-negotiation":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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

  return (
    <>
      <div className="page-container">
        <div className="flex-between mb-6">
          <h1 className="heading-page">Gestionar Cotizaciones</h1>
        </div>

        <Card className="standard-card">
          <CardContent className="card-content">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
                <Input
                  placeholder="Buscar por nombre de proyecto..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
                  <div className="w-full md:w-64">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
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

                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader variant="dots" size="md" text="Cargando cotizaciones" />
                  </div>
                ) : filteredQuotations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200">
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Nombre del Proyecto</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Cliente</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Tipo de Proyecto</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Creación</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Estado</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Total</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredQuotations.map((quote) => (
                          <tr key={quote.id} className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-neutral-900">{quote.projectName}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{getClientName(quote.clientId)}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{quote.projectType || "Always On"}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">
                              {new Date(quote.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              {quote.status === 'approved' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-success/10 text-success-dark">
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  {translateStatus(quote.status)}
                                </span>
                              )}
                              {quote.status === 'pending' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-warning/10 text-warning-dark">
                                  <Clock className="h-3.5 w-3.5 mr-1" />
                                  {translateStatus(quote.status)}
                                </span>
                              )}
                              {quote.status === 'rejected' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-error/10 text-error-dark">
                                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                                  {translateStatus(quote.status)}
                                </span>
                              )}
                              {quote.status === 'in-negotiation' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-primary/10 text-primary-dark">
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  {translateStatus(quote.status)}
                                </span>
                              )}
                              {quote.status === 'draft' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                  {translateStatus(quote.status)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                              ${quote.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <Button variant="outline" size="sm" className="hover-lift" onClick={() => openStatusDialog(quote)}>
                                  <Edit className="h-4 w-4 mr-1" />
                                  Estado
                                </Button>
                                {quote.status === 'draft' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="hover-lift bg-blue-50 hover:bg-blue-100 text-blue-700"
                                    onClick={() => navigate(`/optimized-quote?id=${quote.id}`)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Editar
                                  </Button>
                                )}
                                {quote.status === 'in-negotiation' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="hover-lift bg-green-50 hover:bg-green-100 text-green-700"
                                    onClick={() => navigate(`/optimized-quote?clone=${quote.id}`)}
                                  >
                                    <FileText className="h-4 w-4 mr-1" />
                                    Recotizar
                                  </Button>
                                )}
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="hover-lift"
                                  onClick={() => navigate(`/quotation/${quote.id}`)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="hover-lift text-destructive hover:text-destructive-foreground hover:bg-destructive"
                                  onClick={() => openDeleteDialog(quote)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Eliminar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-neutral-500">
                    {searchTerm || statusFilter !== "all"
                      ? "No hay cotizaciones que coincidan con tu búsqueda."
                      : "No se encontraron cotizaciones."}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-heading">Actualizar Estado de Cotización</DialogTitle>
            <DialogDescription>
              Cambia el estado de esta cotización. Actualizarla a "En Negociación" permite realizar ajustes adicionales.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 form-layout">
            <div className="form-group">
              <h4 className="text-label mb-2">Estado Actual:</h4>
              {selectedQuote && selectedQuote.status === 'approved' && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-caption font-medium bg-success/10 text-success-dark">
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  {translateStatus(selectedQuote.status)}
                </span>
              )}
              {selectedQuote && selectedQuote.status === 'pending' && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-caption font-medium bg-warning/10 text-warning-dark">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  {translateStatus(selectedQuote.status)}
                </span>
              )}
              {selectedQuote && selectedQuote.status === 'rejected' && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-caption font-medium bg-error/10 text-error-dark">
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  {translateStatus(selectedQuote.status)}
                </span>
              )}
              {selectedQuote && selectedQuote.status === 'in-negotiation' && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-caption font-medium bg-primary/10 text-primary-dark">
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  {translateStatus(selectedQuote.status)}
                </span>
              )}
              {selectedQuote && selectedQuote.status === 'draft' && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-caption font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  {translateStatus(selectedQuote.status)}
                </span>
              )}
            </div>

            <div className="form-group">
              <h4 className="text-label mb-2">Nuevo Estado:</h4>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar nuevo estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobada</SelectItem>
                  <SelectItem value="rejected">Rechazada</SelectItem>
                  <SelectItem value="in-negotiation">En Negociación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="hover-lift" onClick={handleStatusChange}>
              Actualizar Estado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar cotización */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La cotización será eliminada permanentemente.
              {selectedQuote && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p className="font-medium text-sm">Detalles de la cotización:</p>
                  <p className="text-sm mt-1">Proyecto: <span className="font-semibold">{selectedQuote.projectName}</span></p>
                  <p className="text-sm mt-1">ID: <span className="font-semibold">{selectedQuote.id}</span></p>
                  <p className="text-sm mt-1">Estado: <span className="font-semibold">{translateStatus(selectedQuote.status)}</span></p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuotation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
