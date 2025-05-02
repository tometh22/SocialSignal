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
              <h1 className="text-display text-balance text-neutral-900">Sistema de Cotización de Escucha Social</h1>
              <Link href="/new-quote">
                <Button className="mt-4 sm:mt-0 hover-lift">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Nueva Cotización
                </Button>
              </Link>
            </div>
            
            <div className="card-grid mb-section">
              <Card className="shadow-soft hover-lift">
                <CardHeader className="pb-2">
                  <CardTitle className="text-heading">Pendientes</CardTitle>
                  <CardDescription>Cotizaciones en espera de revisión</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-yellow-100 text-yellow-500 mr-3">
                      <Clock className="h-6 w-6" />
                    </div>
                    <span className="text-3xl font-bold">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader variant="dots" size="sm" />
                        </span>
                      ) : statusCounts.pending}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-soft hover-lift">
                <CardHeader className="pb-2">
                  <CardTitle className="text-heading">Aprobadas</CardTitle>
                  <CardDescription>Cotizaciones aceptadas por clientes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 text-green-500 mr-3">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <span className="text-3xl font-bold">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader variant="dots" size="sm" />
                        </span>
                      ) : statusCounts.approved}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-soft hover-lift">
                <CardHeader className="pb-2">
                  <CardTitle className="text-heading">Rechazadas</CardTitle>
                  <CardDescription>Cotizaciones rechazadas por clientes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-red-100 text-red-500 mr-3">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                    <span className="text-3xl font-bold">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader variant="dots" size="sm" />
                        </span>
                      ) : statusCounts.rejected}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-soft hover-lift">
                <CardHeader className="pb-2">
                  <CardTitle className="text-heading">En Negociación</CardTitle>
                  <CardDescription>Cotizaciones en proceso de negociación</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 text-blue-500 mr-3">
                      <FileText className="h-6 w-6" />
                    </div>
                    <span className="text-3xl font-bold">
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
            
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-subheading">Cotizaciones Recientes</CardTitle>
                <CardDescription>Las 5 cotizaciones creadas más recientemente</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader variant="dots" size="md" text="Cargando cotizaciones recientes" />
                  </div>
                ) : recentQuotations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200">
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Nombre del Proyecto</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Cliente</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Tipo de Análisis</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Creación</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Estado</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentQuotations.map((quote) => (
                          <tr key={quote.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                            <td className="px-4 py-3 text-sm text-neutral-900">{quote.projectName}</td>
                            <td className="px-4 py-3 text-sm text-neutral-900">Cliente {quote.clientId}</td>
                            <td className="px-4 py-3 text-sm text-neutral-900">{quote.analysisType}</td>
                            <td className="px-4 py-3 text-sm text-neutral-900">
                              {new Date(quote.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium
                                ${quote.status === 'approved' ? 'bg-green-100 text-green-800' : ''}
                                ${quote.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                                ${quote.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                                ${quote.status === 'in-negotiation' ? 'bg-blue-100 text-blue-800' : ''}
                              `}>
                                {translateStatus(quote.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                              ${quote.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-neutral-500">No se encontraron cotizaciones. ¡Crea tu primera cotización!</div>
                )}
                
                <div className="mt-4 flex justify-end">
                  <Link href="/manage-quotes">
                    <Button variant="outline" className="hover-lift">Ver Todas las Cotizaciones</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
