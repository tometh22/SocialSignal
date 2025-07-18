import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, User, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface UnquotedPersonnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel: {
    id: number;
    name: string;
    hourlyRate: number;
  };
  projectId: number;
  onHoursAssigned: (hours: number) => void;
}

export default function UnquotedPersonnelDialog({
  open,
  onOpenChange,
  personnel,
  projectId,
  onHoursAssigned,
}: UnquotedPersonnelDialogProps) {
  const [estimatedHours, setEstimatedHours] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assignHoursMutation = useMutation({
    mutationFn: async (hours: number) => {
      // Crear un registro en el backend para asignar horas a personal no cotizado
      return apiRequest("/api/projects/assign-unquoted-personnel", {
        method: "POST",
        body: {
          projectId,
          personnelId: personnel.id,
          estimatedHours: hours,
          hourlyRate: personnel.hourlyRate,
        },
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Personal no cotizado agregado",
        description: `Se asignaron ${estimatedHours} horas a ${personnel.name}`,
      });
      onHoursAssigned(parseFloat(estimatedHours));
      onOpenChange(false);
      setEstimatedHours("");
      // Invalidar cache para actualizar la vista
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "complete-data"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error al asignar horas",
        description: error.message || "No se pudo asignar las horas al personal",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const hours = parseFloat(estimatedHours);
    if (isNaN(hours) || hours <= 0) {
      toast({
        variant: "destructive",
        title: "Horas inválidas",
        description: "Por favor ingresa un número válido de horas",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await assignHoursMutation.mutateAsync(hours);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            Personal No Cotizado Detectado
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            <strong>{personnel.name}</strong> no estaba incluido en el equipo base de la cotización original.
            Para poder hacer un seguimiento adecuado, necesitamos asignar las horas estimadas para esta persona.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">Información del Personal</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Nombre:</span>
                <span className="font-medium">{personnel.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tarifa por hora:</span>
                <span className="font-medium">${personnel.hourlyRate}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="estimated-hours" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horas Estimadas para el Proyecto
              </Label>
              <Input
                id="estimated-hours"
                type="number"
                step="0.1"
                min="0.1"
                placeholder="ej: 40.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                required
                className="text-lg"
              />
              <p className="text-sm text-gray-500">
                Ingresa las horas que se estima que esta persona trabajará en el proyecto
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-white">
                  <Plus className="h-3 w-3 mr-1" />
                  Costo Estimado
                </Badge>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {estimatedHours && !isNaN(parseFloat(estimatedHours))
                  ? `$${(parseFloat(estimatedHours) * personnel.hourlyRate).toFixed(2)}`
                  : "$0.00"}
              </div>
            </div>
          </form>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !estimatedHours}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Asignando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Asignar Horas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}