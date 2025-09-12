import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";  
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";

interface DirectCostFromDB {
  id: number;
  monthKey: string;
  clientName: string;
  projectName: string;
  month: string;
  year: number;
  persona: string;
  horasRealesAsana: number;
  costoTotal: number;
  montoTotalUSD?: number;
  valorHoraPersona: number;
  projectId?: number;
  personnelId?: number;
}

export function ExcelMaestroAnalytics() {
  const { data: directCostsData, isLoading, error } = useQuery<DirectCostFromDB[]>({
    queryKey: ["/api/direct-costs"],
    refetchInterval: false, // ✅ Usar invalidación manual en lugar de polling
    staleTime: 2 * 60 * 1000, // 2 minutos - analytics no necesitan ser tan frecuentes
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Excel MAESTRO - Análisis Financiero</h2>
          <Badge variant="outline">Cargando...</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !directCostsData) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Error de Conexión</CardTitle>
          <CardDescription>
            No se pudo conectar con la base de datos de costos directos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error?.message || "Error desconocido"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const costosData = directCostsData;
  const count = directCostsData.length;
  const source = "Base de Datos";

  // Análisis de datos
  const personalUnico = Array.from(new Set(costosData.map(c => c.persona)));
  const costoTotalGeneral = costosData.reduce((sum, c) => sum + c.costoTotal, 0);
  const costoDirectoTotal = costosData.reduce((sum, c) => sum + c.costoTotal, 0); // Todo es costo directo en la DB
  const costoIndirectoTotal = 0; // No hay costos indirectos separados en la nueva estructura

  // Datos por persona
  const datosPorPersona = personalUnico.map(persona => {
    const registros = costosData.filter(c => c.persona === persona);
    const costoTotal = registros.reduce((sum, c) => sum + c.costoTotal, 0);
    const costoDirecto = costoTotal; // Todo es costo directo
    const costoIndirecto = 0; // No hay costos indirectos separados
    const valorHoraPromedio = registros
      .filter(r => r.valorHoraPersona > 0)
      .reduce((sum, r, _, arr) => sum + r.valorHoraPersona / arr.length, 0);
    
    return {
      persona,
      costoTotal,
      costoDirecto,
      costoIndirecto,
      valorHoraPromedio,
      registros: registros.length
    };
  }).sort((a, b) => b.costoTotal - a.costoTotal);

  // Datos por categoría (usando projectName como categoría)
  const datosPorCategoria = costosData.reduce((acc, c) => {
    const categoria = c.projectName || 'Sin categoría';
    if (!acc[categoria]) {
      acc[categoria] = { 
        categoria, 
        costoTotal: 0, 
        costoDirecto: 0, 
        costoIndirecto: 0,
        registros: 0 
      };
    }
    acc[categoria].costoTotal += c.costoTotal;
    acc[categoria].costoDirecto += c.costoTotal; // Todo es costo directo
    acc[categoria].costoIndirecto += 0; // No hay costos indirectos
    acc[categoria].registros += 1;
    return acc;
  }, {} as Record<string, any>);

  const datosCategoria = Object.values(datosPorCategoria)
    .sort((a: any, b: any) => b.costoTotal - a.costoTotal);

  // Colores para gráficos
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Excel MAESTRO - Análisis Financiero</h2>
          <p className="text-muted-foreground">
            Datos en tiempo real desde {source}
          </p>
        </div>
        <Badge variant="default" className="bg-green-500">
          {count} registros sincronizados
        </Badge>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personal Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{personalUnico.length}</div>
            <p className="text-xs text-muted-foreground">
              personas registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${costoTotalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              total acumulado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costos Directos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${costoDirectoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <Progress 
              value={(costoDirectoTotal / costoTotalGeneral) * 100} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costos Indirectos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${costoIndirectoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <Progress 
              value={(costoIndirectoTotal / costoTotalGeneral) * 100} 
              className="mt-2" 
            />
          </CardContent>
        </Card>
      </div>

      {/* Análisis detallado */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="personal">Análisis por Personal</TabsTrigger>
          <TabsTrigger value="categorias">Por Categorías</TabsTrigger>
          <TabsTrigger value="proyectos">Por Proyectos</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de barras - Costos por persona */}
            <Card>
              <CardHeader>
                <CardTitle>Costos por Persona</CardTitle>
                <CardDescription>
                  Distribución de costos totales por cada miembro del equipo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={datosPorPersona.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="persona" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => [
                        `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                        'Costo Total'
                      ]}
                    />
                    <Bar dataKey="costoTotal" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lista detallada de personal */}
            <Card>
              <CardHeader>
                <CardTitle>Detalle por Personal</CardTitle>
                <CardDescription>
                  Información detallada de cada miembro del equipo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-80 overflow-y-auto space-y-3">
                  {datosPorPersona.slice(0, 15).map((persona, index) => (
                    <div key={persona.persona} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="font-medium">{persona.persona}</div>
                        <div className="text-sm text-muted-foreground">
                          {persona.registros} registros
                          {persona.valorHoraPromedio > 0 && (
                            <span className="ml-2">
                              • ${persona.valorHoraPromedio.toLocaleString('es-AR')} / hora
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          ${persona.costoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          D: ${persona.costoDirecto.toLocaleString('es-AR')} 
                          • I: ${persona.costoIndirecto.toLocaleString('es-AR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categorias" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de pie - Distribución por categorías */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Categorías</CardTitle>
                <CardDescription>
                  Proporción de costos por tipo de actividad
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={datosCategoria.slice(0, 6)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ categoria, percent }) => `${categoria} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="costoTotal"
                    >
                      {datosCategoria.slice(0, 6).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [
                        `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                        'Costo Total'
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lista de categorías */}
            <Card>
              <CardHeader>
                <CardTitle>Detalle por Categorías</CardTitle>
                <CardDescription>
                  Análisis de costos por tipo de actividad
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-80 overflow-y-auto space-y-3">
                  {datosCategoria.map((categoria: any, index) => (
                    <div key={categoria.categoria} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <div className="font-medium">{categoria.categoria}</div>
                          <div className="text-sm text-muted-foreground">
                            {categoria.registros} registros
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          ${categoria.costoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {((categoria.costoTotal / costoTotalGeneral) * 100).toFixed(1)}% del total
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="proyectos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis por Proyectos</CardTitle>
              <CardDescription>
                Distribución de costos por proyecto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>Análisis de proyectos disponible próximamente</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}