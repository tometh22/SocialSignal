import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Client } from '@shared/schema';

const OptimizedBasicInfo: React.FC = () => {
  const {
    quotationData,
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration
  } = useOptimizedQuote();

  // Consultar lista de clientes
  const { data: clients, isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  // Consultar tipos de proyecto
  const { data: projectTypes, isLoading: isLoadingProjectTypes } = useQuery<{value: string, label: string}[]>({
    queryKey: ['/api/options/project-types'],
  });

  return (
    <div>
      <div className="bg-blue-600 text-white px-4 py-2 mb-4">
        <span>Ingresa la información básica para comenzar la cotización</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <h4 className="font-medium mb-2">Selección de Cliente</h4>
          <div>
            <Label htmlFor="client">
              Cliente <span className="text-red-500">*</span>
            </Label>
            <Select
              value={quotationData.client ? String(quotationData.client.id) : ''}
              onValueChange={(value) => {
                const selectedClient = clients?.find(client => client.id === parseInt(value));
                updateClient(selectedClient || null);
              }}
              disabled={isLoadingClients}
            >
              <SelectTrigger id="client">
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium mb-2">Datos del Proyecto</h4>
          <div className="mb-2">
            <Label htmlFor="project-name">
              Nombre del Proyecto <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder="Ej. Análisis de Mercado Q2 2023"
              value={quotationData.project.name}
              onChange={(e) => updateProjectName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="project-type">
              Tipo de Proyecto
            </Label>
            <Select
              value={quotationData.project.type}
              onValueChange={updateProjectType}
              disabled={isLoadingProjectTypes}
            >
              <SelectTrigger id="project-type">
                <SelectValue placeholder="Seleccionar tipo" />
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
        </div>
        
        <div>
          <h4 className="font-medium mb-2">Duración y Planificación</h4>
          <div>
            <Label htmlFor="project-duration">
              Duración Estimada
            </Label>
            <Select
              value={quotationData.project.duration}
              onValueChange={(value) => updateProjectDuration(value as any)}
            >
              <SelectTrigger id="project-duration">
                <SelectValue placeholder="Seleccionar duración" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Corto (1-3 meses)</SelectItem>
                <SelectItem value="medium">Medio (3-6 meses)</SelectItem>
                <SelectItem value="long">Largo (6+ meses)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <div className="mt-4 bg-gray-100 border border-gray-200 p-4">
        <p className="font-medium mb-2">Completa la información requerida para continuar</p>
        <ul className="text-sm list-disc pl-5">
          <li>El cliente es obligatorio para poder generar la cotización.</li>
          <li>El nombre del proyecto debe ser descriptivo y específico.</li>
          <li>El tipo y duración del proyecto ayudan a calcular costos y plazos.</li>
        </ul>
      </div>
    </div>
  );
};

export default OptimizedBasicInfo;