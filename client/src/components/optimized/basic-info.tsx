import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Client } from '@shared/schema';
import { Info } from 'lucide-react';

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
      {/* Header con instrucciones */}
      <div className="bg-blue-600 text-white px-4 py-2 rounded mb-6">
        <div className="flex items-center">
          <Info className="h-4 w-4 mr-2" />
          <span className="font-medium text-sm">Ingresa la información básica para comenzar la cotización</span>
        </div>
      </div>
      
      {/* Secciones en 3 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna 1: Cliente */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">
            Selección de Cliente
          </h4>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="client" className="text-xs font-medium text-slate-600 mb-1 block">
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
                <SelectContent className="max-h-60">
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        {/* Columna 2: Datos del Proyecto */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">
            Datos del Proyecto
          </h4>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name" className="text-xs font-medium text-slate-600 mb-1 block">
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
              <Label htmlFor="project-type" className="text-xs font-medium text-slate-600 mb-1 block">
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
        </div>
        
        {/* Columna 3: Duración */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">
            Duración y Planificación
          </h4>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-duration" className="text-xs font-medium text-slate-600 mb-1 block">
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
      </div>
      
      {/* Información e instrucciones */}
      <div className="mt-6 bg-gray-100 border border-gray-200 rounded p-4">
        <p className="font-medium text-sm text-gray-700 mb-2">Completa la información requerida para continuar</p>
        <ul className="text-xs text-gray-600 space-y-1 list-disc pl-5">
          <li>El cliente es obligatorio para poder generar la cotización.</li>
          <li>El nombre del proyecto debe ser descriptivo y específico.</li>
          <li>El tipo y duración del proyecto ayudan a calcular costos y plazos.</li>
        </ul>
      </div>
    </div>
  );
};

export default OptimizedBasicInfo;