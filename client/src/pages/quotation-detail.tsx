import React, { useState, useEffect } from 'react';
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
  MessageSquare, FileText, Layers, PieChart 
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Interfaces
interface TeamMember {
  id: number;
  quotationId: number;
  personnelId: number;
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
  totalAmount: number;
  status: string;
  adjustmentReason: string;
  additionalNotes: string;
  createdAt: string;
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

  // Cargar los datos de la cotización
  useEffect(() => {
    if (!quotationId) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Obtener cotización
        const quotationRes = await fetch(`/api/quotations/${quotationId}`);
        if (!quotationRes.ok) throw new Error('Error al cargar la cotización');
        const quotationData = await quotationRes.json();
        setQuotation(quotationData);
        
        // Obtener equipo
        const teamRes = await fetch(`/api/quotation-team/${quotationId}`);
        if (!teamRes.ok) throw new Error('Error al cargar el equipo');
        const teamData = await teamRes.json();
        setTeamMembers(teamData);
        
        // Obtener datos del cliente
        if (quotationData.clientId) {
          const clientRes = await fetch(`/api/clients/${quotationData.clientId}`);
          if (!clientRes.ok) throw new Error('Error al cargar el cliente');
          const clientData = await clientRes.json();
          setClient(clientData);
        }
        
        // Obtener datos de la plantilla
        if (quotationData.templateId) {
          const templateRes = await fetch(`/api/templates/${quotationData.templateId}`);
          if (templateRes.ok) {
            const templateData = await templateRes.json();
            setTemplate(templateData);
          }
        }
        
        // Obtener roles
        const rolesRes = await fetch('/api/roles');
        if (!rolesRes.ok) throw new Error('Error al cargar roles');
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
        
        // Obtener personal
        const personnelRes = await fetch('/api/personnel');
        if (!personnelRes.ok) throw new Error('Error al cargar personal');
        const personnelData = await personnelRes.json();
        setPersonnel(personnelData);
        
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
  }, [quotationId, toast]);

  // Si no hay ID válido, redireccionar
  if (!quotationId) {
    toast({
      title: "Error",
      description: "ID de cotización no válido",
      variant: "destructive",
    });
    setLocation('/manage-quotes');
    return null;
  }

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
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
  const getPersonnelName = (id: number) => {
    const person = personnel.find(p => p.id === id);
    return person ? person.name : `Personal ID: ${id}`;
  };

  // Obtener nombre de rol por ID
  const getRoleName = (personnelId: number) => {
    const person = personnel.find(p => p.id === personnelId);
    if (!person) return 'Rol no encontrado';
    
    const role = roles.find(r => r.id === person.roleId);
    return role ? role.name : `Rol ID: ${person.roleId}`;
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
      'custom': 'Personalizado'
    };
    
    return projectTypes[type] || type;
  };

  // Mapear estado a nombre y color
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, {label: string, variant: "default" | "secondary" | "destructive" | "outline"}> = {
      'draft': { label: 'Borrador', variant: 'outline' },
      'pending': { label: 'Pendiente', variant: 'secondary' },
      'approved': { label: 'Aprobada', variant: 'default' },
      'rejected': { label: 'Rechazada', variant: 'destructive' }
    };
    
    const config = statusConfig[status] || { label: status, variant: 'outline' };
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
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
    <div className="container py-5 max-w-7xl bg-[#f5f7ff]">
      {/* Encabezado y acciones - más compacto */}
      <div className="flex justify-between items-center mb-5 bg-white z-10 shadow-sm rounded-lg px-4 py-3 border border-indigo-100">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            className="rounded-full h-8 w-8 p-0 hover:bg-indigo-50"
            onClick={() => setLocation('/manage-quotes')}
          >
            <ArrowLeft className="h-4 w-4 text-indigo-700" />
          </Button>
          
          <h1 className="text-lg font-bold text-indigo-950">{quotation.projectName}</h1>
          {getStatusBadge(quotation.status)}
          
          <div className="text-indigo-600 text-xs ml-2 hidden md:block">
            <span className="flex items-center">
              <FileText className="h-3 w-3 mr-1 inline-block" />
              #{quotation.id} • {formatShortDate(quotation.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-8 px-2 border-indigo-200 text-indigo-700">
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-2 border-indigo-200 text-indigo-700">
            <Download className="h-4 w-4" />
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="h-8 px-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Columna izquierda */}
        <div className="lg:col-span-2 space-y-5">
          {/* Detalles del proyecto - más compacto en grid */}
          <Card className="overflow-hidden shadow-sm border-0">
            <CardHeader className="bg-white py-2 px-4 border-b border-indigo-100 relative">
              <div className="absolute inset-y-0 left-0 w-1 bg-indigo-600"></div>
              <CardTitle className="text-sm flex items-center pl-2 text-indigo-800">
                <FileCheck className="h-4 w-4 mr-1.5 text-indigo-600" />
                Detalles del Proyecto
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Briefcase className="text-indigo-600 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs text-indigo-400">Tipo de Proyecto</p>
                    <p className="font-medium text-indigo-900 truncate">{getProjectTypeName(quotation.projectType)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <FileText className="text-indigo-600 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs text-indigo-400">Plantilla</p>
                    <p className="font-medium text-indigo-900 truncate">
                      {template ? template.name : 'Personalizado'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Layers className="text-indigo-600 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs text-indigo-400">Tipo de Análisis</p>
                    <p className="font-medium text-indigo-900 truncate">{getAnalysisTypeInfo(quotation.analysisType)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <PieChart className="text-indigo-600 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs text-indigo-400">Volumen</p>
                    <p className="font-medium text-indigo-900 truncate">{getMentionsVolumeInfo(quotation.mentionsVolume)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Globe className="text-indigo-600 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs text-indigo-400">Países</p>
                    <p className="font-medium text-indigo-900 truncate">{getCountriesCoveredInfo(quotation.countriesCovered)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <MessageSquare className="text-indigo-600 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs text-indigo-400">Interacción</p>
                    <p className="font-medium text-indigo-900 truncate">{getClientEngagementInfo(quotation.clientEngagement)}</p>
                  </div>
                </div>
              </div>

              {(quotation.templateCustomization || quotation.additionalNotes) && (
                <div className="mt-4 bg-indigo-50/50 p-3 rounded-md border border-indigo-100 text-sm">
                  {quotation.templateCustomization && (
                    <div className="mb-2">
                      <h3 className="text-xs font-semibold text-indigo-700 mb-1 flex items-center">
                        <FileText className="h-3 w-3 mr-1 text-indigo-500" />
                        Personalización
                      </h3>
                      <p className="text-xs text-indigo-900 line-clamp-2">{quotation.templateCustomization}</p>
                    </div>
                  )}
                  
                  {quotation.additionalNotes && (
                    <div>
                      <h3 className="text-xs font-semibold text-indigo-700 mb-1 flex items-center">
                        <MessageSquare className="h-3 w-3 mr-1 text-indigo-500" />
                        Notas
                      </h3>
                      <p className="text-xs text-indigo-900 line-clamp-2">{quotation.additionalNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabla de miembros del equipo */}
          <Card className="overflow-hidden shadow-md border-0">
            <CardHeader className="bg-white py-2 px-4 border-b border-indigo-100 relative">
              <div className="absolute inset-y-0 left-0 w-1 bg-indigo-600"></div>
              <div className="flex justify-between items-center pl-2">
                <CardTitle className="text-sm flex items-center text-indigo-800">
                  <Users className="h-4 w-4 mr-1.5 text-indigo-600" />
                  Equipo del Proyecto
                </CardTitle>
                <Badge variant="outline" className="ml-2 text-xs font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">
                  {teamMembers.length} miembros
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {teamMembers.length > 0 ? (
                <div className="overflow-auto" style={{ maxHeight: '400px' }}>
                  <Table>
                    <TableHeader className="bg-indigo-50/80">
                      <TableRow className="border-b border-indigo-100">
                        <TableHead className="font-semibold text-indigo-700 text-xs py-2">Rol</TableHead>
                        <TableHead className="font-semibold text-indigo-700 text-xs py-2">Persona</TableHead>
                        <TableHead className="text-right font-semibold text-indigo-700 text-xs py-2">Horas</TableHead>
                        <TableHead className="text-right font-semibold text-indigo-700 text-xs py-2">Tarifa</TableHead>
                        <TableHead className="text-right font-semibold text-indigo-700 text-xs py-2">Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member: TeamMember, index: number) => (
                        <TableRow 
                          key={member.id}
                          className={cn(
                            "transition-colors hover:bg-indigo-50/50",
                            index % 2 === 0 ? "bg-white" : "bg-indigo-50/20"
                          )}
                        >
                          <TableCell className="font-medium text-indigo-900 py-2 text-sm">{getRoleName(member.personnelId)}</TableCell>
                          <TableCell className="text-indigo-700 py-2 text-sm">{getPersonnelName(member.personnelId)}</TableCell>
                          <TableCell className="text-right font-medium text-indigo-800 py-2 text-sm">{member.hours}</TableCell>
                          <TableCell className="text-right text-indigo-700 py-2 text-sm">{formatCurrency(member.rate)}</TableCell>
                          <TableCell className="text-right font-bold text-indigo-800 py-2 text-sm">{formatCurrency(member.cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center text-indigo-500 py-8 px-4 bg-gradient-to-b from-white to-indigo-50/30 rounded-b-lg">
                  <div className="rounded-full h-12 w-12 bg-indigo-100 flex items-center justify-center mx-auto mb-2">
                    <Users className="h-6 w-6 text-indigo-400" />
                  </div>
                  <p className="text-base font-semibold text-indigo-700">No hay miembros del equipo asignados</p>
                  <p className="text-xs text-indigo-500 mt-0.5">Esta cotización no tiene recursos asignados</p>
                </div>
              )}
              
              {teamMembers.length > 0 && (
                <div className="py-3 px-4 bg-gradient-to-br from-indigo-600 to-indigo-700 border-t border-indigo-500 rounded-b-lg text-white">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-medium text-indigo-200">
                        Total de horas asignadas:
                      </p>
                      <p className="text-base font-bold mt-0.5 flex items-center">
                        <Clock className="mr-1 h-3 w-3 text-indigo-300" />
                        {teamMembers.reduce((sum, member) => sum + member.hours, 0)} horas
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-indigo-200">
                        Total equipo:
                      </p>
                      <p className="text-base font-bold mt-0.5 flex items-center justify-end">
                        <DollarSign className="mr-1 h-3 w-3 text-indigo-300" />
                        {formatCurrency(teamMembers.reduce((sum, member) => sum + member.cost, 0))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-5">
          {/* Información del cliente - más compacta */}
          <Card className="overflow-hidden shadow-sm border-0">
            <CardHeader className="bg-white py-2 px-4 border-b border-indigo-100 relative">
              <div className="absolute inset-y-0 left-0 w-1 bg-indigo-600"></div>
              <CardTitle className="text-sm flex items-center pl-2 text-indigo-800">
                <Building className="h-4 w-4 mr-1.5 text-indigo-600" />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {client && (
                <div>
                  <div className="bg-white rounded-lg shadow-sm p-3 border border-indigo-100 mb-3">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-2 shrink-0">
                        <Building className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-indigo-950">{client.name}</h3>
                        <Badge variant="secondary" className="mt-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-xs">
                          Cliente
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors">
                      <Users className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span className="text-indigo-950 truncate">{client.contactName}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors">
                      <Mail className="h-4 w-4 text-indigo-600 shrink-0" />
                      <a href={`mailto:${client.contactEmail}`} className="text-indigo-700 truncate hover:underline">
                        {client.contactEmail}
                      </a>
                    </div>
                    
                    <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors">
                      <Phone className="h-4 w-4 text-indigo-600 shrink-0" />
                      <a href={`tel:${client.contactPhone}`} className="text-indigo-900 truncate hover:underline">
                        {client.contactPhone}
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumen financiero */}
          <Card className="overflow-hidden shadow-md border-0">
            <CardHeader className="bg-white py-2 px-4 border-b border-indigo-100 relative">
              <div className="absolute inset-y-0 left-0 w-1 bg-indigo-600"></div>
              <CardTitle className="text-sm flex items-center pl-2 text-indigo-800">
                <DollarSign className="h-4 w-4 mr-1.5 text-indigo-600" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="bg-white">
                <div className="p-3 space-y-2 border-b border-indigo-50">
                  <div className="flex justify-between items-center p-1.5 hover:bg-indigo-50 rounded transition-colors">
                    <span className="text-indigo-700 flex items-center text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5"></div>
                      Costo base:
                    </span>
                    <span className="font-medium text-indigo-900 text-sm">{formatCurrency(quotation.baseCost)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-1.5 hover:bg-indigo-50 rounded transition-colors">
                    <span className="text-indigo-700 flex items-center text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5"></div>
                      Ajuste complejidad:
                    </span>
                    <span className="font-medium text-indigo-900 text-sm">{formatCurrency(quotation.complexityAdjustment)}</span>
                  </div>
                  
                  {quotation.adjustmentReason && (
                    <div className="ml-3 text-xs text-indigo-700 p-2 bg-indigo-50 rounded-md border border-indigo-200 text-xs">
                      <span className="font-medium block mb-0.5 text-indigo-800">Razón del ajuste:</span>
                      {quotation.adjustmentReason}
                    </div>
                  )}
                </div>
                
                <div className="bg-indigo-50/80 p-3 border-b border-indigo-100">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-indigo-800 text-sm">Subtotal operacional:</span>
                    <span className="font-semibold text-base text-indigo-900">
                      {formatCurrency(calculateOperationalSubtotal())}
                    </span>
                  </div>
                </div>
                
                <div className="p-3 border-b border-indigo-50">
                  <div className="flex justify-between items-center p-1.5 hover:bg-indigo-50 rounded transition-colors">
                    <span className="text-indigo-700 flex items-center text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5"></div>
                      Margen aplicado:
                    </span>
                    <span className="font-medium text-indigo-900 text-sm">{formatCurrency(quotation.markupAmount)}</span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 p-4 text-white">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-sm">TOTAL:</span>
                    <div className="bg-white text-indigo-800 px-3 py-1.5 rounded-md shadow-sm">
                      <span className="font-bold text-xl">
                        {formatCurrency(quotation.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-indigo-50 border-t border-indigo-100 py-3 px-4 gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                className="w-full flex justify-center items-center gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 h-8 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar
              </Button>
              <Button 
                variant="default"
                size="sm"
                className="w-full flex justify-center items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs"
              >
                <Edit className="h-3.5 w-3.5" />
                Editar
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuotationDetail;