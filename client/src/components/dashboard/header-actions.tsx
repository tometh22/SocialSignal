import React, { useState } from 'react';
import { 
  Calendar, 
  Eye,
  Settings, 
  Clock, 
  Edit2, 
  Save, 
  ChevronLeft
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
  onSaveProjectName: (name: string) => void;
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
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState(projectName || "");

  const handleSave = () => {
    if (editedName.trim()) {
      onSaveProjectName(editedName.trim());
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedName(projectName || "");
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
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 bg-background rounded-lg border p-4">
      <div className="flex items-center gap-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="text-2xl font-bold h-10 min-w-[300px]"
              autoFocus
            />
            <Button size="icon" onClick={handleSave} variant="outline">
              <Save className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleCancel}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {projectName || project?.quotation?.projectName || "Sin nombre"}
            </h1>
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        <StatusBadge status={status} />
      </div>
      
      <div className="flex flex-wrap gap-3 mt-4 md:mt-0 items-center">
        <Select
          value={timeFilter}
          onValueChange={onTimeFilterChange}
        >
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
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
          <SelectTrigger className="w-[180px]">
            <Eye className="h-4 w-4 mr-2" />
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
        >
          <Settings className="h-4 w-4" />
        </Button>
        
        <Button
          variant="default"
          className="flex gap-2 items-center"
          onClick={onRegisterHours}
        >
          <Clock className="h-4 w-4" />
          Registrar Horas
        </Button>
      </div>
    </div>
  );
};

export default HeaderActions;