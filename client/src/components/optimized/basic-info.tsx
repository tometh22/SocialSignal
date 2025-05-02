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
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0">
          <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3 font-medium">1</span>
        </div>
        <div>
          <h2 className="section-title">Información Básica</h2>
          <p className="body-text mt-1">
            Datos principales del proyecto
          </p>
        </div>
      </div>

      {/* Grid con columnas y gap según estándares - 24px de gap, 2 columnas */}
      <div className="form-grid grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6 wizard-step-transition">
        {/* Cliente y Nombre del Proyecto */}
        <div className="space-y-6">
          {/* Cliente */}
          <div className="form-group">
            <Label htmlFor="client" className="label text-sm font-semibold flex items-center label-spacing">
              Cliente <span className="text-red-500 ml-1">*</span>
            </Label>
            
            {/* Buscador rápido de clientes */}
            <div className="mb-2 relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text"
                placeholder="Buscar cliente..."
                className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-md input-field text-sm"
                onChange={(e) => {
                  // Implementación futura: filtrar clientes por nombre
                  // Este campo es para demonstración visual de acuerdo a las especificaciones
                }}
              />
            </div>
            
            <Select
              value={quotationData.client ? String(quotationData.client.id) : ''}
              onValueChange={(value) => {
                const selectedClient = clients?.find(client => client.id === parseInt(value));
                updateClient(selectedClient || null);
              }}
              disabled={isLoadingClients}
            >
              <SelectTrigger id="client" className="input-field w-full bg-white rounded-md px-3 text-sm">
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
          <div className="form-group">
            <Label htmlFor="project-name" className="label text-sm font-semibold flex items-center label-spacing">
              Nombre del Proyecto <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder="Ej. Análisis de Mercado Q2 2023"
              value={quotationData.project.name}
              onChange={(e) => updateProjectName(e.target.value)}
              className="input-field bg-white rounded-md px-3 text-sm"
            />
          </div>
        </div>

        {/* Tipo y Duración */}
        <div className="space-y-6">
          {/* Tipo de Proyecto */}
          <div className="form-group">
            <Label htmlFor="project-type" className="label text-sm font-semibold label-spacing">Tipo de Proyecto</Label>
            <Select
              value={quotationData.project.type}
              onValueChange={updateProjectType}
              disabled={isLoadingProjectTypes}
            >
              <SelectTrigger id="project-type" className="input-field w-full bg-white rounded-md px-3 text-sm">
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
          <div className="form-group">
            <Label htmlFor="project-duration" className="label text-sm font-semibold label-spacing">Duración del Proyecto</Label>
            <Select
              value={quotationData.project.duration}
              onValueChange={(value) => updateProjectDuration(value as any)}
            >
              <SelectTrigger id="project-duration" className="input-field w-full bg-white rounded-md px-3 text-sm">
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