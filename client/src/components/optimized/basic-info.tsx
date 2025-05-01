import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Client } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
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
      {/* Header informativo */}
      <div className="bg-blue-600 text-white px-4 py-2 rounded-lg mb-6">
        <div className="flex items-center">
          <Info className="h-5 w-5 mr-2" />
          <span className="font-medium">Ingresa la información básica para comenzar la cotización</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sección Cliente */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-3">
            Selección de Cliente
          </h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
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
                <SelectTrigger id="client" className="w-full">
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
        
        {/* Nombre y Tipo */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-3">
            Datos del Proyecto
          </h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
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
            
            <div className="space-y-2">
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
        </div>
        
        {/* Duración */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-3">
            Duración y Planificación
          </h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
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
      </div>
      
      {/* Información del cliente */}
      {quotationData.client && (
        <div className="mt-6">
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-sm font-semibold text-slate-700 mb-1">Nombre del Cliente</h5>
                  <p className="text-slate-600">{quotationData.client.name}</p>
                </div>
                
                {quotationData.client.contactName && (
                  <div>
                    <h5 className="text-sm font-semibold text-slate-700 mb-1">Contacto</h5>
                    <p className="text-slate-600">{quotationData.client.contactName}</p>
                  </div>
                )}
                
                {quotationData.client.contactEmail && (
                  <div>
                    <h5 className="text-sm font-semibold text-slate-700 mb-1">Email</h5>
                    <p className="text-slate-600">{quotationData.client.contactEmail}</p>
                  </div>
                )}
                
                {quotationData.client.contactPhone && (
                  <div>
                    <h5 className="text-sm font-semibold text-slate-700 mb-1">Teléfono</h5>
                    <p className="text-slate-600">{quotationData.client.contactPhone}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Instrucciones */}
      <div className="mt-6 p-4 bg-slate-800 text-white rounded-lg">
        <p className="font-medium mb-2">Completa la información requerida para continuar</p>
        <ul className="text-sm text-slate-300 space-y-1 list-disc pl-5">
          <li>El cliente es obligatorio para poder generar la cotización.</li>
          <li>El nombre del proyecto debe ser descriptivo y específico.</li>
          <li>El tipo y duración del proyecto ayudan a calcular costos y plazos.</li>
        </ul>
      </div>
    </div>
  );
};

export default OptimizedBasicInfo;