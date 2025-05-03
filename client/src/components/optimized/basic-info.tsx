import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Client } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
      {/* El encabezado ya está en la tarjeta principal, no es necesario duplicarlo aquí */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
        {/* Cliente y Nombre del Proyecto */}
        <div className="space-y-6">
          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="client" className="text-sm font-medium flex items-center">
              Cliente <span className="text-red-500 ml-1">*</span>
            </Label>
            <Select
              value={quotationData.client ? String(quotationData.client.id) : ''}
              onValueChange={(value) => {
                const selectedClient = clients?.find(client => client.id === parseInt(value));
                updateClient(selectedClient || null);
              }}
              disabled={isLoadingClients}
            >
              <SelectTrigger id="client" className="w-full bg-white rounded-md">
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

          {/* Nombre del Proyecto */}
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-sm font-medium flex items-center">
              Nombre del Proyecto <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder="Ej. Análisis de Mercado Q2 2023"
              value={quotationData.project.name}
              onChange={(e) => updateProjectName(e.target.value)}
              className="bg-white rounded-md"
            />
          </div>
        </div>

        {/* Tipo y Duración */}
        <div className="space-y-6">
          {/* Tipo de Proyecto */}
          <div className="space-y-2">
            <Label htmlFor="project-type" className="text-sm font-medium">Tipo de Proyecto</Label>
            <Select
              value={quotationData.project.type}
              onValueChange={updateProjectType}
              disabled={isLoadingProjectTypes}
            >
              <SelectTrigger id="project-type" className="w-full bg-white rounded-md">
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

          {/* Duración del Proyecto */}
          <div className="space-y-2">
            <Label htmlFor="project-duration" className="text-sm font-medium">Duración del Proyecto</Label>
            <Select
              value={quotationData.project.duration}
              onValueChange={(value) => updateProjectDuration(value as any)}
            >
              <SelectTrigger id="project-duration" className="w-full bg-white rounded-md">
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

      {/* Información del cliente seleccionado */}
      {quotationData.client && (
        <Card className="mt-8 bg-white border border-neutral-100 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-neutral-100">
            <div className="flex items-center">
              <div className="p-2 bg-neutral-50 rounded-sm mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-700">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div>
                <CardTitle className="text-base font-medium text-neutral-800">Información del Cliente</CardTitle>
                <CardDescription className="text-sm text-neutral-500">Detalles del cliente seleccionado</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <p className="font-medium text-neutral-500 mb-1 text-xs uppercase tracking-wide">Nombre</p>
                <p className="text-neutral-800">{quotationData.client.name}</p>
              </div>
              {quotationData.client.contactName && (
                <div>
                  <p className="font-medium text-neutral-500 mb-1 text-xs uppercase tracking-wide">Contacto</p>
                  <p className="text-neutral-800">{quotationData.client.contactName}</p>
                </div>
              )}
              {quotationData.client.contactEmail && (
                <div>
                  <p className="font-medium text-neutral-500 mb-1 text-xs uppercase tracking-wide">Email</p>
                  <p className="text-neutral-800">{quotationData.client.contactEmail}</p>
                </div>
              )}
              {quotationData.client.contactPhone && (
                <div>
                  <p className="font-medium text-neutral-500 mb-1 text-xs uppercase tracking-wide">Teléfono</p>
                  <p className="text-neutral-800">{quotationData.client.contactPhone}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OptimizedBasicInfo;