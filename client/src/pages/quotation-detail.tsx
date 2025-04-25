import React, { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Printer, Mail, Edit, FileCheck, FileClock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Personnel, Role } from '@shared/schema';

// Interfaces
interface QuotationDetailProps {}

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

const QuotationDetail: React.FC<QuotationDetailProps> = () => {
  const [, params] = useRoute<{ id: string }>('/quotation/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const quotationId = params?.id;
    if (!quotationId) {
      toast({
        title: "Error",
        description: "ID de cotización no válido",
        variant: "destructive",
      });
      setLocation('/manage-quotes');
      return;
    }

    const fetchQuotationData = async () => {
      try {
        setLoading(true);
        
        // Cargar datos principales de la cotización
        const quotationData = await apiRequest(`/api/quotations/${quotationId}`);
        setQuotation(quotationData);
        
        // Cargar miembros del equipo
        const teamData = await apiRequest(`/api/quotation-team/${quotationId}`);
        setTeamMembers(teamData);
        
        // Cargar datos del cliente
        if (quotationData.clientId) {
          const clientData = await apiRequest(`/api/clients/${quotationData.clientId}`);
          setClient(clientData);
        }
        
        // Cargar datos de la plantilla si existe
        if (quotationData.templateId) {
          const templateData = await apiRequest(`/api/templates/${quotationData.templateId}`);
          setTemplate(templateData);
        }
        
        // Cargar catálogos para mapear IDs a nombres
        const rolesData = await apiRequest('/api/roles');
        setRoles(rolesData);
        
        const personnelData = await apiRequest('/api/personnel');
        setPersonnel(personnelData);
        
      } catch (error) {
        console.error("Error al cargar datos de la cotización:", error);
        toast({
          title: "Error de carga",
          description: "No se pudieron cargar los detalles de la cotización",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchQuotationData();
  }, [params, toast, setLocation]);

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

  if (loading) {
    return (
      <div className="container py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-xl text-neutral-500">Cargando detalles de la cotización...</div>
        </div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="container py-10">
        <div className="flex flex-col items-center justify-center h-64">
          <h2 className="text-xl font-semibold text-neutral-800 mb-4">Cotización no encontrada</h2>
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
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead>Rol</TableHead>
                        <TableHead>Personal</TableHead>
                        <TableHead className="text-right">Horas</TableHead>
                        <TableHead className="text-right">Tarifa</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{getRoleName(member.personnelId)}</TableCell>
                          <TableCell>{getPersonnelName(member.personnelId)}</TableCell>
                          <TableCell className="text-right">{member.hours}</TableCell>
                          <TableCell className="text-right">{formatCurrency(member.rate)}/h</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(member.cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-neutral-500">No hay miembros del equipo asignados a esta cotización.</p>
              )}
              
              {teamMembers.length > 0 && (
                <div className="mt-4 flex justify-between items-center px-4 py-2 bg-neutral-50 rounded-md">
                  <span className="font-medium">Total horas:</span>
                  <span className="font-medium">{teamMembers.reduce((sum, member) => sum + member.hours, 0)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          {/* Desglose de costos */}
          <Card className="bg-white shadow-md">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-lg">Resumen Financiero</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Costo Base:</span>
                  <span className="font-medium">{formatCurrency(quotation.baseCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Ajuste Complejidad:</span>
                  <span className="font-medium">{formatCurrency(quotation.complexityAdjustment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Margen Operativo:</span>
                  <span className="font-medium">{formatCurrency(quotation.markupAmount)}</span>
                </div>
                
                {/* Sección ajustes */}
                {quotation.adjustmentReason && (
                  <div className="pt-4 mt-4 border-t border-dashed">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-neutral-500">Ajustes aplicados:</span>
                      <span className="text-neutral-500">{quotation.adjustmentReason}</span>
                    </div>
                  </div>
                )}
                
                {/* Total */}
                <div className="pt-4 mt-2 border-t flex justify-between items-center">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-xl font-bold text-blue-700">{formatCurrency(quotation.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información del cliente */}
          {client && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Información del Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-neutral-500">Nombre</h3>
                    <p className="mt-1">{client.name}</p>
                  </div>
                  {client.contactName && (
                    <div>
                      <h3 className="text-sm font-medium text-neutral-500">Contacto</h3>
                      <p className="mt-1">{client.contactName}</p>
                    </div>
                  )}
                  {client.contactEmail && (
                    <div>
                      <h3 className="text-sm font-medium text-neutral-500">Email</h3>
                      <p className="mt-1">{client.contactEmail}</p>
                    </div>
                  )}
                  {client.contactPhone && (
                    <div>
                      <h3 className="text-sm font-medium text-neutral-500">Teléfono</h3>
                      <p className="mt-1">{client.contactPhone}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Acciones adicionales */}
          <div className="space-y-3">
            <Button className="w-full justify-start text-left">
              <Mail className="mr-2 h-4 w-4" />
              Enviar al Cliente
            </Button>
            <Button variant="outline" className="w-full justify-start text-left">
              <Edit className="mr-2 h-4 w-4" />
              Duplicar Cotización
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationDetail;