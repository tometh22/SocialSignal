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
          <div className="space-y-1.5">
            <Label htmlFor="client" className="text-sm font-medium text-neutral-700 flex items-center">
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
              <SelectTrigger id="client" className="w-full bg-white border-neutral-200 h-10 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-neutral-800">
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent className="border border-neutral-200 bg-white">
                {isLoadingClients ? (
                  <div className="py-2 px-3 text-sm text-neutral-500 flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 text-primary mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cargando clientes...
                  </div>
                ) : (
                  clients?.map((client) => (
                    <SelectItem 
                      key={client.id} 
                      value={String(client.id)}
                      className="hover:bg-neutral-50"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{client.name}</span>
                        {client.contactName && (
                          <span className="text-xs text-neutral-500">{client.contactName}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-500 mt-1">Selecciona el cliente para el que se realizará esta cotización</p>
          </div>

          {/* Nombre del Proyecto */}
          <div className="space-y-1.5">
            <Label htmlFor="project-name" className="text-sm font-medium text-neutral-700 flex items-center">
              Nombre del Proyecto <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder="Ej. Análisis de Mercado Q2 2023"
              value={quotationData.project.name}
              onChange={(e) => updateProjectName(e.target.value)}
              className="bg-white border-neutral-200 h-10 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-neutral-800"
            />
            <p className="text-xs text-neutral-500 mt-1">Utiliza un nombre descriptivo y específico</p>
          </div>
        </div>

        {/* Tipo y Duración */}
        <div className="space-y-6">
          {/* Tipo de Proyecto */}
          <div className="space-y-1.5">
            <Label htmlFor="project-type" className="text-sm font-medium text-neutral-700">Tipo de Proyecto</Label>
            <Select
              value={quotationData.project.type}
              onValueChange={updateProjectType}
              disabled={isLoadingProjectTypes}
            >
              <SelectTrigger id="project-type" className="w-full bg-white border-neutral-200 h-10 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-neutral-800">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent className="border border-neutral-200 bg-white">
                {isLoadingProjectTypes ? (
                  <div className="py-2 px-3 text-sm text-neutral-500 flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 text-primary mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cargando tipos...
                  </div>
                ) : (
                  projectTypes?.map((type) => (
                    <SelectItem 
                      key={type.value} 
                      value={type.value}
                      className="hover:bg-neutral-50"
                    >
                      {type.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-500 mt-1">El tipo de proyecto determina la estructura base de la cotización</p>
          </div>

          {/* Duración del Proyecto */}
          <div className="space-y-1.5">
            <Label htmlFor="project-duration" className="text-sm font-medium text-neutral-700">Duración del Proyecto</Label>
            <Select
              value={quotationData.project.duration}
              onValueChange={(value) => updateProjectDuration(value as any)}
            >
              <SelectTrigger id="project-duration" className="w-full bg-white border-neutral-200 h-10 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-neutral-800">
                <SelectValue placeholder="Seleccionar duración" />
              </SelectTrigger>
              <SelectContent className="border border-neutral-200 bg-white">
                <SelectItem value="short" className="hover:bg-neutral-50">Corto (1-3 meses)</SelectItem>
                <SelectItem value="medium" className="hover:bg-neutral-50">Medio (3-6 meses)</SelectItem>
                <SelectItem value="long" className="hover:bg-neutral-50">Largo (6+ meses)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-500 mt-1">La duración afecta la planificación de recursos y costos</p>
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