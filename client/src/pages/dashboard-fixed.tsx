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
    <div className="page-container">
      {/* Header con sistema de diseño unificado */}
      <div className="flex-between mb-6">
        <div>
          <h1 className="heading-page">Sistema de Cotización de Escucha Social</h1>
        </div>
        <Link href="/new-quote">
          <Button className="btn-standard bg-primary text-primary-foreground hover:bg-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Nueva Cotización
          </Button>
        </Link>
      </div>

      {/* Cards de estadísticas con diseño estándar */}
      <div className="grid-compact grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="card-standard">
          <div className="flex-start mb-3">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-body-sm font-medium">Pendientes</span>
          </div>
          <div className="text-3xl font-bold text-yellow-900">
            {isLoading ? <Loader variant="dots" size="sm" /> : statusCounts.pending}
          </div>
          <p className="text-caption text-muted-foreground">Esperando revisión</p>
        </div>

        <div className="card-standard">
          <div className="flex-start mb-3">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-body-sm font-medium">Aprobadas</span>
          </div>
          <div className="text-3xl font-bold text-green-900">
            {isLoading ? <Loader variant="dots" size="sm" /> : statusCounts.approved}
          </div>
          <p className="text-caption text-muted-foreground">Listas para implementar</p>
        </div>

        <div className="card-standard">
          <div className="flex-start mb-3">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-body-sm font-medium">Rechazadas</span>
          </div>
          <div className="text-3xl font-bold text-red-900">
            {isLoading ? <Loader variant="dots" size="sm" /> : statusCounts.rejected}
          </div>
          <p className="text-caption text-muted-foreground">Requieren revisión</p>
        </div>

        <div className="card-standard">
          <div className="flex-start mb-3">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <span className="text-body-sm font-medium">En Negociación</span>
          </div>
          <div className="text-3xl font-bold text-blue-900">
            {isLoading ? <Loader variant="dots" size="sm" /> : statusCounts.inNegotiation}
          </div>
          <p className="text-caption text-muted-foreground">En proceso de negociación</p>
        </div>
      </div>

      {/* Lista de cotizaciones recientes con diseño estándar */}
      <div className="card-standard">
        <div className="flex-between mb-4">
          <h2 className="heading-section">Cotizaciones Recientes</h2>
          <FileText className="h-5 w-5 text-primary" />
        </div>

        {isLoading ? (
          <div className="flex-center py-8">
            <Loader variant="dots" size="sm" />
          </div>
        ) : recentQuotations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted">No hay cotizaciones disponibles</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-body-sm font-medium">Proyecto</th>
                    <th className="text-left py-2 px-3 text-body-sm font-medium">Cliente</th>
                    <th className="text-left py-2 px-3 text-body-sm font-medium">Tipo</th>
                    <th className="text-left py-2 px-3 text-body-sm font-medium">Fecha</th>
                    <th className="text-left py-2 px-3 text-body-sm font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQuotations.map((quote, index) => (
                    <tr key={quote.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-3 text-body-sm font-medium">{quote.projectName}</td>
                      <td className="py-2 px-3 text-body-sm">Cliente {quote.clientId}</td>
                      <td className="py-2 px-3 text-body-sm">{quote.analysisType}</td>
                      <td className="py-2 px-3 text-body-sm">
                        {new Date(quote.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-caption font-medium ${
                          quote.status === 'approved' ? 'bg-green-100 text-green-800' :
                          quote.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          quote.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {translateStatus(quote.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Link href="/manage-quotes">
                <Button variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Todas
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}