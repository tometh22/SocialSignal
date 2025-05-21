import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { 
  ArrowLeftIcon, 
  Calendar, 
  ChevronsUpDown, 
  Clock, 
  DollarSign,
  MoreHorizontal, 
  Repeat, 
  Sparkles, 
  Users 
} from 'lucide-react';
import { AlwaysOnProjectSummary, Entregable, Equipo } from '@/components/projects/AlwaysOnProjectSummary';
import { DeliverableConfig, Deliverable } from '@/components/projects/DeliverableConfig';
import { Link } from 'wouter';

const AlwaysOnProjectView = () => {
  const [, params] = useRoute('/always-on-project/:projectId');
  const projectId = params?.projectId;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [additionalCost, setAdditionalCost] = useState<number>(0);

  // Consulta del proyecto
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/projects/${projectId}`, 'GET');
      } catch (err) {
        console.error("Error fetching project:", err);
        throw err;
      }
    },
    enabled: !!projectId
  });

  // Consulta de entregables
  const { data: projectDeliverables, isLoading: deliverablesLoading } = useQuery({
    queryKey: ['/api/deliverables', projectId],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/deliverables/project/${projectId}`, 'GET');
      } catch (err) {
        console.error("Error fetching deliverables:", err);
        return [];
      }
    },
    enabled: !!projectId
  });

  // Consulta de equipo
  const { data: projectTeam, isLoading: teamLoading } = useQuery({
    queryKey: ['/api/project-team', projectId],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/projects/${projectId}/team`, 'GET');
      } catch (err) {
        console.error("Error fetching team:", err);
        return [];
      }
    },
    enabled: !!projectId
  });

  // Cargar datos en el estado local para edición
  useEffect(() => {
    if (projectDeliverables) {
      const formattedDeliverables = projectDeliverables.map((d: any) => ({
        id: d.id.toString(),
        type: d.deliverable_type || 'report',
        frequency: d.frequency || 'monthly',
        description: d.name,
        budget: d.specific_budget || 0
      }));
      
      setDeliverables(formattedDeliverables);
    }
  }, [projectDeliverables]);

  // Actualizar proyecto y entregables
  const updateProjectMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/projects/${projectId}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Proyecto actualizado",
        description: "Los cambios se han guardado correctamente",
      });
      setEditMode(false);
    },
    onError: (error) => {
      toast({
        title: "Error al actualizar",
        description: "No se pudieron guardar los cambios",
        variant: "destructive"
      });
    }
  });

  // Guardar entregables
  const saveDeliverablesMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/deliverables/project/${projectId}`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deliverables'] });
    }
  });

  // Transformar entregables para la vista
  const mapToEntregables = (deliverables: Deliverable[]): Entregable[] => {
    return deliverables.map(d => ({
      id: d.id,
      tipo: d.type,
      frecuencia: d.frequency,
      descripcion: d.description,
      presupuesto: d.budget
    }));
  };

  // Transformar equipo para la vista
  const mapToEquipo = (team: any[]): Equipo[] => {
    if (!team || !Array.isArray(team)) return [];
    
    return team.map(member => ({
      nombre: member.name || member.personnel?.firstName || 'Miembro',
      rol: member.role?.name || member.roleName || 'Analista',
      horas: member.hours || 0,
      tarifa: member.rate || 0
    }));
  };

  const handleSaveChanges = async () => {
    // Guardar entregables
    const deliverablesData = deliverables.map(d => ({
      name: d.description,
      deliverable_type: d.type,
      frequency: d.frequency,
      specific_budget: d.budget,
      project_id: Number(projectId)
    }));

    await saveDeliverablesMutation.mutateAsync({
      deliverables: deliverablesData,
      additionalCost
    });

    // Actualizar proyecto como Always-On
    await updateProjectMutation.mutateAsync({
      isAlwaysOnProject: true,
      additional_cost: additionalCost
    });
  };

  if (isLoading) {
    return (
      <div className="container py-6 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container py-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No se pudo cargar la información del proyecto.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Link href="/active-projects">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                Volver
              </Button>
            </Link>
            <Badge className="bg-blue-500">{project.status}</Badge>
            {project.isAlwaysOnProject && (
              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                Always-On
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">
            Cliente: {project.client?.name} • Inicio: {new Date(project.startDate).toLocaleDateString()}
          </p>
        </div>
        <div className="space-x-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveChanges} disabled={saveDeliverablesMutation.isPending}>
                {saveDeliverablesMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditMode(true)}>
              Editar proyecto
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="deliverables">Entregables</TabsTrigger>
          <TabsTrigger value="team">Equipo</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {!editMode ? (
            <AlwaysOnProjectSummary
              cliente={project.client?.name || 'Cliente'}
              proyecto={project.name}
              fechaInicio={new Date(project.startDate).toLocaleDateString()}
              presupuestoMensual={project.budget || 0}
              entregables={projectDeliverables ? mapToEntregables(deliverables) : []}
              equipo={projectTeam ? mapToEquipo(projectTeam) : []}
              costoAdicional={project.additional_cost || additionalCost}
            />
          ) : (
            <Alert className="bg-amber-50 border-amber-200">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <AlertTitle>Modo de edición activo</AlertTitle>
              <AlertDescription>
                Estás editando este proyecto Always-On. Navega a la pestaña de Entregables para 
                configurar los diferentes entregables y sus frecuencias.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="deliverables" className="space-y-6">
          {editMode ? (
            <DeliverableConfig
              deliverables={deliverables}
              onChange={setDeliverables}
              additionalCost={additionalCost}
              onAdditionalCostChange={setAdditionalCost}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Entregables del Proyecto</CardTitle>
                <CardDescription>
                  Listado de entregables configurados para este proyecto Always-On
                </CardDescription>
              </CardHeader>
              <CardContent>
                {deliverablesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : deliverables.length > 0 ? (
                  <div className="space-y-4">
                    {deliverables.map((deliverable) => (
                      <div key={deliverable.id} className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex justify-between">
                          <div className="space-y-1">
                            <h4 className="font-medium">{deliverable.description}</h4>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">
                                {deliverable.type === 'report' 
                                  ? 'Informe' 
                                  : deliverable.type === 'analysis' 
                                  ? 'Análisis' 
                                  : deliverable.type === 'monitoring' 
                                  ? 'Monitoreo' 
                                  : deliverable.type === 'dashboard' 
                                  ? 'Dashboard' 
                                  : 'Personalizado'}
                              </Badge>
                              <Badge variant="secondary">
                                {deliverable.frequency === 'weekly' 
                                  ? 'Semanal' 
                                  : deliverable.frequency === 'biweekly' 
                                  ? 'Quincenal' 
                                  : deliverable.frequency === 'monthly' 
                                  ? 'Mensual' 
                                  : deliverable.frequency === 'quarterly' 
                                  ? 'Trimestral' 
                                  : 'Personalizado'}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">{formatCurrency(deliverable.budget)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No hay entregables configurados. Activa el modo de edición para añadir entregables.</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Equipo del Proyecto</CardTitle>
              <CardDescription>
                Miembros asignados y sus horas mensuales
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : projectTeam && projectTeam.length > 0 ? (
                <div className="space-y-4">
                  {projectTeam.map((member: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg bg-muted/30">
                      <div className="flex justify-between">
                        <div className="space-y-1">
                          <h4 className="font-medium">{member.personnel?.firstName || 'Miembro'} {member.personnel?.lastName || ''}</h4>
                          <div className="text-sm text-muted-foreground">{member.role?.name || 'Rol no especificado'}</div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex items-center justify-end space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{member.hours} horas/mes</span>
                          </div>
                          <div className="text-sm text-muted-foreground">${member.rate}/hora</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No hay miembros asignados a este proyecto.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Métricas y Rendimiento</CardTitle>
              <CardDescription>
                Indicadores clave de desempeño
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex flex-col items-center text-center">
                    <DollarSign className="h-8 w-8 text-primary mb-2" />
                    <div className="text-sm text-muted-foreground">Presupuesto Mensual</div>
                    <div className="text-2xl font-bold">{formatCurrency(project.budget || 0)}</div>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex flex-col items-center text-center">
                    <Repeat className="h-8 w-8 text-primary mb-2" />
                    <div className="text-sm text-muted-foreground">Entregables</div>
                    <div className="text-2xl font-bold">{deliverables.length}</div>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex flex-col items-center text-center">
                    <Users className="h-8 w-8 text-primary mb-2" />
                    <div className="text-sm text-muted-foreground">Tamaño del Equipo</div>
                    <div className="text-2xl font-bold">{projectTeam?.length || 0}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AlwaysOnProjectView;