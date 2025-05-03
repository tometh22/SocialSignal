import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Client } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { User, Calendar, FolderOpen } from 'lucide-react';

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

  // Loading spinner component para reutilizar
  const LoadingSpinner = () => (
    <svg className="animate-spin h-4 w-4 text-primary mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  return (
    <div className="space-y-6">
      {/* Formulario principal y datos del cliente en un solo componente */}
      <Card className="bg-white border border-neutral-100 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Panel izquierdo: Cliente y Nombre del Proyecto */}
            <div className="space-y-4 md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <div className="space-y-2">
                  <Label htmlFor="client" className="text-sm font-medium text-gray-700 flex items-center">
                    <User className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
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
                    <SelectTrigger id="client" className="w-full bg-white border-neutral-200 h-9 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-gray-800">
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent className="border border-neutral-200 bg-white">
                      {isLoadingClients ? (
                        <div className="py-2 px-3 text-sm text-gray-500 flex items-center justify-center">
                          <LoadingSpinner />
                          Cargando clientes...
                        </div>
                      ) : (
                        clients?.map((client) => (
                          <SelectItem 
                            key={client.id} 
                            value={String(client.id)}
                            className="hover:bg-neutral-50"
                          >
                            {client.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Nombre del Proyecto */}
                <div className="space-y-2">
                  <Label htmlFor="project-name" className="text-sm font-medium text-gray-700 flex items-center">
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
                    Nombre del Proyecto <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="project-name"
                    placeholder="Ej. Análisis de Mercado Q2 2023"
                    value={quotationData.project.name}
                    onChange={(e) => updateProjectName(e.target.value)}
                    className="bg-white border-neutral-200 h-9 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipo de Proyecto */}
                <div className="space-y-2">
                  <Label htmlFor="project-type" className="text-sm font-medium text-gray-700">Tipo de Proyecto</Label>
                  <Select
                    value={quotationData.project.type}
                    onValueChange={updateProjectType}
                    disabled={isLoadingProjectTypes}
                  >
                    <SelectTrigger id="project-type" className="w-full bg-white border-neutral-200 h-9 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-gray-800">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent className="border border-neutral-200 bg-white">
                      {isLoadingProjectTypes ? (
                        <div className="py-2 px-3 text-sm text-gray-500 flex items-center justify-center">
                          <LoadingSpinner />
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
                </div>

                {/* Duración del Proyecto */}
                <div className="space-y-2">
                  <Label htmlFor="project-duration" className="text-sm font-medium text-gray-700 flex items-center">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
                    Duración
                  </Label>
                  <Select
                    value={quotationData.project.duration}
                    onValueChange={(value) => updateProjectDuration(value as any)}
                  >
                    <SelectTrigger id="project-duration" className="w-full bg-white border-neutral-200 h-9 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-gray-800">
                      <SelectValue placeholder="Seleccionar duración" />
                    </SelectTrigger>
                    <SelectContent className="border border-neutral-200 bg-white">
                      <SelectItem value="short" className="hover:bg-neutral-50">Corto (1-3 meses)</SelectItem>
                      <SelectItem value="medium" className="hover:bg-neutral-50">Medio (3-6 meses)</SelectItem>
                      <SelectItem value="long" className="hover:bg-neutral-50">Largo (6+ meses)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Panel derecho: Información del cliente o ayuda contextual */}
            <div className="md:border-l border-neutral-100 md:pl-6">
              {quotationData.client ? (
                <div className="bg-slate-50 p-4 rounded-md">
                  <div className="flex items-center mb-2">
                    <User className="h-4 w-4 mr-2 text-primary" />
                    <h3 className="text-sm font-medium text-gray-700">Información de Contacto</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Empresa:</span>
                      <span className="font-medium text-gray-700">{quotationData.client.name}</span>
                    </div>
                    
                    {quotationData.client.contactName && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Contacto:</span>
                        <span className="text-gray-700">{quotationData.client.contactName}</span>
                      </div>
                    )}
                    
                    {quotationData.client.contactEmail && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Email:</span>
                        <span className="text-gray-700">{quotationData.client.contactEmail}</span>
                      </div>
                    )}
                    
                    {quotationData.client.contactPhone && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Teléfono:</span>
                        <span className="text-gray-700">{quotationData.client.contactPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 p-4 rounded-md h-full flex flex-col justify-center">
                  <h3 className="text-sm font-medium text-blue-700 mb-2">Información Inicial</h3>
                  <p className="text-xs text-blue-600">Selecciona un cliente y proporciona un nombre de proyecto para comenzar.</p>
                  <p className="text-xs text-blue-500 mt-2">Los campos marcados con <span className="text-red-500">*</span> son obligatorios.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OptimizedBasicInfo;