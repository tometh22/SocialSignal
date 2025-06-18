import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Settings,
  Users,
  Clock,
  DollarSign,
  Calendar,
  FileText,
  Save,
  Plus,
  Trash2,
  Edit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function ProjectSettings() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");

  // Datos del proyecto
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: [`/api/clients/${(project as any)?.clientId}`],
    enabled: !!(project as any)?.clientId,
  });

  const { data: baseTeam = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId,
  });

  // Copiar equipo de cotización
  const copyTeamMutation = useMutation({
    mutationFn: () => apiRequest(`/api/projects/${projectId}/copy-quotation-team`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/base-team`] });
      toast({
        title: "Equipo copiado",
        description: "El equipo de la cotización se ha configurado para el proyecto"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo copiar el equipo de la cotización",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Cargando configuración del proyecto...</div>
      </div>
    );
  }

  const projectData = project as any;
  const clientData = client as any;
  const projectName = projectData?.quotation?.projectName || "Proyecto sin nombre";
  const clientName = clientData?.name || "Cliente desconocido";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-white via-blue-50 to-purple-50 border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/project-details/${projectId}`)}
                className="hover:bg-gray-100 h-8"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Volver al Proyecto
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Configuración del Proyecto
                </h1>
                <p className="text-gray-600 mt-1">{projectName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Equipo Base
              </TabsTrigger>
              <TabsTrigger value="time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tiempo
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Facturación
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Información General
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="projectName">Nombre del Proyecto</Label>
                      <Input
                        id="projectName"
                        defaultValue={projectName}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="clientName">Cliente</Label>
                      <Input
                        id="clientName"
                        value={clientName}
                        disabled
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Fecha de Inicio</Label>
                      <Input
                        id="startDate"
                        type="date"
                        defaultValue={projectData?.startDate ? new Date(projectData.startDate).toISOString().split('T')[0] : ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">Fecha Estimada de Fin</Label>
                      <Input
                        id="endDate"
                        type="date"
                        defaultValue={projectData?.expectedEndDate ? new Date(projectData.expectedEndDate).toISOString().split('T')[0] : ''}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      placeholder="Descripción del proyecto..."
                      defaultValue={projectData?.notes || ''}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Cambios
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Equipo Base del Proyecto
                    </CardTitle>
                    {(!Array.isArray(baseTeam) || baseTeam.length === 0) && (
                      <Button
                        onClick={() => copyTeamMutation.mutate()}
                        disabled={copyTeamMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {copyTeamMutation.isPending ? "Copiando..." : "Copiar desde Cotización"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {Array.isArray(baseTeam) && baseTeam.length > 0 ? (
                    <div className="space-y-3">
                      {baseTeam.map((member: any) => (
                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{member.personnel?.name}</p>
                              <p className="text-sm text-gray-500">{member.role?.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">${member.hourlyRate}/hora</Badge>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay equipo base configurado</p>
                      <p className="text-sm">Copia el equipo desde la cotización para comenzar</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="time" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Configuración de Tiempo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="estimatedHours">Horas Estimadas</Label>
                      <Input
                        id="estimatedHours"
                        type="number"
                        step="0.5"
                        defaultValue={projectData?.estimatedHours || ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hourlyRate">Tarifa por Hora (Promedio)</Label>
                      <Input
                        id="hourlyRate"
                        type="number"
                        step="0.01"
                        defaultValue={projectData?.avgHourlyRate || ''}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3">Configuraciones de Registro</h4>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">Permitir registro de tiempo retroactivo</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm">Requerir descripción en registros de tiempo</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" />
                        <span className="text-sm">Limitar registro a horas de trabajo</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Configuración
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Configuración de Facturación
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="totalBudget">Presupuesto Total</Label>
                      <Input
                        id="totalBudget"
                        type="number"
                        step="0.01"
                        defaultValue={projectData?.quotation?.totalAmount || ''}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency">Moneda</Label>
                      <Input
                        id="currency"
                        defaultValue="USD"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3">Alertas de Presupuesto</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="warningThreshold">Alerta al (% del presupuesto)</Label>
                        <Input
                          id="warningThreshold"
                          type="number"
                          min="0"
                          max="100"
                          defaultValue="80"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="criticalThreshold">Crítico al (% del presupuesto)</Label>
                        <Input
                          id="criticalThreshold"
                          type="number"
                          min="0"
                          max="100"
                          defaultValue="95"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Configuración
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}