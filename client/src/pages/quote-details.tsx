import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, FileText, User, Calendar, DollarSign, Tag } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Quotation, QuotationTeamMember, Personnel, Role, ReportTemplate, Client } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function QuoteDetails() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/quote/:id");
  const quoteId = params?.id ? parseInt(params.id) : null;

  // Fetch quote details
  const { data: quotation, isLoading: isLoadingQuote } = useQuery<Quotation>({
    queryKey: [`/api/quotations/${quoteId}`],
    enabled: !!quoteId,
  });

  // Fetch team members
  const { data: teamMembers, isLoading: isLoadingTeam } = useQuery<QuotationTeamMember[]>({
    queryKey: [`/api/quotation-team/${quoteId}`],
    enabled: !!quoteId,
  });

  // Fetch personnel
  const { data: personnel, isLoading: isLoadingPersonnel } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  // Fetch roles
  const { data: roles, isLoading: isLoadingRoles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  // Fetch templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/templates"],
  });

  // Fetch clients
  const { data: clients, isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Check if any query is loading
  const isLoading = isLoadingQuote || isLoadingTeam || isLoadingPersonnel || isLoadingRoles || 
                   isLoadingTemplates || isLoadingClients;

  if (!quoteId) {
    return <div className="p-8 text-center">ID de cotización no proporcionado</div>;
  }

  // Helper functions
  const getClientName = (clientId: number | undefined) => {
    if (!clientId || !clients) return "Cliente Desconocido";
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : "Cliente Desconocido";
  };

  const getPersonnelName = (personnelId: number | undefined) => {
    if (!personnelId || !personnel) return "Miembro Desconocido";
    const person = personnel.find(p => p.id === personnelId);
    return person ? person.name : "Miembro Desconocido";
  };

  const getRoleName = (roleId: number | undefined) => {
    if (!roleId || !roles) return "Rol Desconocido";
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : "Rol Desconocido";
  };

  const getTemplateName = (templateId: number | undefined) => {
    if (!templateId || !templates) return "Plantilla Desconocida";
    const template = templates.find(t => t.id === templateId);
    return template ? template.name : "Plantilla Desconocida";
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
        <Button variant="ghost" onClick={() => navigate("/manage-quotes")} className="mr-2">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <h2 className="text-lg font-semibold text-neutral-900">Detalles de Cotización</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : quotation ? (
            <>
              {/* Header */}
              <div className="mb-6 bg-white rounded-lg shadow p-6 border-l-4 border-primary">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                      {quotation.projectName}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(quotation.status)}`}>
                        {translateStatus(quotation.status)}
                      </span>
                      <div className="flex items-center text-sm text-neutral-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(quotation.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center text-sm text-neutral-500">
                        <User className="h-4 w-4 mr-1" />
                        {getClientName(quotation.clientId)}
                      </div>
                      <div className="flex items-center text-sm text-neutral-500">
                        <Tag className="h-4 w-4 mr-1" />
                        {quotation.analysisType}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {formatCurrency(quotation.totalAmount)}
                    </div>
                    <div className="text-sm text-neutral-500">
                      Cotización #{quotation.id}
                    </div>
                  </div>
                </div>
              </div>

              {/* Main content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column */}
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Detalles del Proyecto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-2">Tipo de Análisis</h4>
                          <div className="flex items-center">
                            <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                            <p className="text-sm font-medium text-neutral-800">{quotation.analysisType}</p>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-2">Tipo de Proyecto</h4>
                          <div className="flex items-center">
                            <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                            <p className="text-sm font-medium text-neutral-800">{quotation.projectType}</p>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-2">Volumen de Menciones</h4>
                          <div className="flex items-center">
                            <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                            <p className="text-sm font-medium text-neutral-800">{quotation.mentionsVolume}</p>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-2">Países Cubiertos</h4>
                          <div className="flex items-center">
                            <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                            <p className="text-sm font-medium text-neutral-800">{quotation.countriesCovered}</p>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-2">Participación del Cliente</h4>
                          <div className="flex items-center">
                            <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                            <p className="text-sm font-medium text-neutral-800">{quotation.clientEngagement}</p>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-2">Plantilla de Reporte</h4>
                          <div className="flex items-center">
                            <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                            <p className="text-sm font-medium text-neutral-800">
                              {quotation.templateId ? getTemplateName(quotation.templateId) : "No especificada"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {quotation.templateCustomization && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 overflow-hidden">
                          <div className="bg-blue-100 px-4 py-2">
                            <h4 className="text-xs uppercase tracking-wider font-semibold text-blue-800">Personalización de Plantilla</h4>
                          </div>
                          <div className="p-4">
                            <p className="text-sm text-neutral-800 whitespace-pre-wrap">
                              {quotation.templateCustomization}
                            </p>
                          </div>
                        </div>
                      )}

                      {quotation.additionalNotes && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
                          <div className="bg-amber-100 px-4 py-2">
                            <h4 className="text-xs uppercase tracking-wider font-semibold text-amber-800">Notas Adicionales</h4>
                          </div>
                          <div className="p-4">
                            <p className="text-sm text-neutral-800 whitespace-pre-wrap">
                              {quotation.additionalNotes}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Equipo Asignado</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {teamMembers && teamMembers.length > 0 ? (
                        <div>
                          <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-neutral-100 rounded-t-lg mb-2">
                            <div className="text-xs font-semibold text-neutral-600">Rol</div>
                            <div className="text-xs font-semibold text-neutral-600">Miembro</div>
                            <div className="text-xs font-semibold text-neutral-600">Tarifa</div>
                            <div className="text-xs font-semibold text-neutral-600">Horas</div>
                            <div className="text-xs font-semibold text-neutral-600 text-right">Costo</div>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            {teamMembers.map((member) => (
                              <div key={member.id} className="grid grid-cols-5 gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-md items-center">
                                <div className="text-sm font-medium text-neutral-800">
                                  {getRoleName(member.personnelId ? personnel?.find(p => p.id === member.personnelId)?.roleId : undefined)}
                                </div>
                                <div className="text-sm text-neutral-700">
                                  {getPersonnelName(member.personnelId)}
                                </div>
                                <div className="text-sm font-mono text-neutral-700">
                                  ${member.rate.toFixed(2)}
                                </div>
                                <div className="text-sm text-neutral-700">
                                  {member.hours}
                                </div>
                                <div className="text-sm font-mono text-neutral-800 font-medium text-right">
                                  ${member.cost.toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex justify-between items-center py-2 px-3 bg-neutral-100 rounded-md">
                            <span className="text-sm font-medium text-neutral-700">Total Horas</span>
                            <span className="text-sm font-medium">
                              {teamMembers.reduce((sum, member) => sum + member.hours, 0)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-neutral-50 rounded-lg p-6 text-center">
                          <div className="text-sm text-neutral-500">
                            No hay miembros del equipo asignados a esta cotización
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Desglose de Costos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 bg-neutral-50 rounded-md px-3">
                          <span className="text-sm font-medium text-neutral-700">Costo Base</span>
                          <span className="text-sm font-mono font-medium">${quotation.baseCost.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-2 bg-neutral-50 rounded-md px-3">
                          <div>
                            <span className="text-sm font-medium text-neutral-700">Ajuste por Complejidad</span>
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              +{((quotation.complexityAdjustment / quotation.baseCost) * 100).toFixed(0)}%
                            </span>
                          </div>
                          <span className="text-sm font-mono font-medium">${quotation.complexityAdjustment.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-2 bg-neutral-50 rounded-md px-3">
                          <div>
                            <span className="text-sm font-medium text-neutral-700">Margen</span>
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                              {(() => {
                                // Calculate the actual markup ratio
                                const baseCostWithAdjustment = quotation.baseCost + quotation.complexityAdjustment;
                                const markupRatio = quotation.markupAmount / baseCostWithAdjustment;
                                
                                // Check for common markup ratios
                                if (Math.abs(markupRatio - 2.0) < 0.05) return 'x2.0';
                                if (Math.abs(markupRatio - 1.5) < 0.05) return 'x1.5';
                                if (Math.abs(markupRatio - 1.0) < 0.05) return 'x1.0';
                                if (Math.abs(markupRatio - 0.5) < 0.05) return 'x0.5';
                                
                                // Use actual percentage if not close to common ratios
                                return `${(markupRatio * 100).toFixed(0)}%`;
                              })()}
                            </span>
                          </div>
                          <span className="text-sm font-mono font-medium">${quotation.markupAmount.toFixed(2)}</span>
                        </div>
                        
                        {quotation.adjustmentReason && (
                          <>
                            <Separator />
                            <div className="py-1">
                              <div className="text-sm text-neutral-600 mb-1">Razón de Ajuste:</div>
                              <div className="text-sm bg-neutral-50 p-2 rounded">
                                {quotation.adjustmentReason}
                              </div>
                            </div>
                          </>
                        )}
                        
                        <Separator />
                        <div className="flex justify-between items-center py-2">
                          <span className="text-base font-medium text-neutral-900">Total</span>
                          <span className="text-base font-medium font-mono text-primary">
                            ${quotation.totalAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Acciones</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Button className="w-full" variant="outline" onClick={() => navigate(`/download-quote/${quoteId}`)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Descargar PDF
                        </Button>
                        <Button className="w-full" variant="outline" onClick={() => navigate(`/edit-quote/${quoteId}`)}>
                          Editar Cotización
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">Cotización no encontrada</div>
          )}
        </div>
      </div>
    </div>
  );
}