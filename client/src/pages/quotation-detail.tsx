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
    <div className="container py-6 max-w-7xl">
      {/* Encabezado y acciones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 mb-6 bg-white z-10 shadow-sm rounded-xl px-6 py-4 border">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm"
            className="mr-3 rounded-full hover:bg-neutral-100"
            onClick={() => setLocation('/manage-quotes')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{quotation.projectName}</h1>
              {getStatusBadge(quotation.status)}
            </div>
            <div className="flex items-center mt-1 text-neutral-500">
              <p className="flex items-center text-sm">
                <FileText className="h-3.5 w-3.5 mr-1 inline-block" />
                Cotización #{quotation.id}
              </p>
              <span className="mx-2 text-neutral-300">•</span>
              <p className="flex items-center text-sm">
                <Calendar className="h-3.5 w-3.5 mr-1 inline-block" />
                {formatShortDate(quotation.createdAt)}
              </p>
              <span className="mx-2 text-neutral-300">•</span>
              <p className="flex items-center text-sm">
                <Clock className="h-3.5 w-3.5 mr-1 inline-block" />
                {new Date(quotation.createdAt).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3 sm:mt-0">
          <Button variant="outline" size="sm" className="h-9">
            <Printer className="mr-1.5 h-4 w-4" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm" className="h-9">
            <Download className="mr-1.5 h-4 w-4" />
            PDF
          </Button>
          <Button variant="default" size="sm" className="h-9">
            <Edit className="mr-1.5 h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información del proyecto */}
          <Card className="overflow-hidden shadow-sm border border-neutral-200">
            <CardHeader className="bg-white pb-2 border-b border-neutral-100">
              <CardTitle className="text-lg flex items-center">
                <FileCheck className="h-5 w-5 mr-2 text-primary/90" />
                Detalles del Proyecto
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <div className="flex items-start">
                  <Briefcase className="text-primary/70 h-5 w-5 mr-2 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-neutral-500">Tipo de Proyecto</h3>
                    <p className="mt-1 font-medium">{getProjectTypeName(quotation.projectType)}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <FileText className="text-primary/70 h-5 w-5 mr-2 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-neutral-500">Plantilla</h3>
                    <p className="mt-1 font-medium">
                      {template ? template.name : 'Personalizado / Sin Plantilla'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Layers className="text-primary/70 h-5 w-5 mr-2 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-neutral-500">Tipo de Análisis</h3>
                    <p className="mt-1 font-medium">{getAnalysisTypeInfo(quotation.analysisType)}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <PieChart className="text-primary/70 h-5 w-5 mr-2 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-neutral-500">Volumen de Menciones</h3>
                    <p className="mt-1 font-medium">{getMentionsVolumeInfo(quotation.mentionsVolume)}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Globe className="text-primary/70 h-5 w-5 mr-2 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-neutral-500">Países Cubiertos</h3>
                    <p className="mt-1 font-medium">{getCountriesCoveredInfo(quotation.countriesCovered)}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <MessageSquare className="text-primary/70 h-5 w-5 mr-2 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-neutral-500">Interacción con Cliente</h3>
                    <p className="mt-1 font-medium">{getClientEngagementInfo(quotation.clientEngagement)}</p>
                  </div>
                </div>
              </div>

              {quotation.templateCustomization && (
                <div className="mt-6">
                  <Separator className="mb-4" />
                  <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                    <h3 className="text-sm font-medium text-neutral-700 mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-1.5 text-primary/70" />
                      Personalización / Notas
                    </h3>
                    <p className="text-sm whitespace-pre-line text-neutral-700">{quotation.templateCustomization}</p>
                  </div>
                </div>
              )}
              
              {quotation.additionalNotes && (
                <div className="mt-4">
                  <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                    <h3 className="text-sm font-medium text-neutral-700 mb-2 flex items-center">
                      <MessageSquare className="h-4 w-4 mr-1.5 text-primary/70" />
                      Notas Adicionales
                    </h3>
                    <p className="text-sm whitespace-pre-line text-neutral-700">{quotation.additionalNotes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabla de miembros del equipo */}
          <Card className="overflow-hidden shadow-sm border border-neutral-200">
            <CardHeader className="bg-white pb-2 border-b border-neutral-100">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center">
                  <Users className="h-5 w-5 mr-2 text-primary/90" />
                  Equipo del Proyecto
                </CardTitle>
                <Badge variant="outline" className="ml-2 font-semibold">
                  {teamMembers.length} miembros
                </Badge>
              </div>
              <CardDescription>
                Detalle de los recursos asignados a este proyecto
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {teamMembers.length > 0 ? (
                <div className="overflow-auto" style={{ maxHeight: '350px' }}>
                  <Table>
                    <TableHeader className="bg-neutral-50">
                      <TableRow>
                        <TableHead className="font-semibold">Rol</TableHead>
                        <TableHead className="font-semibold">Persona</TableHead>
                        <TableHead className="text-right font-semibold">Horas</TableHead>
                        <TableHead className="text-right font-semibold">Tarifa</TableHead>
                        <TableHead className="text-right font-semibold">Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member: TeamMember) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{getRoleName(member.personnelId)}</TableCell>
                          <TableCell>{getPersonnelName(member.personnelId)}</TableCell>
                          <TableCell className="text-right">{member.hours}</TableCell>
                          <TableCell className="text-right">{formatCurrency(member.rate)}</TableCell>
                          <TableCell className="text-right font-medium text-primary-700">{formatCurrency(member.cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center text-neutral-500 py-12 px-4 bg-neutral-50/50">
                  <Users className="h-12 w-12 mx-auto text-neutral-300 mb-2" />
                  <p className="text-lg font-medium">No hay miembros del equipo asignados</p>
                  <p className="text-sm text-neutral-500 mt-1">Esta cotización no tiene recursos asignados</p>
                </div>
              )}
              
              {teamMembers.length > 0 && (
                <div className="px-6 py-4 bg-neutral-50 border-t">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-neutral-500">
                        Total de horas asignadas:
                      </p>
                      <p className="text-xl font-bold mt-0.5">
                        {teamMembers.reduce((sum, member) => sum + member.hours, 0)} horas
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-neutral-500">
                        Total equipo:
                      </p>
                      <p className="text-xl font-bold mt-0.5 text-primary-700">
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
        <div className="space-y-6">
          {/* Información del cliente */}
          <Card className="overflow-hidden shadow-sm border border-neutral-200">
            <CardHeader className="bg-white pb-2 border-b border-neutral-100">
              <CardTitle className="text-lg flex items-center">
                <Building className="h-5 w-5 mr-2 text-primary/90" />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {client && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-xl text-neutral-800">{client.name}</h3>
                    <Badge variant="secondary" className="ml-2">Cliente</Badge>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-neutral-500 mr-2" />
                      <span className="text-neutral-700 font-medium">{client.contactName}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-neutral-500 mr-2" />
                      <a href={`mailto:${client.contactEmail}`} className="text-blue-600 hover:underline">
                        {client.contactEmail}
                      </a>
                    </div>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-neutral-500 mr-2" />
                      <a href={`tel:${client.contactPhone}`} className="text-neutral-700 hover:underline">
                        {client.contactPhone}
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumen financiero */}
          <Card className="overflow-hidden shadow-sm border border-neutral-200">
            <CardHeader className="bg-white pb-2 border-b border-neutral-100">
              <CardTitle className="text-lg flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-primary/90" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Costo base:</span>
                  <span className="font-medium">{formatCurrency(quotation.baseCost)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Ajuste complejidad:</span>
                  <span className="font-medium">{formatCurrency(quotation.complexityAdjustment)}</span>
                </div>
                
                {quotation.adjustmentReason && (
                  <div className="text-xs text-neutral-500 p-2 bg-neutral-50 rounded-md border ml-4">
                    <span className="font-medium block mb-1">Razón del ajuste:</span>
                    {quotation.adjustmentReason}
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between items-center py-1">
                  <span className="font-medium text-neutral-800">Subtotal operacional:</span>
                  <span className="font-semibold text-lg">
                    {formatCurrency(calculateOperationalSubtotal())}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Margen aplicado:</span>
                  <span className="font-medium">{formatCurrency(quotation.markupAmount)}</span>
                </div>
                
                <Separator />
                
                <div className="bg-primary/5 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-neutral-800 text-lg">TOTAL:</span>
                    <span className="font-bold text-primary-900 text-2xl">
                      {formatCurrency(quotation.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-neutral-50 border-t pt-4 pb-3 gap-3 flex-wrap">
              <Button variant="outline" className="w-full flex justify-center items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar Presupuesto
              </Button>
              <Button variant="default" className="w-full flex justify-center items-center gap-2">
                <Edit className="h-4 w-4" />
                Editar Cotización
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuotationDetail;