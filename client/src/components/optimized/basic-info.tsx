import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Client } from '@shared/schema';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Componente para el Paso 1: Información Básica
const OptimizedBasicInfo: React.FC = () => {
  const {
    quotationData,
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration
  } = useOptimizedQuote();

  // Obtener clientes de la API
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  // Obtener tipos de proyecto de la API
  const { data: projectTypes } = useQuery<any[]>({
    queryKey: ['/api/options/project-types'],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">Información Básica del Proyecto</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Selección de cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
            <CardDescription>Selecciona el cliente para esta cotización</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={quotationData.client?.id?.toString() || ''}
              onValueChange={(value) => {
                const client = clients?.find(c => c.id === parseInt(value));
                updateClient(client || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {quotationData.client && (
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm font-medium text-blue-800">
                  {quotationData.client.name}
                </p>
                {quotationData.client.contactName && (
                  <p className="text-xs text-blue-600 mt-1">
                    Contacto: {quotationData.client.contactName}
                  </p>
                )}
                {quotationData.client.email && (
                  <p className="text-xs text-blue-600">
                    Email: {quotationData.client.email}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Información del proyecto */}
        <Card>
          <CardHeader>
            <CardTitle>Detalles del Proyecto</CardTitle>
            <CardDescription>Información básica del proyecto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="projectName">Nombre del Proyecto</Label>
              <Input
                id="projectName"
                value={quotationData.project.name}
                onChange={(e) => updateProjectName(e.target.value)}
                placeholder="Ej: Monitoreo de Marca Q3 2024"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="projectType">Tipo de Proyecto</Label>
              <Select
                value={quotationData.project.type}
                onValueChange={updateProjectType}
              >
                <SelectTrigger id="projectType">
                  <SelectValue placeholder="Selecciona el tipo de proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes?.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Duración del proyecto */}
      <Card>
        <CardHeader>
          <CardTitle>Duración Estimada</CardTitle>
          <CardDescription>Selecciona la duración aproximada del proyecto</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={quotationData.project.duration}
            onValueChange={(value) => updateProjectDuration(value as 'short' | 'medium' | 'long')}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-neutral-50 cursor-pointer">
              <RadioGroupItem value="short" id="short" />
              <Label htmlFor="short" className="cursor-pointer flex-1">
                <div className="font-medium">Corto Plazo</div>
                <div className="text-sm text-neutral-500">1-4 semanas</div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-neutral-50 cursor-pointer">
              <RadioGroupItem value="medium" id="medium" />
              <Label htmlFor="medium" className="cursor-pointer flex-1">
                <div className="font-medium">Medio Plazo</div>
                <div className="text-sm text-neutral-500">1-3 meses</div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-neutral-50 cursor-pointer">
              <RadioGroupItem value="long" id="long" />
              <Label htmlFor="long" className="cursor-pointer flex-1">
                <div className="font-medium">Largo Plazo</div>
                <div className="text-sm text-neutral-500">+3 meses</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
      
      {/* Consejos y notas */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
        <h3 className="text-blue-800 font-medium">Consejos para comenzar</h3>
        <ul className="mt-2 text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Selecciona un cliente existente o crea uno nuevo desde el panel de administración</li>
          <li>El nombre del proyecto debe ser específico y descriptivo</li>
          <li>La duración estimada afectará la complejidad y costos del proyecto</li>
        </ul>
      </div>
    </div>
  );
};

export default OptimizedBasicInfo;