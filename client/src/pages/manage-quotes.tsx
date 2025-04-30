import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Quotation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, FileText, CheckCircle, AlertCircle, Clock, Edit, Eye } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ManageQuotes() {
  const [, navigate] = useLocation();
  const { data: quotations, isLoading, refetch, error } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
    retry: 3,
    staleTime: 30000,
  });

  // Log para depuración
  console.log("Estado de carga:", { isLoading, error, quotationsLength: quotations?.length });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const { toast } = useToast();

  // Filter quotations based on search term and status
  const filteredQuotations = quotations
    ? quotations.filter((quote) => {
        const matchesSearch = quote.projectName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
    : [];

  const handleStatusChange = async () => {
    if (!selectedQuote || !newStatus) return;

    try {
      await apiRequest(
        "PATCH",
        `/api/quotations/${selectedQuote.id}/status`,
        { status: newStatus }
      );
      
      toast({
        title: "Estado actualizado",
        description: `El estado de la cotización ha sido actualizado a ${translateStatus(newStatus)}.`,
      });
      
      refetch();
      setDialogOpen(false);
    } catch (error) {
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
      'in-negotiation': 'En Negociación'
    };
    return statusMap[status] || status;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-lg font-semibold text-neutral-900">Gestionar Cotizaciones</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Cotizaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    placeholder="Buscar por nombre de proyecto..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-64">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Estados</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="approved">Aprobada</SelectItem>
                      <SelectItem value="rejected">Rechazada</SelectItem>
                      <SelectItem value="in-negotiation">En Negociación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error ? (
                <div className="text-center py-8 text-red-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                  <h3 className="text-lg font-medium mb-2">Error al cargar las cotizaciones</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Hubo un problema al obtener las cotizaciones. Por favor intenta de nuevo.
                  </p>
                  <Button onClick={() => refetch()} variant="outline" size="sm">
                    Reintentar
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader variant="gradient" size="md" text="Cargando cotizaciones" />
                </div>
              ) : filteredQuotations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Nombre del Proyecto</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">ID Cliente</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Tipo de Análisis</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Creación</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Estado</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Total</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotations.map((quote) => (
                        <tr key={quote.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                          <td className="px-4 py-3 text-sm text-neutral-900">{quote.projectName}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">{quote.clientId}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">{quote.analysisType}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">
                            {new Date(quote.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(quote.status)}`}>
                              {getStatusIcon(quote.status)}
                              <span className="ml-1.5">{translateStatus(quote.status)}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                            ${quote.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm" onClick={() => openStatusDialog(quote)}>
                                <Edit className="h-4 w-4 mr-1" />
                                Estado
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate(`/quote/${quote.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Estado de Cotización</DialogTitle>
            <DialogDescription>
              Cambia el estado de esta cotización. Actualizarla a "En Negociación" permite realizar ajustes adicionales.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Estado Actual:</h4>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${selectedQuote ? getStatusClass(selectedQuote.status) : ''}`}>
                {selectedQuote && getStatusIcon(selectedQuote.status)}
                <span className="ml-1.5">
                  {selectedQuote && translateStatus(selectedQuote.status)}
                </span>
              </span>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Nuevo Estado:</h4>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar nuevo estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobada</SelectItem>
                  <SelectItem value="rejected">Rechazada</SelectItem>
                  <SelectItem value="in-negotiation">En Negociación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleStatusChange}>Actualizar Estado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
