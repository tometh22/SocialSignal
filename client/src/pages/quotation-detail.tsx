import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Printer, Edit, FileCheck, FileClock, Loader2 } from 'lucide-react';

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
    <div className="container py-6">
      {/* Encabezado y acciones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-6 sticky top-0 bg-white z-10">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm"
            className="mr-2"
            onClick={() => setLocation('/manage-quotes')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-xl font-bold">{quotation.projectName}</h1>
            <div className="flex items-center mt-1">
              <p className="text-sm text-neutral-500 mr-2">Cotización #{quotation.id}</p>
              {getStatusBadge(quotation.status)}
              <span className="mx-2 text-neutral-300">•</span>
              <p className="text-sm text-neutral-500">{formatDate(quotation.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3 sm:mt-0">
          <Button variant="outline" size="sm" className="h-8">
            <Printer className="mr-1 h-4 w-4" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            <Download className="mr-1 h-4 w-4" />
            PDF
          </Button>
          <Button variant="default" size="sm" className="h-8">
            <Edit className="mr-1 h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="md:col-span-2 space-y-6">
          {/* Información del proyecto */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <FileCheck className="h-5 w-5 mr-2 text-blue-600" />
                Detalles del Proyecto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Tipo de Proyecto</h3>
                  <p className="mt-1">{getProjectTypeName(quotation.projectType)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Plantilla</h3>
                  <p className="mt-1">
                    {template ? template.name : 'Personalizado / Sin Plantilla'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Tipo de Análisis</h3>
                  <p className="mt-1">{getAnalysisTypeInfo(quotation.analysisType)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Volumen de Menciones</h3>
                  <p className="mt-1">{getMentionsVolumeInfo(quotation.mentionsVolume)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Países Cubiertos</h3>
                  <p className="mt-1">{getCountriesCoveredInfo(quotation.countriesCovered)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Interacción con Cliente</h3>
                  <p className="mt-1">{getClientEngagementInfo(quotation.clientEngagement)}</p>
                </div>
              </div>

              {quotation.templateCustomization && (
                <div className="mt-6 bg-neutral-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-neutral-500 mb-2">Personalización / Notas</h3>
                  <p className="text-sm whitespace-pre-line">{quotation.templateCustomization}</p>
                </div>
              )}
              
              {quotation.additionalNotes && (
                <div className="mt-4 bg-neutral-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-neutral-500 mb-2">Notas Adicionales</h3>
                  <p className="text-sm whitespace-pre-line">{quotation.additionalNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabla de miembros del equipo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <FileClock className="h-5 w-5 mr-2 text-blue-600" />
                Equipo del Proyecto
              </CardTitle>
              <CardDescription>
                Miembros del equipo asignados ({teamMembers.length})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamMembers.length > 0 ? (
                <div className="overflow-auto border rounded-md" style={{ maxHeight: '300px' }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rol</TableHead>
                        <TableHead>Persona</TableHead>
                        <TableHead className="text-right">Horas</TableHead>
                        <TableHead className="text-right">Tarifa</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member: TeamMember) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{getRoleName(member.personnelId)}</TableCell>
                          <TableCell>{getPersonnelName(member.personnelId)}</TableCell>
                          <TableCell className="text-right">{member.hours}</TableCell>
                          <TableCell className="text-right">{formatCurrency(member.rate)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(member.cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center text-neutral-500 py-6">
                  No hay miembros del equipo asignados a esta cotización
                </div>
              )}
              
              {teamMembers.length > 0 && (
                <div className="mt-4 text-right">
                  <p className="text-sm font-medium text-neutral-500">
                    Total de horas: <span className="font-bold">{teamMembers.reduce((sum, member) => sum + member.hours, 0)}</span>
                  </p>
                  <p className="font-medium">
                    Total del equipo: <span className="font-bold">{formatCurrency(teamMembers.reduce((sum, member) => sum + member.cost, 0))}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          {/* Información del cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {client && (
                  <>
                    <h3 className="font-bold text-lg">{client.name}</h3>
                    <div className="text-sm">
                      <p className="text-neutral-500">Contacto: {client.contactName}</p>
                      <p className="text-neutral-500">Email: {client.contactEmail}</p>
                      <p className="text-neutral-500">Teléfono: {client.contactPhone}</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resumen financiero */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen Financiero</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Costo base:</span>
                  <span>{formatCurrency(quotation.baseCost)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Ajuste complejidad:</span>
                  <span>{formatCurrency(quotation.complexityAdjustment)}</span>
                </div>
                
                {quotation.adjustmentReason && (
                  <div className="text-xs text-neutral-500 italic pl-4">
                    Razón: {quotation.adjustmentReason}
                  </div>
                )}
                
                <div className="border-t border-b py-2 my-2">
                  <div className="flex justify-between items-center font-medium">
                    <span>Subtotal operacional:</span>
                    <span>
                      {formatCurrency(quotation.baseCost + quotation.complexityAdjustment)}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Margen:</span>
                  <span>{formatCurrency(quotation.markupAmount)}</span>
                </div>
                
                <div className="mt-4 border-t pt-3">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(quotation.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Acciones adicionales */}
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full justify-start">
              <Edit className="mr-2 h-4 w-4" />
              Editar Cotización
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationDetail;