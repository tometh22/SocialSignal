import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Move, Settings, Users, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BatchActionsProps {
  currentProjectId: number;
  siblingProjects: Array<{
    id: number;
    name: string;
    completionStatus: string;
  }>;
  timeEntries: Array<{
    id: number;
    personnelId: number;
    personnelName: string;
    hours: number;
    date: Date | string;
    description?: string;
  }>;
  onSuccess?: () => void;
}

export function BatchActions({
  currentProjectId,
  siblingProjects,
  timeEntries,
  onSuccess
}: BatchActionsProps) {
  const [showCopyConfig, setShowCopyConfig] = useState(false);
  const [showMoveTime, setShowMoveTime] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const [selectedTimeEntries, setSelectedTimeEntries] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleCopyConfiguration = async () => {
    if (!targetProjectId) return;
    
    setIsProcessing(true);
    try {
      await apiRequest(`/api/active-projects/${targetProjectId}/copy-config`, "POST", {
        sourceProjectId: currentProjectId,
        copySettings: true,
        copyTeamAssignments: true
      });
      
      toast({
        title: "Configuración copiada",
        description: "La configuración se ha copiado exitosamente al proyecto destino.",
      });
      
      setShowCopyConfig(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar la configuración.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMoveTimeEntries = async () => {
    if (!targetProjectId || selectedTimeEntries.length === 0) return;
    
    setIsProcessing(true);
    try {
      await apiRequest(`/api/time-entries/bulk-move`, "POST", {
        timeEntryIds: selectedTimeEntries,
        targetProjectId: parseInt(targetProjectId)
      });
      
      toast({
        title: "Tiempo transferido",
        description: `${selectedTimeEntries.length} registros de tiempo han sido transferidos.`,
      });
      
      setShowMoveTime(false);
      setSelectedTimeEntries([]);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo transferir el tiempo registrado.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleTimeEntry = (entryId: number) => {
    setSelectedTimeEntries(prev =>
      prev.includes(entryId)
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const selectAllTimeEntries = () => {
    setSelectedTimeEntries(timeEntries.map(entry => entry.id));
  };

  const clearSelection = () => {
    setSelectedTimeEntries([]);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Settings className="h-4 w-4" />
        Acciones en Lote
      </h4>
      
      <div className="grid grid-cols-1 gap-2">
        {/* Copiar Configuración */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCopyConfig(true)}
          className="justify-start"
          disabled={siblingProjects.length === 0}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copiar configuración a otro subproyecto
        </Button>

        {/* Transferir Tiempo */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMoveTime(true)}
          className="justify-start"
          disabled={timeEntries.length === 0 || siblingProjects.length === 0}
        >
          <Move className="h-4 w-4 mr-2" />
          Transferir tiempo registrado
        </Button>
      </div>

      {/* Dialog para copiar configuración */}
      <Dialog open={showCopyConfig} onOpenChange={setShowCopyConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar Configuración</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Copia la configuración del proyecto actual a otro subproyecto del mismo cliente.
            </p>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Proyecto destino:</label>
              <Select value={targetProjectId} onValueChange={setTargetProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proyecto destino" />
                </SelectTrigger>
                <SelectContent>
                  {siblingProjects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      <div className="flex items-center justify-between w-full">
                        <span>{project.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {project.completionStatus}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Se copiará:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Configuración de entregables</li>
                <li>• Asignaciones de equipo</li>
                <li>• Estimaciones de tiempo</li>
                <li>• Configuraciones específicas</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCopyConfig(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCopyConfiguration}
                disabled={!targetProjectId || isProcessing}
              >
                {isProcessing ? "Copiando..." : "Copiar Configuración"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para transferir tiempo */}
      <Dialog open={showMoveTime} onOpenChange={setShowMoveTime}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transferir Tiempo Registrado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Transfiere registros de tiempo que fueron registrados incorrectamente en este proyecto.
            </p>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Proyecto destino:</label>
              <Select value={targetProjectId} onValueChange={setTargetProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proyecto destino" />
                </SelectTrigger>
                <SelectContent>
                  {siblingProjects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Seleccionar registros de tiempo:
                </label>
                <div className="space-x-2">
                  <Button variant="ghost" size="sm" onClick={selectAllTimeEntries}>
                    Seleccionar todos
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Limpiar
                  </Button>
                </div>
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-3">
                {timeEntries.map(entry => (
                  <div key={entry.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                    <Checkbox
                      checked={selectedTimeEntries.includes(entry.id)}
                      onCheckedChange={() => toggleTimeEntry(entry.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{entry.personnelName}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(entry.date).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">{entry.hours}h</Badge>
                        </div>
                      </div>
                      {entry.description && (
                        <p className="text-xs text-gray-400 truncate mt-1">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedTimeEntries.length > 0 && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">
                        {selectedTimeEntries.length} registro{selectedTimeEntries.length !== 1 ? 's' : ''} seleccionado{selectedTimeEntries.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-amber-700">
                        Total de horas a transferir: {
                          timeEntries
                            .filter(entry => selectedTimeEntries.includes(entry.id))
                            .reduce((sum, entry) => sum + entry.hours, 0)
                        }h
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowMoveTime(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleMoveTimeEntries}
                disabled={!targetProjectId || selectedTimeEntries.length === 0 || isProcessing}
              >
                {isProcessing ? "Transfiriendo..." : `Transferir ${selectedTimeEntries.length} registro${selectedTimeEntries.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}