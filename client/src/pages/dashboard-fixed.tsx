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
      <div className="py-6 px-8 border-b border-neutral-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-neutral-800">Sistema de Cotización de Escucha Social</h1>
              <p className="text-sm text-neutral-500 mt-1">Gestiona y da seguimiento a todas tus cotizaciones</p>
            </div>
            <Link href="/new-quote">
              <Button className="mt-4 sm:mt-0 h-10 px-5 transition-all duration-150 shadow-sm bg-blue-600 hover:bg-blue-700">
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear Nueva Cotización
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Contenido principal */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb - navegación */}
          <div className="flex items-center text-sm text-neutral-500 mt-8 mx-8">
            <Link href="/" className="hover:text-neutral-800">Inicio</Link>
            <span className="mx-2">/</span>
            <span className="text-neutral-800 font-medium">Cotizaciones</span>
          </div>
          
          {/* KPIs con diseño mejorado - con mayor espaciado */}
          <div className="kpi-container mx-8 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="border-l-4 border-yellow-400 h-full flex flex-col">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center mr-3">
                        <Clock className="h-4 w-4 text-yellow-600" />
                      </div>
                      <CardTitle className="text-base font-medium">
                        Pendientes
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-5 pb-4 flex flex-col justify-between">
                    <CardDescription className="text-xs text-neutral-500">Cotizaciones en espera de revisión</CardDescription>
                    <div className="flex items-center mt-2">
                      <span className="text-2xl font-bold text-neutral-900">
                        {isLoading ? (
                          <span className="inline-flex items-center">
                            <Loader variant="dots" size="sm" />
                          </span>
                        ) : statusCounts.pending}
                      </span>
                    </div>
                  </CardContent>
                </div>
              </Card>
              
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="border-l-4 border-green-400 h-full flex flex-col">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <CardTitle className="text-base font-medium">
                        Aprobadas
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-5 pb-4 flex flex-col justify-between">
                    <CardDescription className="text-xs text-neutral-500">Cotizaciones aceptadas por clientes</CardDescription>
                    <div className="flex items-center mt-2">
                      <span className="text-2xl font-bold text-neutral-900">
                        {isLoading ? (
                          <span className="inline-flex items-center">
                            <Loader variant="dots" size="sm" />
                          </span>
                        ) : statusCounts.approved}
                      </span>
                    </div>
                  </CardContent>
                </div>
              </Card>
              
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="border-l-4 border-red-400 h-full flex flex-col">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mr-3">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      </div>
                      <CardTitle className="text-base font-medium">
                        Rechazadas
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-5 pb-4 flex flex-col justify-between">
                    <CardDescription className="text-xs text-neutral-500">Cotizaciones rechazadas por clientes</CardDescription>
                    <div className="flex items-center mt-2">
                      <span className="text-2xl font-bold text-neutral-900">
                        {isLoading ? (
                          <span className="inline-flex items-center">
                            <Loader variant="dots" size="sm" />
                          </span>
                        ) : statusCounts.rejected}
                      </span>
                    </div>
                  </CardContent>
                </div>
              </Card>
              
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="border-l-4 border-blue-400 h-full flex flex-col">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <CardTitle className="text-base font-medium">
                        En Negociación
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-5 pb-4 flex flex-col justify-between">
                    <CardDescription className="text-xs text-neutral-500">Cotizaciones en proceso de negociación</CardDescription>
                    <div className="flex items-center mt-2">
                      <span className="text-2xl font-bold text-neutral-900">
                        {isLoading ? (
                          <span className="inline-flex items-center">
                            <Loader variant="dots" size="sm" />
                          </span>
                        ) : statusCounts.inNegotiation}
                      </span>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </div>
          </div>
          
          {/* Tabla de cotizaciones mejorada */}
          <div className="mx-8 mt-12">
            <Card className="border-0 rounded-lg shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b px-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-medium">Cotizaciones Recientes</CardTitle>
                    <CardDescription className="text-xs mt-1">Las 5 cotizaciones creadas más recientemente</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-medium bg-white">
                    Ver Todas las Cotizaciones
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-8 py-6">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader variant="dots" size="md" text="Cargando cotizaciones recientes" />
                  </div>
                ) : recentQuotations.length > 0 ? (
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-left">
                          <th className="pl-6 pr-2 py-2 text-xs font-medium text-neutral-500">Nombre del Proyecto</th>
                          <th className="px-2 py-2 text-xs font-medium text-neutral-500">Cliente</th>
                          <th className="px-2 py-2 text-xs font-medium text-neutral-500">Tipo de Análisis</th>
                          <th className="px-2 py-2 text-xs font-medium text-neutral-500">Creación</th>
                          <th className="px-2 py-2 text-xs font-medium text-neutral-500">Estado</th>
                          <th className="px-2 py-2 text-xs font-medium text-neutral-500 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentQuotations.map((quote) => (
                          <tr key={quote.id} className="bg-white hover:bg-neutral-50 transition-colors duration-150 shadow-sm">
                            <td className="pl-6 pr-2 py-3 text-sm font-medium text-neutral-900 rounded-l-md">{quote.projectName}</td>
                            <td className="px-2 py-3 text-sm text-neutral-600">Cliente {quote.clientId}</td>
                            <td className="px-2 py-3 text-sm text-neutral-600">
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-neutral-100 text-xs font-medium text-neutral-700">
                                {quote.analysisType}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-sm text-neutral-600">
                              {new Date(quote.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-2 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium
                                ${quote.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' : ''}
                                ${quote.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : ''}
                                ${quote.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' : ''}
                                ${quote.status === 'in-negotiation' ? 'bg-blue-50 text-blue-700 border border-blue-200' : ''}
                              `}>
                                {translateStatus(quote.status)}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-sm font-semibold text-neutral-900 text-right rounded-r-md">
                              ${quote.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 px-8">
                    <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-neutral-100 mb-4">
                      <FileText className="h-6 w-6 text-neutral-400" />
                    </div>
                    <h3 className="text-lg font-medium text-neutral-800 mb-2">No se encontraron cotizaciones</h3>
                    <p className="text-neutral-500 mb-4 max-w-md mx-auto">Crea tu primera cotización para comenzar a gestionar tus proyectos de escucha social.</p>
                    <Link href="/new-quote">
                      <Button className="mt-2">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear Nueva Cotización
                      </Button>
                    </Link>
                  </div>
                )}
                
                {recentQuotations.length > 0 && (
                  <div className="mt-6 text-center">
                    <Link href="/manage-quotes">
                      <Button 
                        variant="outline" 
                        className="bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium transition-all duration-150"
                      >
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