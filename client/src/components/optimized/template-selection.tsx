import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportTemplate } from '@shared/schema';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { formatCurrency } from '@/lib/utils';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer 
} from 'recharts';
import { Search, Filter, Info } from 'lucide-react';

// Componente para el Paso 2: Selección de Plantilla
const OptimizedTemplateSelection: React.FC = () => {
  const {
    quotationData,
    updateTemplate,
    updateComplexity,
    updateCustomization,
    recommendedRoleIds,
    baseCost,
    totalAmount
  } = useOptimizedQuote();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [complexityFilter, setComplexityFilter] = useState<string>('');
  
  // Obtener plantillas de la API
  const { data: templates } = useQuery<ReportTemplate[]>({
    queryKey: ['/api/templates'],
  });
  
  // Filtrar plantillas por búsqueda y complejidad
  const filteredTemplates = templates?.filter(template => {
    const matchesSearch = searchTerm === '' || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesComplexity = complexityFilter === '' || 
      template.complexity === complexityFilter;
      
    return matchesSearch && matchesComplexity;
  });
  
  // Preparar datos para el gráfico comparativo
  const comparisonData = templates?.map(template => ({
    name: template.name.length > 15 ? template.name.substring(0, 15) + '...' : template.name,
    platformCost: template.platformCost || 0,
    isSelected: template.id === quotationData.template?.id
  }));
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Selección de Plantilla</h2>
          <p className="text-sm text-neutral-500">
            Selecciona la plantilla que mejor se adapte a tus necesidades y realiza ajustes rápidos.
          </p>
        </div>
      </div>
      
      {/* Filtros y búsqueda */}
      <div className="flex flex-wrap gap-4 items-center bg-neutral-50 p-4 rounded-lg">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 h-4 w-4" />
          <input 
            type="text"
            placeholder="Buscar plantillas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 py-2 rounded-md border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="w-auto">
          <Select value={complexityFilter} onValueChange={setComplexityFilter}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4 text-neutral-400" />
                <SelectValue placeholder="Filtrar por complejidad" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="low">Complejidad Baja</SelectItem>
              <SelectItem value="medium">Complejidad Media</SelectItem>
              <SelectItem value="high">Complejidad Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Selección visual de plantillas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Plantillas Disponibles</h3>
          <div className="overflow-y-auto max-h-[500px] space-y-3 pr-2">
            {filteredTemplates?.map(template => (
              <Card 
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  quotationData.template?.id === template.id 
                    ? 'ring-2 ring-blue-500' 
                    : ''
                }`}
                onClick={() => updateTemplate(template)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.complexity === 'high' && (
                      <Badge variant="default" className="bg-red-100 text-red-800 hover:bg-red-200">
                        Complejo
                      </Badge>
                    )}
                    {template.complexity === 'medium' && (
                      <Badge variant="default" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                        Medio
                      </Badge>
                    )}
                    {template.complexity === 'low' && (
                      <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
                        Simple
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-1 line-clamp-2">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 pb-3">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {template.pageRange && (
                      <Badge variant="outline" className="text-xs">
                        {template.pageRange}
                      </Badge>
                    )}
                    {template.features && template.features.split(',').map((feature, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {feature.trim()}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="py-2 border-t flex justify-between bg-neutral-50">
                  <div className="text-xs text-neutral-500">
                    Plataformas: {formatCurrency(template.platformCost || 0)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Roles recomendados: {template.recommendedRoles || '0'}
                  </div>
                </CardFooter>
              </Card>
            ))}
            
            {filteredTemplates?.length === 0 && (
              <div className="text-center py-6 bg-neutral-100 rounded-lg">
                <p className="text-neutral-500">No se encontraron plantillas con estos criterios</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Vista previa y detalles de la plantilla seleccionada */}
          {quotationData.template ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Plantilla Seleccionada</CardTitle>
                  <CardDescription>
                    Información detallada de la plantilla
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-1">{quotationData.template.name}</h4>
                    <p className="text-sm text-neutral-600">{quotationData.template.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-neutral-100 rounded-md">
                      <div className="text-xs text-neutral-500 mb-1">Costo de Plataformas</div>
                      <div className="font-medium">{formatCurrency(quotationData.template.platformCost || 0)}</div>
                    </div>
                    
                    <div className="p-3 bg-neutral-100 rounded-md">
                      <div className="text-xs text-neutral-500 mb-1">Roles Recomendados</div>
                      <div className="font-medium">{recommendedRoleIds.length}</div>
                    </div>
                    
                    <div className="p-3 bg-neutral-100 rounded-md">
                      <div className="text-xs text-neutral-500 mb-1">Desviación</div>
                      <div className="font-medium">{quotationData.template.deviationPercentage || 0}%</div>
                    </div>
                    
                    <div className="p-3 bg-neutral-100 rounded-md">
                      <div className="text-xs text-neutral-500 mb-1">Complejidad</div>
                      <div className="font-medium capitalize">{quotationData.template.complexity}</div>
                    </div>
                  </div>
                  
                  {/* Características adicionales */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium">Características:</h5>
                    <div className="flex flex-wrap gap-1">
                      {quotationData.template.pageRange && (
                        <Badge className="bg-neutral-100 text-neutral-800 hover:bg-neutral-200">
                          {quotationData.template.pageRange}
                        </Badge>
                      )}
                      {quotationData.template.features && quotationData.template.features.split(',').map((feature, i) => (
                        <Badge key={i} className="bg-neutral-100 text-neutral-800 hover:bg-neutral-200">
                          {feature.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Ajustes rápidos de complejidad */}
              <Card>
                <CardHeader>
                  <CardTitle>Ajustes Rápidos</CardTitle>
                  <CardDescription>
                    Personaliza la complejidad y añade notas específicas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="complexity">Nivel de Complejidad</Label>
                    <RadioGroup
                      value={quotationData.complexity}
                      onValueChange={(value) => updateComplexity(value as 'low' | 'medium' | 'high')}
                      className="grid grid-cols-3 gap-2 mt-2"
                      id="complexity"
                    >
                      <div className={`flex items-center justify-center p-2 border rounded cursor-pointer text-sm ${
                        quotationData.complexity === 'low' 
                          ? 'bg-green-50 border-green-200 text-green-800' 
                          : 'hover:bg-neutral-50'
                      }`}>
                        <RadioGroupItem value="low" id="low" className="sr-only" />
                        <Label htmlFor="low" className="cursor-pointer text-center w-full">
                          Simple
                        </Label>
                      </div>
                      
                      <div className={`flex items-center justify-center p-2 border rounded cursor-pointer text-sm ${
                        quotationData.complexity === 'medium' 
                          ? 'bg-amber-50 border-amber-200 text-amber-800' 
                          : 'hover:bg-neutral-50'
                      }`}>
                        <RadioGroupItem value="medium" id="medium" className="sr-only" />
                        <Label htmlFor="medium" className="cursor-pointer text-center w-full">
                          Estándar
                        </Label>
                      </div>
                      
                      <div className={`flex items-center justify-center p-2 border rounded cursor-pointer text-sm ${
                        quotationData.complexity === 'high' 
                          ? 'bg-red-50 border-red-200 text-red-800' 
                          : 'hover:bg-neutral-50'
                      }`}>
                        <RadioGroupItem value="high" id="high" className="sr-only" />
                        <Label htmlFor="high" className="cursor-pointer text-center w-full">
                          Complejo
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  <div>
                    <Label htmlFor="customization">Notas de Personalización</Label>
                    <Textarea
                      id="customization"
                      value={quotationData.customization}
                      onChange={(e) => updateCustomization(e.target.value)}
                      placeholder="Añade cualquier requerimiento especial o personalización..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* Estimación preliminar de costos */}
              <Card className="bg-blue-50 border border-blue-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-blue-800">Estimación Preliminar</CardTitle>
                  <CardDescription className="text-blue-600">
                    Basada en la plantilla seleccionada y configuración actual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-blue-600 mb-1">Horas Estimadas</div>
                      <div className="text-lg font-medium text-blue-800">
                        {recommendedRoleIds.length * 20}h
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-blue-600 mb-1">Roles Necesarios</div>
                      <div className="text-lg font-medium text-blue-800">
                        {recommendedRoleIds.length}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-blue-600 mb-1">Coste Base Aprox.</div>
                      <div className="text-lg font-medium text-blue-800">
                        {formatCurrency(baseCost)}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-blue-600 mb-1">Total Estimado</div>
                      <div className="text-lg font-medium text-blue-800">
                        {formatCurrency(totalAmount)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="h-full flex items-center justify-center bg-neutral-50 rounded-lg p-6">
              <div className="text-center max-w-md">
                <Info className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 mb-2">
                  Selecciona una plantilla
                </h3>
                <p className="text-sm text-neutral-600">
                  Escoge una plantilla de la lista para ver detalles y obtener una estimación preliminar de costos.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Gráfico comparativo de costos de plataforma */}
      {quotationData.template && comparisonData && comparisonData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparativa de Costos de Plataforma</CardTitle>
            <CardDescription>
              Comparación entre la plantilla seleccionada y otras opciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Bar 
                    dataKey="platformCost" 
                    name="Costo de Plataforma"
                    fill={(entry) => entry.isSelected ? '#3b82f6' : '#94a3b8'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OptimizedTemplateSelection;