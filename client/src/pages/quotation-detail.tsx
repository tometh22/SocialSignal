import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/queryClient';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Download, Printer, Edit, FileCheck,
  FileClock, Loader2, Building, Calendar, Clock,
  Mail, Phone, Briefcase, Users, Globe, DollarSign,
  MessageSquare, FileText, Layers, PieChart, TrendingUp
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { NegotiationHistory } from '@/components/negotiation-history';
import { QuotationVariantsDisplay } from '@/components/quotation/quotation-variants-display';

// Interfaces
interface TeamMember {
  id: number;
  quotationId: number;
  personnelId: number | null;
  roleId: number | null;
  hours: number;
  rate: number;
  cost: number;
}

interface Quotation {
  id: number;
  clientId: number;
  projectName: string;
  projectType: string;
  analysisType: string;
  mentionsVolume: string;
  countriesCovered: string;
  clientEngagement: string;
  templateId: number | null;
  templateCustomization: string;
  baseCost: number;
  complexityAdjustment: number;
  markupAmount: number;
  marginFactor?: number | null;
  toolsCost?: number | null;
  platformCost?: number | null;
  additionalDeliverableCost?: number | null;
  deviationPercentage?: number | null;
  discountPercentage?: number | null;
  applyInflationAdjustment?: boolean | null;
  manualInflationRate?: number | null;
  totalAmount: number;
  status: string;
  adjustmentReason: string;
  additionalNotes: string;
  quotationCurrency?: string;
  createdAt: string;
  expiresAt?: string | null;
  lossReason?: string | null;
}

interface ClientInfo {
  id: number;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface Template {
  id: number;
  name: string;
  description: string | null;
  complexity: string;
  pageRange: string | null;
  features: string | null;
}

interface Personnel {
  id: number;
  name: string;
  roleId: number;
  hourlyRate: number;
}

interface Role {
  id: number;
  name: string;
  description: string;
  hourlyRate: number;
}

const QuotationDetail: React.FC = () => {
  // Soporta ambas rutas: /quotation/:id y /quotations/:id 
  const [, quotationParams] = useRoute<{ id: string }>('/quotation/:id');
  const [, quotationsParams] = useRoute<{ id: string }>('/quotations/:id');
  const params = quotationParams || quotationsParams;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const quotationId = params?.id;

  // Estado para almacenar datos
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [profitability, setProfitability] = useState<any>(null);

  // Cargar los datos de la cotización
  useEffect(() => {
    if (!quotationId) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const fetchJson = async (path: string, label: string) => {
          const response = await authFetch(path);
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(`Error al cargar ${label}: ${payload.message || response.status}`);
          }
          return response.json();
        };
        const [quotationData, teamData, rolesData, personnelData] = await Promise.all([
          fetchJson(`/api/quotations/${quotationId}`, 'la cotización'),
          fetchJson(`/api/quotation-team/${quotationId}`, 'el equipo'),
          fetchJson('/api/roles', 'los roles'),
          fetchJson('/api/personnel', 'el personal'),
        ]);
        setQuotation(quotationData);
        setTeamMembers(teamData);
        setRoles(rolesData);
        setPersonnel(personnelData);
        const [clientData, templateData] = await Promise.all([
          quotationData.clientId ? fetchJson(`/api/clients/${quotationData.clientId}`, 'el cliente') : null,
          quotationData.templateId ? fetchJson(`/api/templates/${quotationData.templateId}`, 'la plantilla').catch(() => null) : null,
        ]);
        setClient(clientData);
        setTemplate(templateData);
      } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
        toast({
          title: "Error de carga",
          description: err instanceof Error ? err.message : 'Error desconocido',
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [quotationId, toast, refreshKey]);

  // Cargar datos de rentabilidad cuando esté disponible el quotationId
  useEffect(() => {
    if (!quotationId) return;
    authFetch(`/api/quotations/${quotationId}/profitability`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.profitability) setProfitability(data); })
      .catch(() => {});
  }, [quotationId, refreshKey]);

  // Si no hay ID válido, redireccionar (via effect para no llamar side-effects en render)
  useEffect(() => {
    if (!quotationId) {
      toast({ title: "Error", description: "ID de cotización no válido", variant: "destructive" });
      setLocation('/manage-quotes');
    }
  }, [quotationId]);

  if (!quotationId) return null;

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    const curr = quotation?.quotationCurrency || 'ARS';
    return new Intl.NumberFormat(curr === 'USD' ? 'en-US' : 'es-AR', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: curr === 'USD' ? 2 : 0,
      maximumFractionDigits: curr === 'USD' ? 2 : 0,
    }).format(amount);
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Formatear fecha corta
  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Calcular el subtotal operacional
  const calculateOperationalSubtotal = () => {
    if (!quotation) return 0;
    return quotation.baseCost + quotation.complexityAdjustment;
  };

  // Obtener nombre de personal por ID
  const getPersonnelName = (id: number | null) => {
    if (!id) return 'Sin persona asignada';
    const person = personnel.find(p => p.id === id);
    return person ? person.name : `Personal ID: ${id}`;
  };

  // Obtener nombre de rol por ID
  const getRoleName = (roleId: number | null, personnelId: number | null) => {
    const quotedRoleId = roleId || personnel.find(p => p.id === personnelId)?.roleId;
    if (!quotedRoleId) return 'Rol no especificado';
    const role = roles.find(r => r.id === quotedRoleId);
    return role ? role.name : `Rol ID: ${quotedRoleId}`;
  };

  // Mapear tipos de proyecto a nombres
  const getProjectTypeName = (type: string) => {
    const projectTypes: Record<string, string> = {
      'executive': 'Informe Ejecutivo',
      'demo': 'Demostración',
      'periodic': 'Reporte Periódico',
      'strategic': 'Análisis Estratégico',
      'crisis': 'Gestión de Crisis',
      'brand': 'Análisis de Marca',
      'custom': 'Personalizado',
      'on-demand': 'Proyecto On-Demand',
      'fee-mensual': 'Fee mensual',
      'always-on': 'Always-On',
    };
    
    return projectTypes[type] || type;
  };

  // Mapear estado a nombre y color
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, {label: string, variant: "default" | "secondary" | "destructive" | "outline"}> = {
      'draft': { label: 'Borrador', variant: 'outline' },
      'pending': { label: 'Pendiente', variant: 'secondary' },
      'approved': { label: 'Aprobada', variant: 'default' },
      'rejected': { label: 'Rechazada', variant: 'destructive' },
      'in-negotiation': { label: 'En negociación', variant: 'secondary' },
    };
    
    const config = statusConfig[status] || { label: status, variant: 'outline' };
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  const downloadQuotation = () => {
    if (!quotation) return;
    const exportData = {
      quotation,
      client,
      team: teamMembers.map((member) => ({
        ...member,
        personnelName: getPersonnelName(member.personnelId),
        roleName: getRoleName(member.roleId, member.personnelId),
      })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cotizacion-${quotation.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Obtener icono y texto para el análisis
  const getAnalysisTypeInfo = (type: string) => {
    const analysisTypes: Record<string, {label: string}> = {
      'basic': { label: 'Básico' },
      'standard': { label: 'Estándar' },
      'advanced': { label: 'Avanzado' }
    };
    
    return analysisTypes[type]?.label || type;
  };

  // Obtener textos para volumen de menciones
  const getMentionsVolumeInfo = (volume: string) => {
    const volumes: Record<string, string> = {
      'small': 'Pequeño (hasta 1,000 menciones)',
      'medium': 'Mediano (1,000 - 5,000 menciones)',
      'large': 'Grande (5,000 - 20,000 menciones)',
      'xlarge': 'Extra grande (más de 20,000 menciones)'
    };
    
    return volumes[volume] || volume;
  };

  // Textos para países cubiertos
  const getCountriesCoveredInfo = (countries: string) => {
    const options: Record<string, string> = {
      '1': '1 país',
      '2-5': '2-5 países',
      '6-10': '6-10 países',
      '10+': 'Más de 10 países'
    };
    
    return options[countries] || countries;
  };

  // Textos para interacción con cliente
  const getClientEngagementInfo = (engagement: string) => {
    const options: Record<string, string> = {
      'low': 'Baja (1-2 reuniones)',
      'medium': 'Media (3-5 reuniones)',
      'high': 'Alta (más de 5 reuniones)'
    };
    
    return options[engagement] || engagement;
  };

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center text-xl text-neutral-500">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary/70" />
            <div>Cargando detalles de la cotización...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="container py-10">
        <div className="flex flex-col items-center justify-center h-64">
          <h2 className="text-xl font-semibold text-neutral-800 mb-4">
            {error || "Cotización no encontrada"}
          </h2>
          <Button onClick={() => setLocation('/manage-quotes')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al listado
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5 max-w-7xl bg-[#f8f9ff]">
      {/* Encabezado y acciones - más compacto */}
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button 
            aria-label="Volver a gestión de cotizaciones"
            variant="ghost" 
            size="sm"
            className="rounded-full h-8 w-8 p-0 hover:bg-slate-50"
            onClick={() => setLocation('/manage-quotes')}
          >
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </Button>
          
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-lg font-bold text-slate-800">{quotation.projectName}</h1>
              {getStatusBadge(quotation.status)}
            </div>
            
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <div className="text-slate-500 text-xs">
                <span className="flex items-center">
                  <FileText className="h-3 w-3 mr-1 inline-block" />
                  #{quotation.id} • {formatShortDate(quotation.createdAt)}
                </span>
              </div>
              {quotation.expiresAt && quotation.status === 'pending' && (() => {
                const exp = new Date(quotation.expiresAt);
                const now = new Date();
                const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${daysLeft < 0 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                    <Clock className="h-3 w-3" />
                    {daysLeft < 0 ? 'Vencida' : `Vence en ${daysLeft}d`}
                  </span>
                );
              })()}
              {quotation.lossReason && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500">
                  Perdida: {quotation.lossReason.split(' — ')[0]}
                </span>
              )}
              
              {client && (
                <div className="flex items-center bg-amber-50 rounded-full px-2 py-0.5 text-xs gap-1">
                  <Building className="h-3 w-3 text-amber-500" />
                  <span className="text-amber-700 font-medium truncate max-w-[120px]">{client.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1 self-end sm:self-auto">
          <Button aria-label="Imprimir cotización" onClick={() => window.print()} variant="outline" size="sm" className="h-8 px-2 border-slate-200 text-slate-600">
            <Printer className="h-4 w-4" />
          </Button>
          <Button aria-label="Descargar cotización" onClick={downloadQuotation} variant="outline" size="sm" className="h-8 px-2 border-slate-200 text-slate-600">
            <Download className="h-4 w-4" />
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="h-8 px-2 bg-indigo-500 hover:bg-indigo-600 text-white"
            aria-label="Editar cotización"
            onClick={() => setLocation(`/optimized-quote/${quotation.id}`)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Columna izquierda */}
        <div className="lg:col-span-2 space-y-6">
          {/* Grid de información principal del proyecto - estilo minimalista */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="flex flex-col bg-white p-4 rounded-md border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-full p-1.5 bg-blue-50">
                  <Briefcase className="text-blue-400 h-3.5 w-3.5" />
                </div>
                <p className="text-xs text-slate-500">Tipo de Proyecto</p>
              </div>
              <p className="font-medium text-slate-800">{getProjectTypeName(quotation.projectType)}</p>
            </div>
            
            <div className="flex flex-col bg-white p-4 rounded-md border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-full p-1.5 bg-purple-50">
                  <FileText className="text-purple-400 h-3.5 w-3.5" />
                </div>
                <p className="text-xs text-slate-500">Plantilla</p>
              </div>
              <p className="font-medium text-slate-800 truncate">
                {template ? template.name : 'Personalizado'}
              </p>
            </div>
            
            <div className="flex flex-col bg-white p-4 rounded-md border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-full p-1.5 bg-indigo-50">
                  <Layers className="text-indigo-400 h-3.5 w-3.5" />
                </div>
                <p className="text-xs text-slate-500">Tipo de Análisis</p>
              </div>
              <p className="font-medium text-slate-800 truncate">{getAnalysisTypeInfo(quotation.analysisType)}</p>
            </div>
            
            <div className="flex flex-col bg-white p-4 rounded-md border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-full p-1.5 bg-amber-50">
                  <PieChart className="text-amber-400 h-3.5 w-3.5" />
                </div>
                <p className="text-xs text-slate-500">Volumen</p>
              </div>
              <p className="font-medium text-slate-800 truncate">{getMentionsVolumeInfo(quotation.mentionsVolume)}</p>
            </div>
            
            <div className="flex flex-col bg-white p-4 rounded-md border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-full p-1.5 bg-emerald-50">
                  <Globe className="text-emerald-400 h-3.5 w-3.5" />
                </div>
                <p className="text-xs text-slate-500">Países</p>
              </div>
              <p className="font-medium text-slate-800 truncate">{getCountriesCoveredInfo(quotation.countriesCovered)}</p>
            </div>
            
            <div className="flex flex-col bg-white p-4 rounded-md border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-full p-1.5 bg-rose-50">
                  <MessageSquare className="text-rose-400 h-3.5 w-3.5" />
                </div>
                <p className="text-xs text-slate-500">Interacción</p>
              </div>
              <p className="font-medium text-slate-800 truncate">{getClientEngagementInfo(quotation.clientEngagement)}</p>
            </div>
          </div>

          {(quotation.templateCustomization || quotation.additionalNotes) && (
            <div className="bg-white p-4 rounded-md border border-slate-200 text-sm">
              <div className="flex gap-6">
                {quotation.templateCustomization && (
                  <div className="flex-1">
                    <h3 className="text-xs font-semibold text-slate-500 mb-1 flex items-center">
                      <FileText className="h-3 w-3 mr-1 text-slate-400" />
                      Personalización
                    </h3>
                    <p className="text-xs text-slate-700 line-clamp-1">{quotation.templateCustomization}</p>
                  </div>
                )}
                
                {quotation.additionalNotes && (
                  <div className="flex-1">
                    <h3 className="text-xs font-semibold text-slate-500 mb-1 flex items-center">
                      <MessageSquare className="h-3 w-3 mr-1 text-slate-400" />
                      Notas
                    </h3>
                    <p className="text-xs text-slate-700 line-clamp-1">{quotation.additionalNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tabla de miembros del equipo */}
          <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-white flex justify-between items-center border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <div className="rounded-full p-1.5 bg-blue-50">
                  <Users className="text-blue-500 h-3.5 w-3.5" />
                </div>
                <h3 className="font-medium text-sm text-slate-800">Equipo del Proyecto</h3>
              </div>
              <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100">
                {teamMembers.length} miembros
              </Badge>
            </div>
            
            {teamMembers.length > 0 ? (
              <div>
                <div className="overflow-auto" style={{ maxHeight: '350px' }}>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 border-b border-slate-200">
                        <TableHead className="font-medium text-slate-600 text-xs py-2">Rol</TableHead>
                        <TableHead className="font-medium text-slate-600 text-xs py-2">Persona</TableHead>
                        <TableHead className="text-right font-medium text-slate-600 text-xs py-2">Horas</TableHead>
                        <TableHead className="text-right font-medium text-slate-600 text-xs py-2">Tarifa</TableHead>
                        <TableHead className="text-right font-medium text-slate-600 text-xs py-2">Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member: TeamMember, index: number) => (
                        <TableRow 
                          key={member.id}
                          className={cn(
                            "transition-colors hover:bg-slate-50",
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                          )}
                        >
                          <TableCell className="font-medium text-slate-700 py-2 text-sm">{getRoleName(member.roleId, member.personnelId)}</TableCell>
                          <TableCell className="text-slate-600 py-2 text-sm">
                            {getPersonnelName(member.personnelId)}
                            {(() => {
                              const billing = (personnel.find(p => p.id === member.personnelId) as any)?.billingCurrency;
                              if (billing === 'USD') return <Badge variant="outline" className="ml-1.5 text-[10px] border-green-400 text-green-700 py-0 px-1">USD</Badge>;
                              if (billing === 'mixed') return <Badge variant="outline" className="ml-1.5 text-[10px] border-amber-400 text-amber-700 py-0 px-1">Mixto</Badge>;
                              return null;
                            })()}
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-700 py-2 text-sm">{member.hours}</TableCell>
                          <TableCell className="text-right text-slate-600 py-2 text-sm">{formatCurrency(member.rate)}</TableCell>
                          <TableCell className="text-right font-bold text-slate-800 py-2 text-sm">{formatCurrency(member.cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="py-3 px-4 border-t border-slate-200 bg-blue-50 flex justify-between items-center text-slate-800">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Total de horas asignadas:
                    </p>
                    <p className="text-sm font-bold flex items-center text-slate-800">
                      <Clock className="mr-1 h-3 w-3 text-blue-500" />
                      {teamMembers.reduce((sum, member) => sum + member.hours, 0)} horas
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-500">
                      Total equipo:
                    </p>
                    <p className="text-sm font-bold flex items-center justify-end text-blue-700">
                      <DollarSign className="mr-1 h-3 w-3 text-blue-500" />
                      {formatCurrency(teamMembers.reduce((sum, member) => sum + member.cost, 0))}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8 px-4 bg-white">
                <div className="rounded-full h-12 w-12 bg-slate-100 flex items-center justify-center mx-auto mb-2">
                  <Users className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-base font-medium text-slate-700">No hay miembros del equipo asignados</p>
                <p className="text-xs text-slate-500 mt-0.5">Esta cotización no tiene recursos asignados</p>
              </div>
            )}
          </div>

          {/* Historial de Negociación */}
          <NegotiationHistory 
            quotationId={quotation.id} 
            currentPrice={quotation.totalAmount}
            quotationStatus={quotation.status}
            currentTeam={teamMembers.filter(member => member.personnelId).map(member => ({
              personnelId: member.personnelId!,
              roleId: member.roleId || 0,
              estimatedHours: member.hours,
              hourlyRate: member.rate
            }))}
          />
        </div>

        {/* Columna derecha - Resumen financiero */}
        <div className="space-y-5">
          {/* Resumen financiero */}
          <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-1.5 border-b border-slate-200">
              <div className="rounded-full p-1.5 bg-green-50">
                <DollarSign className="text-green-500 h-3.5 w-3.5" />
              </div>
              <h3 className="font-medium text-sm text-slate-800">Resumen Financiero</h3>
            </div>
            
            <div className="divide-y divide-slate-100">
              <div className="px-4 py-3 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 text-sm">Costo base:</span>
                  <span className="font-medium text-slate-800 text-sm">{formatCurrency(quotation.baseCost)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 text-sm">Ajuste complejidad:</span>
                  <span className="font-medium text-slate-800 text-sm">{formatCurrency(quotation.complexityAdjustment)}</span>
                </div>
                
                {quotation.adjustmentReason && (
                  <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded-md border border-slate-200 mt-2">
                    <span className="font-medium block mb-0.5 text-slate-700">Razón del ajuste:</span>
                    {quotation.adjustmentReason}
                  </div>
                )}
              </div>
              
              <div className="px-4 py-3 bg-slate-50">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700 text-sm">Subtotal operacional:</span>
                  <span className="font-bold text-slate-800 text-base">
                    {formatCurrency(calculateOperationalSubtotal())}
                  </span>
                </div>
              </div>
              
              <div className="px-4 py-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 text-sm">Margen aplicado:</span>
                  <span className="font-medium text-slate-800 text-sm">{formatCurrency(quotation.markupAmount)}</span>
                </div>
              </div>

              {(quotation.toolsCost || 0) > 0 && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-slate-600">Herramientas:</span>
                  <span className="font-medium">{formatCurrency(quotation.toolsCost || 0)}</span>
                </div>
              )}
              {(quotation.platformCost || 0) > 0 && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-slate-600">Plataforma:</span>
                  <span className="font-medium">{formatCurrency(quotation.platformCost || 0)}</span>
                </div>
              )}
              {(quotation.additionalDeliverableCost || 0) > 0 && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-slate-600">Entregables adicionales:</span>
                  <span className="font-medium">{formatCurrency(quotation.additionalDeliverableCost || 0)}</span>
                </div>
              )}
              {(quotation.deviationPercentage || 0) > 0 && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-slate-600">Desvío:</span>
                  <span className="font-medium">{quotation.deviationPercentage}%</span>
                </div>
              )}
              {(quotation.discountPercentage || 0) > 0 && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-slate-600">Descuento:</span>
                  <span className="font-medium text-red-600">-{quotation.discountPercentage}%</span>
                </div>
              )}
              {quotation.applyInflationAdjustment && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-slate-600">Proyección inflacionaria:</span>
                  <span className="font-medium">{quotation.manualInflationRate || 0}% anual</span>
                </div>
              )}
              
              <div className="px-4 py-4 bg-green-50 border-t border-green-100">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700 text-sm">TOTAL:</span>
                  <div className="bg-white px-3 py-2 rounded-md shadow-sm border border-green-200">
                    <span className="font-bold text-green-700 text-xl">
                      {formatCurrency(quotation.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-4 py-3 bg-white border-t border-slate-200 flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 flex justify-center items-center gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50 h-8 text-xs"
                onClick={downloadQuotation}
              >
                <Download className="h-3.5 w-3.5" />
                Exportar
              </Button>
              <Button 
                variant="default"
                size="sm"
                className="flex-1 flex justify-center items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                onClick={() => setLocation(`/optimized-quote/${quotationId}`)}
              >
                <Edit className="h-3.5 w-3.5" />
                Editar
              </Button>
            </div>
          </div>
          
          {/* Detalles de contacto del cliente (compacto) */}
          {client && (
            <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <div className="rounded-full p-1.5 bg-amber-50">
                    <Users className="text-amber-500 h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-medium text-sm text-slate-800">Contacto del Cliente</h3>
                </div>
                <Badge variant="secondary" className="bg-amber-50 text-amber-600 text-xs border-amber-100">
                  {client.name}
                </Badge>
              </div>
              
              <div className="p-3">
                <div className="grid grid-cols-1 gap-1.5 text-sm">
                  <div className="flex items-center gap-2 p-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="text-slate-700 truncate">{client.contactName}</span>
                  </div>
                  
                  {client.contactEmail && (
                  <div className="flex items-center gap-2 p-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <a href={`mailto:${client.contactEmail}`} className="text-blue-600 truncate hover:underline text-xs">
                      {client.contactEmail}
                    </a>
                  </div>
                  )}

                  {client.contactPhone && (
                  <div className="flex items-center gap-2 p-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <a href={`tel:${client.contactPhone}`} className="text-slate-700 truncate hover:underline text-xs">
                      {client.contactPhone}
                    </a>
                  </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Rentabilidad real vs cotizada */}
          {profitability?.profitability && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <TrendingUp className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Rentabilidad real vs cotizada</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 px-2 py-4">
                <div className="px-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Horas cotizadas</p>
                  <p className="text-xl font-bold text-slate-900">{profitability.profitability.quotedHours}h</p>
                </div>
                <div className="px-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Horas reales</p>
                  <p className={`text-xl font-bold ${profitability.profitability.realHours > profitability.profitability.quotedHours ? 'text-red-600' : 'text-emerald-600'}`}>
                    {Math.round(profitability.profitability.realHours)}h
                  </p>
                </div>
                <div className="px-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Delta margen</p>
                  <p className={`text-xl font-bold ${profitability.profitability.marginDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {profitability.profitability.marginDelta > 0 ? '+' : ''}{profitability.profitability.marginDelta}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Componente de Variantes de Cotización */}
          <QuotationVariantsDisplay
            quotationId={parseInt(quotationId!)}
            quotationStatus={quotation.status}
            quotationCurrency={quotation.quotationCurrency || 'ARS'}
            baseTotal={quotation.totalAmount}
            onVariantApproved={() => {
              setRefreshKey(k => k + 1);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default QuotationDetail;
