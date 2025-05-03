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
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-subheading text-neutral-900">Panel Principal</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="container-xl fade-in">
          <div className="section-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-section">
              <h1 className="text-display text-balance text-neutral-900 slide-in">Sistema de Cotización de Escucha Social</h1>
              <Link href="/new-quote">
                <Button 
                  className="mt-4 sm:mt-0 hover-lift shadow-soft hover:shadow-medium transition-all slide-in" 
                  size="lg"
                >
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Crear Nueva Cotización
                </Button>
              </Link>
            </div>
            
            <div className="card-grid mb-section">
              <Card className="glass-card shadow-medium hover-lift scale-in">
                <CardHeader className="pb-2 border-b border-white/10">
                  <CardTitle className="text-heading flex items-center">
                    <span className="bg-yellow-100/50 p-2 rounded-full mr-2">
                      <Clock className="h-5 w-5 text-yellow-500" />
                    </span>
                    Pendientes
                  </CardTitle>
                  <CardDescription>Cotizaciones en espera de revisión</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center pt-2">
                    <span className="text-4xl font-bold slide-in">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader variant="dots" size="sm" />
                        </span>
                      ) : statusCounts.pending}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card shadow-medium hover-lift scale-in">
                <CardHeader className="pb-2 border-b border-white/10">
                  <CardTitle className="text-heading flex items-center">
                    <span className="bg-green-100/50 p-2 rounded-full mr-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </span>
                    Aprobadas
                  </CardTitle>
                  <CardDescription>Cotizaciones aceptadas por clientes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center pt-2">
                    <span className="text-4xl font-bold slide-in">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader variant="dots" size="sm" />
                        </span>
                      ) : statusCounts.approved}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card shadow-medium hover-lift scale-in">
                <CardHeader className="pb-2 border-b border-white/10">
                  <CardTitle className="text-heading flex items-center">
                    <span className="bg-red-100/50 p-2 rounded-full mr-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    </span>
                    Rechazadas
                  </CardTitle>
                  <CardDescription>Cotizaciones rechazadas por clientes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center pt-2">
                    <span className="text-4xl font-bold slide-in">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader variant="dots" size="sm" />
                        </span>
                      ) : statusCounts.rejected}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card shadow-medium hover-lift scale-in">
                <CardHeader className="pb-2 border-b border-white/10">
                  <CardTitle className="text-heading flex items-center">
                    <span className="bg-blue-100/50 p-2 rounded-full mr-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                    </span>
                    En Negociación
                  </CardTitle>
                  <CardDescription>Cotizaciones en proceso de negociación</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center pt-2">
                    <span className="text-4xl font-bold slide-in">
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
            
            <Card className="glass-card shadow-medium scale-in">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="text-subheading flex items-center">
                  <span className="bg-primary/20 p-2 rounded-full mr-2">
                    <FileText className="h-5 w-5 text-primary" />
                  </span>
                  Cotizaciones Recientes
                </CardTitle>
                <CardDescription>Las 5 cotizaciones creadas más recientemente</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-[250px] scale-in">
                    <div className="glass-pill p-8 rounded-xl shadow-medium flex flex-col items-center">
                      <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <Loader className="h-12 w-12 text-primary" />
                      </div>
                      <h3 className="text-heading text-xl mb-2">Cargando datos</h3>
                      <p className="text-neutral-500">Por favor espera mientras cargamos la información...</p>
                    </div>
                  </div>
                ) : recentQuotations.length > 0 ? (
                  <div className="glass-panel p-4 rounded-lg shadow-soft overflow-hidden slide-in">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-200/40">
                            <th className="px-4 py-3 text-left text-label text-neutral-500">Nombre del Proyecto</th>
                            <th className="px-4 py-3 text-left text-label text-neutral-500">Cliente</th>
                            <th className="px-4 py-3 text-left text-label text-neutral-500">Tipo de Análisis</th>
                            <th className="px-4 py-3 text-left text-label text-neutral-500">Creación</th>
                            <th className="px-4 py-3 text-left text-label text-neutral-500">Estado</th>
                            <th className="px-4 py-3 text-left text-label text-neutral-500">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentQuotations.map((quote, index) => (
                            <tr 
                              key={quote.id} 
                              className="border-b border-neutral-200/40 hover:bg-white/10 transition-colors"
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                              <td className="px-4 py-3 text-sm text-neutral-900 font-medium">{quote.projectName}</td>
                              <td className="px-4 py-3 text-sm text-neutral-700">Cliente {quote.clientId}</td>
                              <td className="px-4 py-3 text-sm text-neutral-700">{quote.analysisType}</td>
                              <td className="px-4 py-3 text-sm text-neutral-700">
                                {new Date(quote.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                {quote.status === 'approved' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-success/10 text-success backdop-blur-sm">
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                    {translateStatus(quote.status)}
                                  </span>
                                )}
                                {quote.status === 'pending' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-warning/10 text-warning backdrop-blur-sm">
                                    <Clock className="h-3.5 w-3.5 mr-1" />
                                    {translateStatus(quote.status)}
                                  </span>
                                )}
                                {quote.status === 'rejected' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-destructive/10 text-destructive backdrop-blur-sm">
                                    <AlertCircle className="h-3.5 w-3.5 mr-1" />
                                    {translateStatus(quote.status)}
                                  </span>
                                )}
                                {quote.status === 'in-negotiation' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-primary/10 text-primary backdrop-blur-sm">
                                    <FileText className="h-3.5 w-3.5 mr-1" />
                                    {translateStatus(quote.status)}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                                ${quote.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-center items-center h-[250px] text-center px-4 scale-in">
                    <div className="glass-pill p-8 rounded-xl shadow-medium fade-in flex flex-col items-center max-w-md">
                      <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <FileText className="h-12 w-12 text-primary" />
                      </div>
                      <h3 className="text-heading text-xl mb-2">No hay cotizaciones</h3>
                      <p className="text-neutral-500 mb-6">
                        No se encontraron cotizaciones recientes. ¡Crea tu primera cotización!
                      </p>
                      <Link href="/new-quote">
                        <Button 
                          className="hover-lift shadow-soft hover:shadow-medium transition-all" 
                          size="lg"
                        >
                          <PlusCircle className="mr-2 h-5 w-5" />
                          Crear Nueva Cotización
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
                
                {recentQuotations.length > 0 && (
                  <div className="mt-4 flex justify-end">
                    <Link href="/manage-quotes">
                      <Button 
                        variant="outline" 
                        className="hover-lift shadow-soft"
                        size="lg"
                      >
                        <FileText className="mr-2 h-5 w-5" />
                        Ver Todas las Cotizaciones
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
