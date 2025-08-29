import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Database, FileSpreadsheet, Users, TrendingUp, RefreshCw, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SyncStatus {
  isRunning: boolean;
  nextSync?: string;
}

interface SyncResult {
  success: boolean;
  message: string;
  data?: {
    sales: {
      imported: number;
      updated: number;
      errors: string[];
    };
    duration: number;
  };
  timestamp: string;
}

export default function ExcelMaestroPage() {
  const queryClient = useQueryClient();

  // Obtener estado de sincronización
  const { data: syncStatus, isLoading: statusLoading } = useQuery<{ success: boolean; status: SyncStatus; timestamp: string }>({
    queryKey: ['/api/auto-sync/status'],
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Obtener datos de ventas para mostrar estadísticas
  const { data: salesData } = useQuery({
    queryKey: ['/api/google-sheets/sales'],
  });

  // Ejecutar sincronización manual
  const syncMutation = useMutation({
    mutationFn: () => apiRequest('/api/auto-sync/execute', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auto-sync/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/google-sheets/sales'] });
    },
  });

  const handleManualSync = () => {
    syncMutation.mutate();
  };

  const isRunning = syncStatus?.status?.isRunning || false;
  const nextSync = syncStatus?.status?.nextSync ? new Date(syncStatus.status.nextSync) : null;
  const totalSales = Array.isArray(salesData) ? salesData.length : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Excel MAESTRO</h1>
          <p className="text-muted-foreground">
            Centro de integración automática con Google Sheets
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          {isRunning ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Conectado
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />
              Detenido
            </>
          )}
        </Badge>
      </div>

      {/* Estado de Sincronización */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próxima Sincronización
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nextSync ? new Date(nextSync).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Automática cada 30 minutos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Registros de Ventas
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground">
              Sincronizadas desde Excel
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Estado del Sistema
            </CardTitle>
            {isRunning ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isRunning ? 'text-green-600' : 'text-yellow-600'}`}>
              {isRunning ? 'Activo' : 'Detenido'}
            </div>
            <p className="text-xs text-muted-foreground">
              {isRunning ? 'Sincronización automática ejecutándose' : 'Sincronización automática pausada'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fuentes de Datos */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Ventas Tomi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Estado</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Sincronizado
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Última actualización</span>
              <span className="text-sm font-medium">
                {syncStatus?.timestamp ? new Date(syncStatus.timestamp).toLocaleTimeString('es-AR') : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Registros</span>
              <span className="text-sm font-medium">{totalSales} ventas</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleManualSync}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                'Sincronizar Ahora'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gestión de Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              El sistema sincroniza automáticamente datos del Excel MAESTRO cada 30 minutos.
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Ventas Tomi - Datos operacionales</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span>Proyectos confirmados - Seguimiento</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                <span>Tipos de cambio - Análisis financiero</span>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                Los datos se sincronizan de forma bidireccional preservando la integridad del Excel MAESTRO.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resultado de Última Sincronización */}
      {syncMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resultado de Última Sincronización
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    syncMutation.data.success ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm">{syncMutation.data.message}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(syncMutation.data.timestamp).toLocaleTimeString('es-AR')}
                </span>
              </div>
              
              {syncMutation.data.data && (
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>Importadas: {syncMutation.data.data.sales.imported}</div>
                  <div>Actualizadas: {syncMutation.data.data.sales.updated}</div>
                  <div>Duración: {Math.round(syncMutation.data.data.duration / 1000)}s</div>
                  <div>Errores: {syncMutation.data.data.sales.errors.length}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs de Actividad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Estado de Integración
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm">Sincronización automática activa</span>
              </div>
              <span className="text-xs text-muted-foreground">Cada 30 min</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm">Conexión con Google Sheets establecida</span>
              </div>
              <span className="text-xs text-muted-foreground">Activa</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm">Base de datos lista para recibir datos</span>
              </div>
              <span className="text-xs text-muted-foreground">Operacional</span>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm">Sistema de duplicados funcionando</span>
              </div>
              <span className="text-xs text-muted-foreground">Validado</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}