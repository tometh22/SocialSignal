import React from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2 } from 'lucide-react';

export interface Deliverable {
  id: string;
  type: string;
  frequency: string;
  description: string;
  budget: number;
}

interface DeliverableConfigProps {
  deliverables: Deliverable[];
  onChange: (deliverables: Deliverable[]) => void;
  additionalCost?: number;
  onAdditionalCostChange?: (cost: number) => void;
}

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'custom', label: 'Personalizado' }
];

const DELIVERABLE_TYPES = [
  { value: 'report', label: 'Informe de tendencias' },
  { value: 'analysis', label: 'Análisis estadístico' },
  { value: 'monitoring', label: 'Monitoreo en tiempo real' },
  { value: 'dashboard', label: 'Dashboard de performance' },
  { value: 'custom', label: 'Personalizado' }
];

export const DeliverableConfig: React.FC<DeliverableConfigProps> = ({
  deliverables,
  onChange,
  additionalCost = 0,
  onAdditionalCostChange
}) => {
  const handleAddDeliverable = () => {
    const newDeliverable: Deliverable = {
      id: crypto.randomUUID(),
      type: '',
      frequency: '',
      description: '',
      budget: 0
    };
    onChange([...deliverables, newDeliverable]);
  };

  const handleRemoveDeliverable = (id: string) => {
    onChange(deliverables.filter(d => d.id !== id));
  };

  const handleDeliverableChange = (id: string, field: keyof Deliverable, value: string | number) => {
    onChange(
      deliverables.map(d => 
        d.id === id ? { ...d, [field]: value } : d
      )
    );
  };

  const handleAdditionalCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    if (onAdditionalCostChange) {
      onAdditionalCostChange(value);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Entregables</CardTitle>
          <CardDescription>
            Define los tipos de entregables, frecuencias y presupuestos específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {deliverables.map((deliverable, index) => (
              <div key={deliverable.id} className="p-4 border rounded-lg bg-muted/30 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Entregable #{index + 1}</h4>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleRemoveDeliverable(deliverable.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`type-${deliverable.id}`}>Tipo de entregable</Label>
                    <Select
                      value={deliverable.type}
                      onValueChange={(value) => handleDeliverableChange(deliverable.id, 'type', value)}
                    >
                      <SelectTrigger id={`type-${deliverable.id}`}>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERABLE_TYPES.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`frequency-${deliverable.id}`}>Frecuencia</Label>
                    <Select
                      value={deliverable.frequency}
                      onValueChange={(value) => handleDeliverableChange(deliverable.id, 'frequency', value)}
                    >
                      <SelectTrigger id={`frequency-${deliverable.id}`}>
                        <SelectValue placeholder="Seleccionar frecuencia" />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`description-${deliverable.id}`}>Descripción</Label>
                  <Textarea
                    id={`description-${deliverable.id}`}
                    value={deliverable.description}
                    onChange={(e) => handleDeliverableChange(deliverable.id, 'description', e.target.value)}
                    placeholder="Describe el entregable y sus características principales..."
                    rows={2}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`budget-${deliverable.id}`}>Presupuesto para este entregable (USD)</Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id={`budget-${deliverable.id}`}
                      type="number"
                      className="pl-7"
                      value={deliverable.budget || ''}
                      onChange={(e) => handleDeliverableChange(deliverable.id, 'budget', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleAddDeliverable}
              className="w-full"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir entregable
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-start border-t p-4">
          <div className="w-full space-y-2">
            <Label htmlFor="additional-cost">Costo por entregables adicionales (opcional)</Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                $
              </span>
              <Input
                id="additional-cost"
                type="number"
                className="pl-7"
                value={additionalCost || ''}
                onChange={handleAdditionalCostChange}
                placeholder="0.00"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Este costo será aplicado a entregables fuera del alcance original
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};