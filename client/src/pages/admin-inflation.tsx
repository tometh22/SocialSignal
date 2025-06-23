import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, TrendingUp, Save, Upload } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

interface MonthlyInflation {
  id: number;
  year: number;
  month: number;
  inflationRate: number;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

interface SystemConfig {
  id: number;
  configKey: string;
  configValue: number;
  description?: string;
}

export default function AdminInflationPage() {
  const { toast } = useToast();
  const [newInflation, setNewInflation] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    inflationRate: 0,
    source: 'INDEC'
  });
  const [exchangeRate, setExchangeRate] = useState(1100);

  // Obtener datos de inflación
  const { data: inflationData = [], isLoading } = useQuery<MonthlyInflation[]>({
    queryKey: ['/api/admin/monthly-inflation'],
  });

  // Obtener configuración del sistema
  const { data: systemConfig = [] } = useQuery<SystemConfig[]>({
    queryKey: ['/api/admin/system-config'],
  });

  // Mutación para crear/actualizar inflación
  const inflationMutation = useMutation({
    mutationFn: (data: typeof newInflation) => 
      apiRequest('/api/admin/monthly-inflation', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/monthly-inflation'] });
      toast({ title: 'Dato de inflación guardado exitosamente' });
      setNewInflation({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        inflationRate: 0,
        source: 'INDEC'
      });
    },
    onError: () => {
      toast({ title: 'Error al guardar dato de inflación', variant: 'destructive' });
    }
  });

  // Mutación para actualizar tipo de cambio
  const exchangeRateMutation = useMutation({
    mutationFn: (rate: number) => 
      apiRequest('/api/admin/system-config', 'POST', {
        configKey: 'usd_exchange_rate',
        configValue: rate,
        description: 'Tipo de cambio USD/ARS'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-config'] });
      toast({ title: 'Tipo de cambio actualizado exitosamente' });
    },
    onError: () => {
      toast({ title: 'Error al actualizar tipo de cambio', variant: 'destructive' });
    }
  });

  const handleSubmitInflation = (e: React.FormEvent) => {
    e.preventDefault();
    if (newInflation.inflationRate <= 0) {
      toast({ title: 'La tasa de inflación debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    inflationMutation.mutate(newInflation);
  };

  const handleUpdateExchangeRate = () => {
    if (exchangeRate <= 0) {
      toast({ title: 'El tipo de cambio debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    exchangeRateMutation.mutate(exchangeRate);
  };

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const currentExchangeRate = systemConfig.find(c => c.configKey === 'usd_exchange_rate')?.configValue || 1100;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Administración de Inflación</h1>
          <p className="text-gray-600 mt-2">Gestiona los datos históricos de inflación y configuración del sistema</p>
        </div>
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          <TrendingUp className="mr-1 h-4 w-4" />
          {inflationData.length} registros
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario para agregar/actualizar inflación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5" />
              Agregar Dato de Inflación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitInflation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Año</Label>
                  <Input
                    id="year"
                    type="number"
                    min="2020"
                    max="2030"
                    value={newInflation.year}
                    onChange={(e) => setNewInflation({...newInflation, year: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="month">Mes</Label>
                  <Select 
                    value={newInflation.month.toString()} 
                    onValueChange={(value) => setNewInflation({...newInflation, month: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, index) => (
                        <SelectItem key={index + 1} value={(index + 1).toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inflationRate">Tasa de Inflación Mensual (%)</Label>
                <Input
                  id="inflationRate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ej: 8.5"
                  value={newInflation.inflationRate || ''}
                  onChange={(e) => setNewInflation({...newInflation, inflationRate: parseFloat(e.target.value) || 0})}
                />
                <div className="text-xs text-gray-500">
                  Ingresa la tasa mensual real (ej: 8.5% = 8.5)
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Fuente</Label>
                <Select 
                  value={newInflation.source} 
                  onValueChange={(value) => setNewInflation({...newInflation, source: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDEC">INDEC</SelectItem>
                    <SelectItem value="BCRA">BCRA</SelectItem>
                    <SelectItem value="CAME">CAME</SelectItem>
                    <SelectItem value="Consultora">Consultora Privada</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={inflationMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {inflationMutation.isPending ? 'Guardando...' : 'Guardar Dato'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Configuración del tipo de cambio */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exchangeRate">Tipo de Cambio USD/ARS</Label>
              <div className="flex space-x-2">
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="1100"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                />
                <Button 
                  onClick={handleUpdateExchangeRate}
                  disabled={exchangeRateMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-gray-500">
                Actual: ${currentExchangeRate.toLocaleString()} ARS = 1 USD
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-1">Información</div>
              <div className="text-sm text-blue-700">
                Los datos de inflación se usan para proyectar costos futuros en las cotizaciones.
                El sistema calculará automáticamente el promedio de los últimos 12 meses.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de datos históricos */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Inflación</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Cargando datos...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Tasa Mensual</TableHead>
                    <TableHead>Tasa Anualizada</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Última Actualización</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inflationData.map((item) => {
                    const annualizedRate = (Math.pow(1 + item.inflationRate, 12) - 1) * 100;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {months[item.month - 1]} {item.year}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-orange-600 border-orange-200">
                            {(item.inflationRate * 100).toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-red-600">
                            {annualizedRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.source || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(item.updatedAt).toLocaleDateString('es-AR')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {inflationData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No hay datos de inflación cargados. Agrega el primer registro.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}