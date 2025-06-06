import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Edit, Save, X, CheckCircle, TrendingUp, PlayCircle, PauseCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SubprojectManagerProps {
  subprojects: any[];
  parentProjectId: number;
  isExpanded: boolean;
  getProjectHours: (projectId: number) => number;
  setLocation: (path: string) => void;
}

export function SubprojectManager({ 
  subprojects, 
  parentProjectId, 
  isExpanded, 
  getProjectHours, 
  setLocation 
}: SubprojectManagerProps) {
  const [editingSubproject, setEditingSubproject] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedSubproject, setSelectedSubproject] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getCompletionStatusBadge = (status: string) => {
    const config = {
      "pending": { className: "bg-gray-100 text-gray-700", label: "Pendiente", icon: Clock },
      "in_progress": { className: "bg-blue-100 text-blue-700", label: "En Progreso", icon: TrendingUp },
      "completed": { className: "bg-green-100 text-green-700", label: "Completado", icon: CheckCircle },
      "cancelled": { className: "bg-red-100 text-red-700", label: "Cancelado", icon: X }
    };
    
    const statusConfig = config[status as keyof typeof config] || config.pending;
    const IconComponent = statusConfig.icon;
    
    return (
      <Badge variant="secondary" className={`text-xs font-medium px-2 py-1 ${statusConfig.className}`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  const updateNameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return apiRequest(`/api/active-projects/${id}/name`, "PATCH", { subprojectName: name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      setEditingSubproject(null);
      setEditingName("");
      toast({
        title: "Éxito",
        description: "Nombre del subproyecto actualizado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el nombre del subproyecto.",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      setUpdatingStatus(id);
      return apiRequest(`/api/active-projects/${id}/status`, "PATCH", { 
        completionStatus: status,
        completedDate: status === "completed" ? new Date().toISOString() : null
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/active-projects"] });
      setStatusDialogOpen(false);
      setSelectedSubproject(null);
      setNewStatus("");
      setUpdatingStatus(null);
      toast({
        title: "Estado actualizado",
        description: "El estado del entregable se ha actualizado correctamente.",
      });
    },
    onError: (_, variables) => {
      setUpdatingStatus(null);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del entregable.",
        variant: "destructive",
      });
    },
  });

  const handleEditName = (subproject: any) => {
    setEditingSubproject(subproject.id);
    setEditingName(subproject.subprojectName || `Entregable ${subproject.id}`);
  };

  const handleSaveName = () => {
    if (editingSubproject && editingName.trim()) {
      updateNameMutation.mutate({ id: editingSubproject, name: editingName.trim() });
    }
  };

  const handleCancelEdit = () => {
    setEditingSubproject(null);
    setEditingName("");
  };

  const handleStatusChange = (subproject: any) => {
    setSelectedSubproject(subproject);
    setNewStatus(subproject.completionStatus || "pending");
    setStatusDialogOpen(true);
  };

  const handleSaveStatus = () => {
    if (selectedSubproject && newStatus) {
      updateStatusMutation.mutate({ id: selectedSubproject.id, status: newStatus });
    }
  };

  const handleQuickStatusUpdate = (subproject: any, newStatus: string) => {
    updateStatusMutation.mutate({ id: subproject.id, status: newStatus });
  };

  if (!isExpanded || subprojects.length === 0) return null;

  return (
    <>
      <div className="border-t border-gray-100 bg-gray-50/50">
        <div className="px-6 py-4">
          <div className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wider">
            Entregables ({subprojects.length})
          </div>
          <div className="grid gap-3">
            {subprojects.map((subproject: any) => {
              const registeredHours = getProjectHours(subproject.id);
              const estimatedHours = 8;
              const progress = registeredHours / estimatedHours;
              const isEditing = editingSubproject === subproject.id;

              return (
                <Card key={subproject.id} className="border border-gray-200 hover:shadow-sm transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="text-sm font-medium"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveName();
                                  if (e.key === "Escape") handleCancelEdit();
                                }}
                              />
                              <Button size="sm" onClick={handleSaveName} disabled={updateNameMutation.isPending}>
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <h4 className="font-medium text-gray-900 text-sm flex-1">
                                {subproject.subprojectName || `Entregable ${subproject.id}`}
                              </h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditName(subproject)}
                                className="h-6 w-6 p-0"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mb-2">
                          <div className="relative">
                            <button
                              onClick={() => handleStatusChange(subproject)}
                              className={`transition-all hover:scale-105 ${
                                updatingStatus === subproject.id ? 'animate-pulse opacity-50' : ''
                              }`}
                              disabled={updatingStatus === subproject.id}
                            >
                              {getCompletionStatusBadge(subproject.completionStatus || 'pending')}
                            </button>
                            {updatingStatus === subproject.id && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                          
                          {subproject.completedDate && (
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              Finalizado: {format(new Date(subproject.completedDate), 'dd/MM/yyyy')}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {registeredHours}h registradas
                          </span>
                          <span className={`font-medium ${
                            progress > 1 ? 'text-red-600' : 
                            progress > 0.8 ? 'text-orange-500' : 'text-green-600'
                          }`}>
                            {(progress * 100).toFixed(0)}% del tiempo estimado
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/time-entries/project/${subproject.id}`);
                            }}
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Registrar Horas
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/active-projects/${subproject.id}`);
                            }}
                          >
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Ver Resumen de Sub-proyecto
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dialog para cambiar estado */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Actualizar Estado del Entregable</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                {selectedSubproject?.subprojectName || `Entregable ${selectedSubproject?.id}`}
              </h3>
              <p className="text-sm text-gray-600">
                Estado actual: <span className="font-medium">{
                  selectedSubproject?.completionStatus === 'pending' ? 'Pendiente' :
                  selectedSubproject?.completionStatus === 'in_progress' ? 'En Progreso' :
                  selectedSubproject?.completionStatus === 'completed' ? 'Completado' :
                  selectedSubproject?.completionStatus === 'paused' ? 'Pausado' :
                  selectedSubproject?.completionStatus === 'cancelled' ? 'Cancelado' : 'Sin definir'
                }</span>
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={newStatus === "pending" ? "default" : "outline"}
                onClick={() => setNewStatus("pending")}
                className="justify-start h-12"
              >
                <Clock className="h-4 w-4 mr-2 text-gray-500" />
                <div className="text-left">
                  <div className="font-medium">Pendiente</div>
                  <div className="text-xs text-gray-500">Por iniciar</div>
                </div>
              </Button>
              
              <Button
                variant={newStatus === "in_progress" ? "default" : "outline"}
                onClick={() => setNewStatus("in_progress")}
                className="justify-start h-12"
              >
                <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />
                <div className="text-left">
                  <div className="font-medium">En Progreso</div>
                  <div className="text-xs text-gray-500">Trabajando</div>
                </div>
              </Button>
              
              <Button
                variant={newStatus === "completed" ? "default" : "outline"}
                onClick={() => setNewStatus("completed")}
                className="justify-start h-12"
              >
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                <div className="text-left">
                  <div className="font-medium">Completado</div>
                  <div className="text-xs text-gray-500">Finalizado</div>
                </div>
              </Button>
              
              <Button
                variant={newStatus === "paused" ? "default" : "outline"}
                onClick={() => setNewStatus("paused")}
                className="justify-start h-12"
              >
                <Calendar className="h-4 w-4 mr-2 text-orange-500" />
                <div className="text-left">
                  <div className="font-medium">Pausado</div>
                  <div className="text-xs text-gray-500">En espera</div>
                </div>
              </Button>
            </div>
            
            {newStatus === "completed" && (
              <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg border border-green-200">
                <CheckCircle className="h-4 w-4 inline mr-2 text-green-600" />
                Al marcar como completado, se registrará automáticamente la fecha de finalización.
              </div>
            )}
            
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                onClick={handleSaveStatus} 
                disabled={updateStatusMutation.isPending || !newStatus}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Actualizando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Actualizar Estado
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setStatusDialogOpen(false)}
                disabled={updateStatusMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}