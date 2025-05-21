import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeliverableConfig, Deliverable } from '@/components/projects/DeliverableConfig';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

interface DeliverableConfigurationProps {
  isAlwaysOnProject: boolean;
  onIsAlwaysOnProjectChange: (value: boolean) => void;
  deliverables: Deliverable[];
  onDeliverablesChange: (deliverables: Deliverable[]) => void;
  additionalCost: number;
  onAdditionalCostChange: (cost: number) => void;
}

const DeliverableConfiguration: React.FC<DeliverableConfigurationProps> = ({
  isAlwaysOnProject,
  onIsAlwaysOnProjectChange,
  deliverables,
  onDeliverablesChange,
  additionalCost,
  onAdditionalCostChange
}) => {
  const { toast } = useToast();
  
  // Crear un entregable por defecto cuando se activa el modo Always-On
  useEffect(() => {
    if (isAlwaysOnProject && deliverables.length === 0) {
      onDeliverablesChange([
        {
          id: crypto.randomUUID(),
          type: 'report',
          frequency: 'monthly',
          description: 'Informe mensual de análisis y tendencias',
          budget: 0
        }
      ]);
    }
  }, [isAlwaysOnProject, deliverables.length, onDeliverablesChange]);

  const handleAlwaysOnToggle = (checked: boolean) => {
    onIsAlwaysOnProjectChange(checked);
    
    if (checked) {
      toast({
        title: "Modo Always-On activado",
        description: "Ahora podrás configurar múltiples entregables con diferentes frecuencias",
      });
    } else {
      // Confirmar si realmente quiere desactivar el modo Always-On
      if (deliverables.length > 0) {
        const confirmDisable = window.confirm(
          "Al desactivar el modo Always-On se perderá la configuración de entregables. ¿Deseas continuar?"
        );
        
        if (confirmDisable) {
          onDeliverablesChange([]);
          onAdditionalCostChange(0);
        } else {
          onIsAlwaysOnProjectChange(true); // Revertir el cambio
          return;
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configuración de Proyecto Always-On</CardTitle>
              <CardDescription>
                Activa esta opción para proyectos con entregables múltiples a diferentes frecuencias
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="always-on-mode"
                checked={isAlwaysOnProject}
                onCheckedChange={handleAlwaysOnToggle}
              />
              <Label htmlFor="always-on-mode">
                {isAlwaysOnProject ? 'Activado' : 'Desactivado'}
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isAlwaysOnProject ? (
            <Alert className="mb-6 bg-blue-50 text-blue-800 border border-blue-200">
              <InfoCircledIcon className="h-4 w-4" />
              <AlertTitle>Modo Always-On</AlertTitle>
              <AlertDescription>
                Los proyectos Always-On te permiten configurar múltiples entregables a diferentes
                frecuencias (semanal, quincenal, mensual, trimestral) con presupuestos específicos
                para cada uno.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              Activa el modo Always-On para configurar múltiples entregables en este proyecto.
              Ideal para proyectos como Baby & Child Care o MODO con diferentes tipos de reportes 
              y frecuencias de entrega.
            </p>
          )}
        </CardContent>
      </Card>

      {isAlwaysOnProject && (
        <DeliverableConfig
          deliverables={deliverables}
          onChange={onDeliverablesChange}
          additionalCost={additionalCost}
          onAdditionalCostChange={onAdditionalCostChange}
        />
      )}
    </div>
  );
};

export default DeliverableConfiguration;