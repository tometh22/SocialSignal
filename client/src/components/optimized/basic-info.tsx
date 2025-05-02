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
      <div className="flex items-center mb-5">
        <div className="flex-shrink-0">
          <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3 font-medium">1</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Información Básica</h2>
          <p className="text-sm text-gray-600 mt-1">
            Datos principales del proyecto
          </p>
        </div>
      </div>

      {/* Grid con columnas y gap según estándares - 24px de gap, 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
        {/* Cliente y Nombre del Proyecto */}
        <div className="space-y-6">
          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="client" className="text-sm font-semibold flex items-center">
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
              <SelectTrigger id="client" className="w-full bg-white rounded-md h-12 text-sm px-3">
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)} className="text-sm">
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nombre del Proyecto */}
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-sm font-semibold flex items-center">
              Nombre del Proyecto <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder="Ej. Análisis de Mercado Q2 2023"
              value={quotationData.project.name}
              onChange={(e) => updateProjectName(e.target.value)}
              className="bg-white rounded-md h-12 px-3 text-sm"
            />
          </div>
        </div>

        {/* Tipo y Duración */}
        <div className="space-y-6">
          {/* Tipo de Proyecto */}
          <div className="space-y-2">
            <Label htmlFor="project-type" className="text-sm font-semibold">Tipo de Proyecto</Label>
            <Select
              value={quotationData.project.type}
              onValueChange={updateProjectType}
              disabled={isLoadingProjectTypes}
            >
              <SelectTrigger id="project-type" className="w-full bg-white rounded-md h-12 text-sm px-3">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {projectTypes?.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-sm">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duración del Proyecto */}
          <div className="space-y-2">
            <Label htmlFor="project-duration" className="text-sm font-semibold">Duración del Proyecto</Label>
            <Select
              value={quotationData.project.duration}
              onValueChange={(value) => updateProjectDuration(value as any)}
            >
              <SelectTrigger id="project-duration" className="w-full bg-white rounded-md h-12 text-sm px-3">
                <SelectValue placeholder="Seleccionar duración" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short" className="text-sm">Corto (1-3 meses)</SelectItem>
                <SelectItem value="medium" className="text-sm">Medio (3-6 meses)</SelectItem>
                <SelectItem value="long" className="text-sm">Largo (6+ meses)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Información del cliente seleccionado - 32px de separación vertical */}
      {quotationData.client && (
        <Card className="mt-8 bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="pb-3 px-4 py-4">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <CardTitle className="text-base font-semibold text-gray-700">Cliente seleccionado</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Nombre</p>
                <p className="text-gray-900 font-semibold mt-1">{quotationData.client.name}</p>
              </div>
              {quotationData.client.contactName && (
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Contacto</p>
                  <p className="text-gray-900 font-semibold mt-1">{quotationData.client.contactName}</p>
                </div>
              )}
              {quotationData.client.contactEmail && (
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Email</p>
                  <p className="text-gray-900 font-semibold mt-1">{quotationData.client.contactEmail}</p>
                </div>
              )}
              {quotationData.client.contactPhone && (
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Teléfono</p>
                  <p className="text-gray-900 font-semibold mt-1">{quotationData.client.contactPhone}</p>
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