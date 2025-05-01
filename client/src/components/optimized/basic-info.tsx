import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Client } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Calendar, FileType2, User, Mail, Phone, Info, Clock, Tag } from 'lucide-react';

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
      {/* Contenedor de datos con header */}
      <div className="border border-slate-200 rounded-md shadow-sm overflow-hidden bg-white">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3">
          <h3 className="text-base font-medium text-white flex items-center">
            <Info className="h-4 w-4 mr-2 opacity-90" />
            Ingresa la información básica para comenzar la cotización
          </h3>
        </div>
        
        {/* Formulario en 3 columnas */}
        <div className="p-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
            {/* Columna 1: Cliente */}
            <div>
              <div className="flex items-center mb-3 gap-1.5">
                <Building2 className="h-4 w-4 text-blue-500" />
                <h4 className="font-medium text-sm text-slate-700">Selección de Cliente</h4>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="client" className="text-xs font-medium text-slate-600 mb-1 inline-block">
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
                    <SelectTrigger 
                      id="client" 
                      className="w-full text-sm h-9 border-slate-300 bg-white focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    >
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
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
            
            {/* Columna 2: Datos de Proyecto */}
            <div>
              <div className="flex items-center mb-3 gap-1.5">
                <FileType2 className="h-4 w-4 text-blue-500" />
                <h4 className="font-medium text-sm text-slate-700">Datos del Proyecto</h4>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="project-name" className="text-xs font-medium text-slate-600 mb-1 inline-block">
                    Nombre del Proyecto <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="project-name"
                    placeholder="Ej. Análisis de Mercado Q2 2023"
                    value={quotationData.project.name}
                    onChange={(e) => updateProjectName(e.target.value)}
                    className="text-sm h-9 border-slate-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
                
                <div>
                  <Label htmlFor="project-type" className="text-xs font-medium text-slate-600 mb-1 inline-block">
                    Tipo de Proyecto
                  </Label>
                  <Select
                    value={quotationData.project.type}
                    onValueChange={updateProjectType}
                    disabled={isLoadingProjectTypes}
                  >
                    <SelectTrigger 
                      id="project-type"
                      className="text-sm h-9 border-slate-300 bg-white focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    >
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
              <div className="flex items-center mb-3 gap-1.5">
                <Calendar className="h-4 w-4 text-blue-500" />
                <h4 className="font-medium text-sm text-slate-700">Duración y Planificación</h4>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="project-duration" className="text-xs font-medium text-slate-600 mb-1 inline-block">
                    Duración Estimada
                  </Label>
                  <Select
                    value={quotationData.project.duration}
                    onValueChange={(value) => updateProjectDuration(value as any)}
                  >
                    <SelectTrigger 
                      id="project-duration" 
                      className="text-sm h-9 border-slate-300 bg-white focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    >
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
          
          {/* Información adicional */}
          {quotationData.client && (
            <div className="mt-2">
              <Card className="border border-blue-100 bg-blue-50 shadow-none">
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="bg-blue-600 rounded-full p-1.5 flex-shrink-0 mt-0.5">
                    <Info className="h-4 w-4 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-blue-800">Datos del cliente seleccionado</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-blue-600" />
                        <div className="text-sm text-blue-900">
                          {quotationData.client.name}
                        </div>
                      </div>
                      
                      {quotationData.client.contactName && (
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-blue-600" />
                          <div className="text-sm text-blue-900">
                            {quotationData.client.contactName}
                          </div>
                        </div>
                      )}
                      
                      {quotationData.client.contactEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-blue-600" />
                          <div className="text-sm text-blue-900">
                            {quotationData.client.contactEmail}
                          </div>
                        </div>
                      )}
                      
                      {quotationData.client.contactPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-blue-600" />
                          <div className="text-sm text-blue-900">
                            {quotationData.client.contactPhone}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Instrucciones y nota */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200 flex text-sm mt-2">
            <Info className="h-5 w-5 mr-2 text-slate-500 flex-shrink-0" />
            <div className="space-y-1.5">
              <p className="font-medium text-slate-700">
                Completa la información requerida para continuar
              </p>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                <li>El cliente es obligatorio para poder generar la cotización.</li>
                <li>El nombre del proyecto debe ser descriptivo y específico.</li>
                <li>El tipo y duración del proyecto ayudan a calcular costos y plazos.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedBasicInfo;