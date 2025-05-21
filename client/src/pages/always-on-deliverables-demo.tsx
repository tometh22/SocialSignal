import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeliverableConfig, Deliverable } from '@/components/projects/DeliverableConfig';
import { AlwaysOnProjectSummary } from '@/components/projects/AlwaysOnProjectSummary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// Ejemplo de datos iniciales para el demo de Baby & Child Care
const initialDeliverables: Deliverable[] = [
  {
    id: '1',
    type: 'report',
    frequency: 'biweekly',
    description: 'Informe Quincenal de Tendencias y Seguimiento de Campañas',
    budget: 7800
  },
  {
    id: '2',
    type: 'analysis',
    frequency: 'quarterly',
    description: 'Reporte trimestral de análisis estadístico de percepción de marca',
    budget: 1150
  }
];

const initialTeam = [
  { nombre: 'MATI', rol: 'Analista', horas: 16, tarifa: 9.2 },
  { nombre: 'VANU', rol: 'Gestora', horas: 47, tarifa: 9.6 },
  { nombre: 'TRINI', rol: 'Analista', horas: 110, tarifa: 8.2 },
  { nombre: 'SOL', rol: 'Analista', horas: 120, tarifa: 8.1 },
  { nombre: 'AYLEN', rol: 'Analista', horas: 70, tarifa: 7.5 },
  { nombre: 'ACHA', rol: 'Directora', horas: 12, tarifa: 20.1 },
  { nombre: 'TO', rol: 'Gerente', horas: 5, tarifa: 14.0 },
  { nombre: 'VICKY', rol: 'Directora', horas: 5, tarifa: 20.8 },
  { nombre: 'HERRAMIENTA', rol: 'Software', horas: 1, tarifa: 417 },
  { nombre: 'DESVIO', rol: 'Contingencia', horas: 1, tarifa: 250 }
];

const AlwaysOnDeliverablesDemo = () => {
  const [activeTab, setActiveTab] = useState('config');
  const [deliverables, setDeliverables] = useState<Deliverable[]>(initialDeliverables);
  const [additionalCost, setAdditionalCost] = useState<number>(1850);
  const [clientName, setClientName] = useState<string>('Baby & Child Care');
  const [projectName, setProjectName] = useState<string>('Monitoreo de Redes Sociales');
  const [startDate, setStartDate] = useState<string>('Mayo 2025');
  const [monthlyBudget, setMonthlyBudget] = useState<number>(8950);

  const handlePreviewClick = () => {
    setActiveTab('preview');
  };

  const handleConfigClick = () => {
    setActiveTab('config');
  };

  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Demo: Cotización de Proyecto Always-On con Múltiples Entregables</h1>
        <p className="text-muted-foreground">
          Este demo muestra cómo se implementarían proyectos con múltiples entregables a diferentes frecuencias,
          como el caso de Baby & Child Care.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="preview">Vista Previa</TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información Básica del Proyecto</CardTitle>
              <CardDescription>
                Configura los detalles principales del proyecto Always-On
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client-name">Nombre del Cliente</Label>
                  <Input 
                    id="client-name" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-name">Nombre del Proyecto</Label>
                  <Input 
                    id="project-name" 
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Fecha de Inicio</Label>
                  <Input 
                    id="start-date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-budget">Presupuesto Mensual Total (USD)</Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                      $
                    </span>
                    <Input 
                      id="monthly-budget" 
                      type="number"
                      className="pl-7"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <DeliverableConfig 
            deliverables={deliverables}
            onChange={setDeliverables}
            additionalCost={additionalCost}
            onAdditionalCostChange={setAdditionalCost}
          />
          
          <div className="flex justify-end">
            <Button size="lg" onClick={handlePreviewClick}>
              Previsualizar Proyecto
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="preview">
          <div className="mb-4">
            <Button variant="outline" onClick={handleConfigClick}>
              Volver a configuración
            </Button>
          </div>

          <AlwaysOnProjectSummary
            cliente={clientName}
            proyecto={projectName}
            fechaInicio={startDate}
            presupuestoMensual={monthlyBudget}
            entregables={deliverables.map(d => ({
              id: d.id,
              tipo: d.type,
              frecuencia: d.frequency,
              descripcion: d.description,
              presupuesto: d.budget
            }))}
            equipo={initialTeam}
            costoAdicional={additionalCost}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AlwaysOnDeliverablesDemo;