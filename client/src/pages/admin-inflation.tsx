import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TrendingUp, DollarSign, Calendar, Plus, Edit2, Save, X } from "lucide-react";

interface MonthlyInflation {
  id: number;
  year: number;
  month: number;
  inflationRate: number;
  source?: string;
}

interface SystemConfig {
  id: number;
  configKey: string;
  configValue: number;
  description?: string;
}

export default function AdminInflationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingInflation, setEditingInflation] = useState<number | null>(null);
  const [newInflation, setNewInflation] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    inflationRate: 0,
    source: 'INDEC'
  });
  const [exchangeRate, setExchangeRate] = useState(0);

  // Obtener datos de inflación histórica
  const { data: inflationData = [], isLoading: loadingInflation } = useQuery({
    queryKey: ['/api/admin/monthly-inflation'],
    select: (data: MonthlyInflation[]) => data.sort((a, b) => 
      b.year - a.year || b.month - a.month
    )
  });

  // Obtener configuración del sistema
  const { data: systemConfig = [] } = useQuery<SystemConfig[]>({
    queryKey: ['/api/admin/system-config']
  });

  const currentExchangeRate = systemConfig.find((c: SystemConfig) => c.configKey === 'usd_exchange_rate')?.configValue || 0;

  // Mutación para agregar/actualizar inflación
  const inflationMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/admin/monthly-inflation', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/monthly-inflation'] });
      setNewInflation({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        inflationRate: 0,
        source: 'INDEC'
      });
      toast({ title: "Datos de inflación actualizados correctamente" });
    }
  });

  // Mutación para actualizar tipo de cambio
  const exchangeRateMutation = useMutation({
    mutationFn: (rate: number) => apiRequest('/api/admin/system-config', 'POST', {
      configKey: 'usd_exchange_rate',
      configValue: rate,
      description: 'Tipo de cambio USD/ARS'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-config'] });
      toast({ title: "Tipo de cambio actualizado correctamente" });
    }
  });

  const handleAddInflation = () => {
    if (newInflation.inflationRate === 0) {
      toast({ title: "Error", description: "Ingresa una tasa de inflación válida", variant: "destructive" });
      return;
    }
    inflationMutation.mutate(newInflation);
  };

  const handleUpdateExchangeRate = () => {
    if (exchangeRate <= 0) {
      toast({ title: "Error", description: "Ingresa un tipo de cambio válido", variant: "destructive" });
      return;
    }
    exchangeRateMutation.mutate(exchangeRate);
  };

  const getMonthName = (month: number) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month - 1];
  };

  const calculateAverageInflation = (months: number = 12) => {
    const recentData = inflationData.slice(0, months);
    if (recentData.length === 0) return 0;
    
    const average = recentData.reduce((sum, item) => sum + item.inflationRate, 0) / recentData.length;
    return average * 100; // Convertir a porcentaje
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Inflación</h1>
          <p className="text-gray-600 mt-1">Administra datos de inflación histórica y tipo de cambio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Estadísticas rápidas */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center p-6">
              <TrendingUp className="h-8 w-8 text-orange-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Promedio 3 meses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {calculateAverageInflation(3).toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <TrendingUp className="h-8 w-8 text-red-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Promedio 12 meses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {calculateAverageInflation(12).toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <DollarSign className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">USD/ARS</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${currentExchangeRate.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actualizar tipo de cambio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <DollarSign className="mr-2 h-5 w-5 text-green-600" />
              Tipo de Cambio
            </CardTitle>
            <CardDescription>
              Actualiza el tipo de cambio USD/ARS actual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="exchange-rate">Tipo de cambio USD/ARS</Label>
              <Input
                id="exchange-rate"
                type="number"
                step="0.01"
                value={exchangeRate || currentExchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
                placeholder="Ej: 1200.50"
              />
            </div>
            <Button 
              onClick={handleUpdateExchangeRate}
              disabled={exchangeRateMutation.isPending}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              Actualizar Tipo de Cambio
            </Button>
          </CardContent>
        </Card>

        {/* Agregar nueva inflación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Plus className="mr-2 h-5 w-5 text-blue-600" />
              Nueva Inflación Mensual
            </CardTitle>
            <CardDescription>
              Registra la inflación mensual oficial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="year">Año</Label>
                <Input
                  id="year"
                  type="number"
                  value={newInflation.year}
                  onChange={(e) => setNewInflation({...newInflation, year: Number(e.target.value)})}
                />
              </div>
              <div>
                <Label htmlFor="month">Mes</Label>
                <Input
                  id="month"
                  type="number"
                  min="1"
                  max="12"
                  value={newInflation.month}
                  onChange={(e) => setNewInflation({...newInflation, month: Number(e.target.value)})}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="inflation-rate">Tasa (% mensual)</Label>
              <Input
                id="inflation-rate"
                type="number"
                step="0.1"
                value={newInflation.inflationRate}
                onChange={(e) => setNewInflation({...newInflation, inflationRate: Number(e.target.value)})}
                placeholder="Ej: 8.3"
              />
            </div>
            <div>
              <Label htmlFor="source">Fuente</Label>
              <Input
                id="source"
                value={newInflation.source}
                onChange={(e) => setNewInflation({...newInflation, source: e.target.value})}
                placeholder="Ej: INDEC"
              />
            </div>
            <Button 
              onClick={handleAddInflation}
              disabled={inflationMutation.isPending}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Registrar Inflación
            </Button>
          </CardContent>
        </Card>

        {/* Historial de inflación */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Calendar className="mr-2 h-5 w-5 text-purple-600" />
              Historial de Inflación
            </CardTitle>
            <CardDescription>
              Datos mensuales registrados (últimos 24 meses)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInflation ? (
              <p className="text-center text-gray-500">Cargando datos...</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {inflationData.slice(0, 24).map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {getMonthName(item.month)} {item.year}
                      </p>
                      {item.source && (
                        <p className="text-xs text-gray-500">{item.source}</p>
                      )}
                    </div>
                    <Badge 
                      variant={item.inflationRate > 10 ? "destructive" : 
                               item.inflationRate > 5 ? "default" : "secondary"}
                    >
                      {(item.inflationRate * 100).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
                {inflationData.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No hay datos de inflación registrados
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}