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
    <div className="flex flex-col flex-1 overflow-hidden bg-[#F7F8FA]">
      {/* Header superior mejorado */}
      <div className="py-6 px-8 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Sistema de Cotización de Escucha Social</h1>
              <p className="text-sm text-neutral-500 mt-1">Gestiona y da seguimiento a todas tus cotizaciones</p>
            </div>
            <Link href="/new-quote">
              <Button className="mt-4 sm:mt-0 h-10 px-4 transition-all duration-150 shadow-sm bg-blue-600 hover:bg-blue-700">
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear Nueva Cotización
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Contenido principal */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* KPIs con diseño mejorado */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-sm hover:shadow transition-all duration-150">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="text-lg font-medium flex items-center">
                  <Clock className="h-5 w-5 text-yellow-500 inline mr-2" />
                  Pendientes
                </CardTitle>
                <CardDescription className="text-sm">Cotizaciones en espera de revisión</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center">
                  <span className="text-3xl font-bold text-neutral-900">
                    {isLoading ? (
                      <span className="inline-flex items-center">
                        <Loader variant="dots" size="sm" />
                      </span>
                    ) : statusCounts.pending}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm hover:shadow transition-all duration-150">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="text-lg font-medium flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 inline mr-2" />
                  Aprobadas
                </CardTitle>
                <CardDescription className="text-sm">Cotizaciones aceptadas por clientes</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center">
                  <span className="text-3xl font-bold text-neutral-900">
                    {isLoading ? (
                      <span className="inline-flex items-center">
                        <Loader variant="dots" size="sm" />
                      </span>
                    ) : statusCounts.approved}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm hover:shadow transition-all duration-150">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="text-lg font-medium flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 inline mr-2" />
                  Rechazadas
                </CardTitle>
                <CardDescription className="text-sm">Cotizaciones rechazadas por clientes</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center">
                  <span className="text-3xl font-bold text-neutral-900">
                    {isLoading ? (
                      <span className="inline-flex items-center">
                        <Loader variant="dots" size="sm" />
                      </span>
                    ) : statusCounts.rejected}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm hover:shadow transition-all duration-150">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="text-lg font-medium flex items-center">
                  <FileText className="h-5 w-5 text-blue-500 inline mr-2" />
                  En Negociación
                </CardTitle>
                <CardDescription className="text-sm">Cotizaciones en proceso de negociación</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center">
                  <span className="text-3xl font-bold text-neutral-900">
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
          
          {/* Tabla de cotizaciones mejorada */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Cotizaciones Recientes</CardTitle>
                  <CardDescription className="mt-1">Las 5 cotizaciones creadas más recientemente</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-9 bg-white">
                  Ver Todas las Cotizaciones
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader variant="dots" size="md" text="Cargando cotizaciones recientes" />
                </div>
              ) : recentQuotations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Nombre del Proyecto</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Cliente</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Tipo de Análisis</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Creación</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Estado</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Total</th>
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
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
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
                  <Button variant="outline">Ver Todas las Cotizaciones</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
