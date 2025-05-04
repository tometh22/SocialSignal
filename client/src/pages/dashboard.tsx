import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Link } from "wouter";
import { Quotation } from "@shared/schema";
import { Loader } from "@/components/ui/loader";

export default function Dashboard() {
  const { data: quotations, isLoading } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  // Count quotations by status
  const getStatusCounts = () => {
    if (!quotations) return { pending: 0, approved: 0, rejected: 0, inNegotiation: 0 };
    
    return quotations.reduce(
      (acc, quote) => {
        if (quote.status === "pending") acc.pending += 1;
        if (quote.status === "approved") acc.approved += 1;
        if (quote.status === "rejected") acc.rejected += 1;
        if (quote.status === "in-negotiation") acc.inNegotiation += 1;
        return acc;
      }, 
      { pending: 0, approved: 0, rejected: 0, inNegotiation: 0 }
    );
  };

  const statusCounts = getStatusCounts();

  // Get 5 most recent quotations
  const recentQuotations = quotations 
    ? [...quotations]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    : [];

  // Helper functions to translate status
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
      <div className="flex-1 overflow-y-auto">
        <div className="fade-in px-1">
          <div className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5">
              <h1 className="text-2xl font-bold text-balance text-neutral-900 slide-in">Sistema de Cotización de Escucha Social</h1>
              <Link href="/new-quote">
                <Button 
                  className="mt-4 sm:mt-0 hover-lift shadow-soft hover:shadow-medium transition-all slide-in" 
                  size="default"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Nueva Cotización
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <Card className="glass-card shadow-sm hover-lift scale-in">
                <CardHeader className="pb-2 border-b border-white/10 p-4">
                  <CardTitle className="text-base flex items-center">
                    <span className="bg-yellow-100/50 p-1.5 rounded-full mr-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                    </span>
                    Pendientes
                  </CardTitle>
                  <CardDescription className="text-xs">Cotizaciones en espera de revisión</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-3">
                  <div className="flex items-center">
                    <span className="text-3xl font-bold slide-in">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader variant="dots" size="sm" />
                        </span>
                      ) : statusCounts.pending}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card shadow-sm hover-lift scale-in">
                <CardHeader className="pb-2 border-b border-white/10 p-4">
                  <CardTitle className="text-base flex items-center">
                    <span className="bg-green-100/50 p-1.5 rounded-full mr-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </span>
                    Aprobadas
                  </CardTitle>
                  <CardDescription className="text-xs">Cotizaciones aceptadas por clientes</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-3">
                  <div className="flex items-center">
                    <span className="text-3xl font-bold slide-in">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader variant="dots" size="sm" />
                        </span>
                      ) : statusCounts.approved}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card shadow-sm hover-lift scale-in">
                <CardHeader className="pb-2 border-b border-white/10 p-4">
                  <CardTitle className="text-base flex items-center">
                    <span className="bg-red-100/50 p-1.5 rounded-full mr-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </span>
                    Rechazadas
                  </CardTitle>
                  <CardDescription className="text-xs">Cotizaciones rechazadas por clientes</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-3">
                  <div className="flex items-center">
                    <span className="text-3xl font-bold slide-in">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader variant="dots" size="sm" />
                        </span>
                      ) : statusCounts.rejected}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card shadow-sm hover-lift scale-in">
                <CardHeader className="pb-2 border-b border-white/10 p-4">
                  <CardTitle className="text-base flex items-center">
                    <span className="bg-blue-100/50 p-1.5 rounded-full mr-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                    </span>
                    En Negociación
                  </CardTitle>
                  <CardDescription className="text-xs">Cotizaciones en proceso de negociación</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-3">
                  <div className="flex items-center">
                    <span className="text-3xl font-bold slide-in">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader variant="dots" size="sm" />
                        </span>
                      ) : statusCounts.inNegotiation}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card className="glass-card shadow-sm scale-in">
              <CardHeader className="border-b border-white/10 p-4">
                <CardTitle className="text-base flex items-center">
                  <span className="bg-primary/10 p-1.5 rounded-full mr-2">
                    <FileText className="h-4 w-4 text-primary" />
                  </span>
                  Cotizaciones Recientes
                </CardTitle>
                <CardDescription className="text-xs">Las 5 cotizaciones creadas más recientemente</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="flex justify-center items-center h-32 scale-in">
                    <div className="flex flex-col items-center">
                      <Loader className="h-6 w-6 text-primary" />
                      <span className="text-xs text-neutral-500 mt-2">Cargando datos...</span>
                    </div>
                  </div>
                ) : recentQuotations.length > 0 ? (
                  <div className="overflow-hidden slide-in">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200/40">
                            <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Proyecto</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Cliente</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Tipo</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Fecha</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Estado</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-neutral-500">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentQuotations.map((quote, index) => (
                            <tr 
                              key={quote.id} 
                              className="border-b border-neutral-200/20 hover:bg-white/5 transition-colors"
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                              <td className="px-3 py-2 text-xs text-neutral-900 font-medium">{quote.projectName}</td>
                              <td className="px-3 py-2 text-xs text-neutral-700">Cliente {quote.clientId}</td>
                              <td className="px-3 py-2 text-xs text-neutral-700">{quote.analysisType}</td>
                              <td className="px-3 py-2 text-xs text-neutral-700">
                                {new Date(quote.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2">
                                {quote.status === 'approved' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success">
                                    <CheckCircle className="h-2.5 w-2.5 mr-1" />
                                    {translateStatus(quote.status)}
                                  </span>
                                )}
                                {quote.status === 'pending' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning">
                                    <Clock className="h-2.5 w-2.5 mr-1" />
                                    {translateStatus(quote.status)}
                                  </span>
                                )}
                                {quote.status === 'rejected' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
                                    <AlertCircle className="h-2.5 w-2.5 mr-1" />
                                    {translateStatus(quote.status)}
                                  </span>
                                )}
                                {quote.status === 'in-negotiation' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                                    <FileText className="h-2.5 w-2.5 mr-1" />
                                    {translateStatus(quote.status)}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs font-medium text-neutral-900 text-right">
                                ${quote.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-center items-center h-32 text-center px-4 scale-in">
                    <div className="flex flex-col items-center">
                      <div className="bg-primary/10 p-3 rounded-full mb-3">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-sm font-medium mb-1">No hay cotizaciones</h3>
                      <p className="text-xs text-neutral-500 mb-3">
                        No se encontraron cotizaciones recientes.
                      </p>
                      <Link href="/new-quote">
                        <Button 
                          className="hover-lift shadow-sm" 
                          size="sm"
                          variant="secondary"
                        >
                          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                          Crear Cotización
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
                
                {recentQuotations.length > 0 && (
                  <div className="mt-3 flex justify-end">
                    <Link href="/manage-quotes">
                      <Button 
                        variant="outline" 
                        className="hover-lift shadow-sm"
                        size="sm"
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Ver Todas
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
