import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Search, Plus, Edit, Eye, Trash2, CheckCircle, Clock, X, 
  MessageCircle, FileText, AlertCircle 
} from 'lucide-react';
import Loader from '@/components/ui/loader';

interface Quotation {
  id: number;
  clientId: number;
  projectName: string;
  analysisType: string;
  projectType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
  templateId: number | null;
  complexity: string;
  urgency: string;
  profitMargin: number;
  totalAmount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number | null;
}

interface Client {
  id: number;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export default function ManageQuotesFixed() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [newStatus, setNewStatus] = useState('');

  const { data: quotations, isLoading } = useQuery<Quotation[]>({
    queryKey: ['/api/quotations'],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest(`/api/quotations/${id}/status`, {
        method: 'PATCH',
        body: { status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      toast({
        title: "Estado actualizado",
        description: "El estado de la cotización se ha actualizado correctamente.",
      });
      setDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la cotización.",
        variant: "destructive",
      });
    },
  });

  const deleteQuotationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/quotations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar la cotización');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      toast({
        title: "Cotización eliminada",
        description: "La cotización se ha eliminado correctamente.",
      });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la cotización.",
        variant: "destructive",
      });
    },
  });

  const getClientName = (clientId: number) => {
    const client = clients?.find(c => c.id === clientId);
    return client?.name || 'Cliente no encontrado';
  };

  const filteredQuotations = quotations?.filter((quote) => {
    const matchesSearch = quote.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getClientName(quote.clientId).toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== "all") {
      matchesStatus = quote.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  }) || [];

  const openStatusDialog = (quote: Quotation) => {
    setSelectedQuote(quote);
    setNewStatus(quote.status);
    setDialogOpen(true);
  };
  
  const openDeleteDialog = (quote: Quotation) => {
    setSelectedQuote(quote);
    setDeleteDialogOpen(true);
  };
  
  const handleStatusUpdate = () => {
    if (selectedQuote && newStatus) {
      updateStatusMutation.mutate({ id: selectedQuote.id, status: newStatus });
    }
  };

  const handleDeleteQuotation = () => {
    if (selectedQuote) {
      deleteQuotationMutation.mutate(selectedQuote.id);
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
          <h1 className="heading-page">Gestión de Cotizaciones</h1>
          <Button onClick={() => navigate("/optimized-quote")}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Cotización
          </Button>
        </div>

        <Card className="standard-card">
          <CardContent className="card-content">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-grow">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
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
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-label">Nombre del Proyecto</th>
                      <th className="px-4 py-3 text-left text-label">Cliente</th>
                      <th className="px-4 py-3 text-left text-label">Tipo de Proyecto</th>
                      <th className="px-4 py-3 text-left text-label">Creación</th>
                      <th className="px-4 py-3 text-left text-label">Estado</th>
                      <th className="px-4 py-3 text-left text-label">Total</th>
                      <th className="px-4 py-3 text-left text-label">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotations.map((quote) => (
                      <tr key={quote.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-body font-medium">{quote.projectName}</td>
                        <td className="px-4 py-3 text-body">{getClientName(quote.clientId)}</td>
                        <td className="px-4 py-3 text-body">{quote.projectType || "Always On"}</td>
                        <td className="px-4 py-3 text-body">
                          {new Date(quote.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {quote.status === 'approved' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              {translateStatus(quote.status)}
                            </span>
                          )}
                          {quote.status === 'pending' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              {translateStatus(quote.status)}
                            </span>
                          )}
                          {quote.status === 'draft' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              <Edit className="h-3.5 w-3.5 mr-1" />
                              {translateStatus(quote.status)}
                            </span>
                          )}
                          {quote.status === 'rejected' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <X className="h-3.5 w-3.5 mr-1" />
                              {translateStatus(quote.status)}
                            </span>
                          )}
                          {quote.status === 'in-negotiation' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <MessageCircle className="h-3.5 w-3.5 mr-1" />
                              {translateStatus(quote.status)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stat font-medium">
                          ${quote.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" onClick={() => openStatusDialog(quote)}>
                              <Edit className="h-4 w-4 mr-1" />
                              Estado
                            </Button>
                            {quote.status === 'draft' && (
                              <Button 
                                variant="outline" 
                                size="sm"
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
                                onClick={() => navigate(`/optimized-quote?clone=${quote.id}`)}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Recotizar
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate(`/quotation/${quote.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                              onClick={() => openDeleteDialog(quote)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-body text-muted-foreground">No se encontraron cotizaciones que coincidan con los filtros aplicados.</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para cambio de estado */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Estado de Cotización</DialogTitle>
            <DialogDescription>
              Selecciona el nuevo estado para la cotización "{selectedQuote?.projectName}".
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un estado" />
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleStatusUpdate}
              disabled={updateStatusMutation.isPending || !newStatus}
            >
              {updateStatusMutation.isPending ? 'Actualizando...' : 'Actualizar Estado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmación de eliminación */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la cotización "{selectedQuote?.projectName}"? 
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteQuotation}
              disabled={deleteQuotationMutation.isPending}
            >
              {deleteQuotationMutation.isPending ? 'Eliminando...' : 'Eliminar Cotización'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}