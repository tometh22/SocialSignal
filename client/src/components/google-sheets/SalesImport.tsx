import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authFetch } from '@/lib/queryClient';
import { Loader2, Download, Upload, Eye, Trash2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';

interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  totalProcessed: number;
  errors: string[];
  message: string;
}

interface SalesData {
  id: number;
  clientName: string;
  projectName: string;
  month: string;
  year: number;
  salesType: string;
  amountArs: string;
  amountUsd: string;
  confirmed: string;
  status: string;
  monthNumber: number;
  clientId: number | null;
  projectId: number | null;
  rowNumber: number;
  importBatch: string;
  uniqueKey: string;
  createdAt: string;
  lastUpdated: string;
}

export default function SalesImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  // Obtener ventas importadas
  const { data: salesData, isLoading: loadingSales, refetch: refetchSales } = useQuery({
    queryKey: ['/api/google-sheets/sales'],
    queryFn: () => authFetch('/api/google-sheets/sales').then(res => res.json()),
    enabled: true
  });

  // Probar lectura de datos
  const testSalesMutation = useMutation({
    mutationFn: () => apiRequest('/api/google-sheets/test-sales'),
    onSuccess: (data) => {
      console.log('Test sales data:', data);
      toast({
        title: "Conexión exitosa",
        description: `Se encontraron ${data.totalCount} registros en Google Sheets`,
      });
    },
    onError: (error: any) => {
      console.error('Error testing sales:', error);
      toast({
        title: "Error de conexión",
        description: error.message || "No se pudo conectar con Google Sheets",
        variant: "destructive",
      });
    }
  });

  // Importar ventas
  const importSalesMutation = useMutation({
    mutationFn: () => apiRequest('/api/google-sheets/import-sales', {
      method: 'POST'
    }),
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      refetchSales();
      queryClient.invalidateQueries({ queryKey: ['/api/google-sheets/sales'] });
      
      toast({
        title: "Importación completada",
        description: `${data.imported} nuevos registros, ${data.updated} actualizados`,
      });
    },
    onError: (error: any) => {
      console.error('Error importing sales:', error);
      toast({
        title: "Error de importación",
        description: error.message || "No se pudieron importar las ventas",
        variant: "destructive",
      });
    }
  });

  // Limpiar datos
  const clearSalesMutation = useMutation({
    mutationFn: () => apiRequest('/api/google-sheets/sales', {
      method: 'DELETE'
    }),
    onSuccess: () => {
      refetchSales();
      setImportResult(null);
      toast({
        title: "Datos eliminados",
        description: "Todos los datos de ventas han sido eliminados",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron eliminar los datos",
        variant: "destructive",
      });
    }
  });

  const handleImport = async () => {
    setIsImporting(true);
    try {
      await importSalesMutation.mutateAsync();
    } finally {
      setIsImporting(false);
    }
  };

  const handleTest = () => {
    testSalesMutation.mutate();
  };

  const handleClear = () => {
    if (confirm('¿Estás seguro de que deseas eliminar todos los datos de ventas importados?')) {
      clearSalesMutation.mutate();
    }
  };

  const sales: SalesData[] = (salesData as any)?.sales || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importación de Ventas desde Google Sheets
          </CardTitle>
          <CardDescription>
            Importar datos de ventas desde la pestaña "Ventas Tomi" del Excel MAESTRO
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={handleTest}
              variant="outline"
              disabled={testSalesMutation.isPending}
            >
              {testSalesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Probando...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Probar Conexión
                </>
              )}
            </Button>

            <Button 
              onClick={handleImport}
              disabled={isImporting || importSalesMutation.isPending}
            >
              {(isImporting || importSalesMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Ventas
                </>
              )}
            </Button>

            {sales.length > 0 && (
              <Button 
                onClick={handleClear}
                variant="destructive"
                disabled={clearSalesMutation.isPending}
              >
                {clearSalesMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpiar Datos
                  </>
                )}
              </Button>
            )}
          </div>

          {importResult && (
            <Alert className={importResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">{importResult.message}</p>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{importResult.imported} importados</Badge>
                    <Badge variant="secondary">{importResult.updated} actualizados</Badge>
                    <Badge variant="outline">{importResult.totalProcessed} procesados</Badge>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-red-600">Errores:</p>
                      <ul className="text-sm text-red-600 list-disc list-inside">
                        {importResult.errors.slice(0, 5).map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                        {importResult.errors.length > 5 && (
                          <li>... y {importResult.errors.length - 5} errores más</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Lista de ventas importadas */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas Importadas ({sales.length})</CardTitle>
          <CardDescription>
            Datos importados desde Google Sheets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSales ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Cargando ventas...</span>
            </div>
          ) : sales.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No hay ventas importadas. Haz clic en "Importar Ventas" para comenzar.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sales.slice(0, 12).map((sale) => (
                  <div key={sale.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-sm">{sale.clientName}</h4>
                      <Badge variant={sale.status === 'completada' ? 'default' : 
                                   sale.status === 'activa' ? 'secondary' : 'outline'}>
                        {sale.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{sale.projectName}</p>
                    <div className="text-xs space-y-1">
                      <p><span className="font-medium">Período:</span> {sale.month} {sale.year}</p>
                      <p><span className="font-medium">Tipo:</span> {sale.salesType}</p>
                      {sale.amountUsd && (
                        <p><span className="font-medium">USD:</span> ${sale.amountUsd}</p>
                      )}
                      {sale.amountArs && (
                        <p><span className="font-medium">ARS:</span> ${sale.amountArs}</p>
                      )}
                      <p><span className="font-medium">Confirmado:</span> {sale.confirmed}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {sales.length > 12 && (
                <p className="text-sm text-muted-foreground text-center">
                  ... y {sales.length - 12} ventas más
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}