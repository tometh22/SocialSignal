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
      <div className="flex items-center space-x-2 mb-6">
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">1</div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Información Básica</h2>
          <p className="text-sm text-gray-500">
            Ingresa la información básica para comenzar la cotización.
          </p>
        </div>
      </div>

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
        <Card className="mt-8 bg-gradient-to-r from-slate-50 to-white border border-blue-100 shadow-sm overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full opacity-50"></div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-lg text-blue-800">Información del Cliente</CardTitle>
            <CardDescription>Detalles del cliente seleccionado</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <p className="font-medium text-gray-700 mb-1">Nombre</p>
                <p className="text-gray-900">{quotationData.client.name}</p>
              </div>
              {quotationData.client.contactName && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Contacto</p>
                  <p className="text-gray-900">{quotationData.client.contactName}</p>
                </div>
              )}
              {quotationData.client.contactEmail && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Email</p>
                  <p className="text-gray-900">{quotationData.client.contactEmail}</p>
                </div>
              )}
              {quotationData.client.contactPhone && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Teléfono</p>
                  <p className="text-gray-900">{quotationData.client.contactPhone}</p>
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