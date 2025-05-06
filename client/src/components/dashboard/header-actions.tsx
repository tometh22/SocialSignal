import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Eye,
  Settings, 
  Clock, 
  Edit2, 
  Save, 
  ChevronLeft,
  Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface HeaderActionsProps {
  projectName: string;
  status: string;
  projectId: number;
  timeFilter: string;
  viewMode: string;
  onTimeFilterChange: (value: string) => void;
  onViewModeChange: (value: string) => void;
  onRegisterHours: () => void;
  onSettingsClick: () => void;
  onSaveProjectName: (name: string) => Promise<void>;
}

export const HeaderActions = ({
  projectName,
  status,
  projectId,
  timeFilter,
  viewMode,
  onTimeFilterChange,
  onViewModeChange,
  onRegisterHours,
  onSettingsClick,
  onSaveProjectName
}: HeaderActionsProps) => {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState(projectName);
  const nameRef = useRef<HTMLHeadingElement>(null);

  // Actualizar el nombre editado cuando cambia el nombre del proyecto
  useEffect(() => {
    if (projectName) {
      setEditedName(projectName);
      setDisplayName(projectName);
    }
  }, [projectName]);

  // Función para actualizar directamente el DOM con el nuevo nombre del proyecto
  const updateNameInDOM = (newName: string) => {
    // Actualizar todas las referencias del nombre del proyecto en el DOM
    document.querySelectorAll('.project-name').forEach(el => {
      (el as HTMLElement).innerText = newName;
    });
  };

  // Función para actualizar los datos en React Query directamente
  const updateQueryCache = (newName: string) => {
    // Actualizar el proyecto actual en la caché
    queryClient.setQueryData([`/api/active-projects/${projectId}`], (oldData: any) => {
      if (!oldData) return oldData;
      
      // Crear una copia profunda para evitar mutaciones
      const newData = JSON.parse(JSON.stringify(oldData));
      
      // Actualizar el nombre del proyecto en los datos
      if (newData.quotation) {
        newData.quotation.projectName = newName;
      }
      
      return newData;
    });
    
    // Actualizar la lista de proyectos si existe en caché
    queryClient.setQueryData(['/api/active-projects'], (oldData: any[] | undefined) => {
      if (!oldData) return oldData;
      
      // Crear una copia profunda para evitar mutaciones
      const newData = JSON.parse(JSON.stringify(oldData));
      
      // Actualizar el nombre del proyecto específico
      return newData.map((project: any) => {
        if (project.id === projectId && project.quotation) {
          project.quotation.projectName = newName;
        }
        return project;
      });
    });
  };

  const handleSave = async () => {
    const trimmedName = editedName.trim();
    
    // Si no hay cambios o el nombre está vacío, salir del modo edición
    if (!trimmedName || trimmedName === projectName) {
      setEditing(false);
      return;
    }
    
    try {
      // Activar estado de carga
      setIsSaving(true);
      
      // 1. Actualizar el nombre inmediatamente en la interfaz
      setDisplayName(trimmedName);
      updateNameInDOM(trimmedName);
      
      // 2. Aplicar cambios en la caché de React Query para mantener la UI sincronizada
      updateQueryCache(trimmedName);
      
      // 3. Enviar la actualización al servidor
      await onSaveProjectName(trimmedName);
      
      // 4. Desactivar estados de carga y edición
      setIsSaving(false);
      setEditing(false);
      
      // 5. Mostrar notificación de éxito
      toast({
        title: "Nombre actualizado",
        description: "El nombre del proyecto ha sido actualizado correctamente.",
      });
      
    } catch (error) {
      console.error("Error al guardar el nombre:", error);
      
      // Revertir cambios en caso de error
      setDisplayName(projectName);
      updateNameInDOM(projectName);
      updateQueryCache(projectName); // Revertir también en la caché
      
      // Mostrar notificación de error
      toast({
        title: "Error",
        description: "No se pudo actualizar el nombre del proyecto. Por favor, intente nuevamente.",
        variant: "destructive",
      });
      
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Cancelar la edición y restaurar el nombre original
    setEditedName(projectName || "");
    setDisplayName(projectName || "");
    setEditing(false);
  };

  // Status badge renderer
  const StatusBadge = ({ status }: { status: string }) => {
    // Colores según estado
    let bgColor = "bg-gray-100";
    let textColor = "text-gray-700";
    let displayText = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    
    switch (status.toLowerCase()) {
      case 'active':
      case 'activo':
        bgColor = "bg-green-100";
        textColor = "text-green-700";
        displayText = "Activo";
        break;
      case 'completed':
      case 'completado':
        bgColor = "bg-blue-100";
        textColor = "text-blue-700";
        displayText = "Completado";
        break;
      case 'paused':
      case 'pausado':
        bgColor = "bg-amber-100";
        textColor = "text-amber-700";
        displayText = "Pausado";
        break;
      case 'cancelled':
      case 'cancelado':
        bgColor = "bg-red-100";
        textColor = "text-red-700";
        displayText = "Cancelado";
        break;
      case 'pending':
      case 'pendiente':
        bgColor = "bg-purple-100";
        textColor = "text-purple-700";
        displayText = "Pendiente";
        break;
    }
    
    return (
      <Badge className={`${bgColor} ${textColor}`}>
        {displayText}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 bg-background rounded-lg border p-2.5">
      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="text-lg font-bold h-8 min-w-[250px]"
              disabled={isSaving}
              autoFocus
            />
            <Button 
              size="icon" 
              onClick={handleSave} 
              variant="outline" 
              className="h-7 w-7" 
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={handleCancel} 
              className="h-7 w-7"
              disabled={isSaving}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold project-name">
              {displayName || "Sin nombre"}
            </h1>
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)} className="h-7 w-7">
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <StatusBadge status={status} />
      </div>
      
      <div className="flex flex-wrap gap-2 mt-2 md:mt-0 items-center">
        <Select
          value={timeFilter}
          onValueChange={onTimeFilterChange}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el periodo</SelectItem>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mes</SelectItem>
            <SelectItem value="quarter">Último trimestre</SelectItem>
          </SelectContent>
        </Select>
        
        <Select
          value={viewMode}
          onValueChange={onViewModeChange}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Vista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Vista compacta</SelectItem>
            <SelectItem value="detailed">Vista detallada</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant="outline"
          size="icon"
          onClick={onSettingsClick}
          className="h-8 w-8"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
        
        <Button
          variant="default"
          size="sm"
          className="flex gap-1.5 items-center h-8 text-xs"
          onClick={onRegisterHours}
        >
          <Clock className="h-3.5 w-3.5" />
          Registrar Horas
        </Button>
      </div>
    </div>
  );
};

export default HeaderActions;