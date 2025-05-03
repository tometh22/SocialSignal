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
  const { data: quotations, isLoading, refetch } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

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
        <h2 className="text-subheading text-neutral-900">Gestionar Cotizaciones</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="container-xl fade-in">
          <div className="section-sm">
            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-heading">Cotizaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6 form-group">
                  <div className="relative flex-grow form-group">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={18} />
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
                          <th className="px-4 py-3 text-left text-label text-neutral-500">ID Cliente</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Tipo de Análisis</th>
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
                            <td className="px-4 py-3 text-sm text-neutral-700">{quote.clientId}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{quote.analysisType}</td>
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
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="hover-lift"
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
            </div>

            <div className="form-group">
              <h4 className="text-label mb-2">Nuevo Estado:</h4>
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
    </div>
  );
}
