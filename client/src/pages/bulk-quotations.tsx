import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSpreadsheet, CheckCircle, AlertCircle, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BulkQuotations() {
  const [dryRun, setDryRun] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query para obtener datos del Excel
  const {
    data: excelData,
    isLoading: excelLoading,
    error: excelError,
    refetch: refetchExcel
  } = useQuery<{
    success: boolean;
    data: Array<{
      cliente: string;
      proyecto: string;
      detalle: string;
      monedaCotizacion: string;
      equipo: Array<{
        persona: string;
        rol: string;
        horas: number;
        tarifaARS?: number;
        tarifaUSD?: number;
      }>;
    }>;
    resumen: {
      pestañaUtilizada: string;
      totalFilasProcesadas: number;
      filasVálidas: number;
      cotizacionesAgrupadas: number;
      columnasDetectadas: number;
    };
  }>({
    queryKey: ['/api/google-sheets/cotizaciones-masivas'],
    enabled: false // Solo cargar cuando se solicite
  });

  // Mutation para crear cotizaciones
  const createQuotationsMutation = useMutation({
    mutationFn: async (data: { dryRun: boolean }) => {
      const response = await fetch('/api/bulk-create/quotations-from-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: dryRun ? "Análisis completado" : "Cotizaciones creadas",
        description: `${data.resumen.exitosas} cotizaciones ${dryRun ? 'validadas' : 'creadas'} exitosamente`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLoadExcel = () => {
    refetchExcel();
  };

  const handleCreateQuotations = () => {
    createQuotationsMutation.mutate({ dryRun });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cotizaciones Masivas</h1>
          <p className="text-muted-foreground">
            Crear múltiples cotizaciones desde Excel MAESTRO
          </p>
        </div>
        <FileSpreadsheet className="h-8 w-8 text-primary" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Datos del Excel MAESTRO
          </CardTitle>
          <CardDescription>
            Carga y revisa los datos de la pestaña "Cotizaciones Masivas"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleLoadExcel}
            disabled={excelLoading}
            className="w-full"
          >
            {excelLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando Excel...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Cargar Datos del Excel
              </>
            )}
          </Button>

          {excelError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Error al cargar Excel: {(excelError as any).message}
              </AlertDescription>
            </Alert>
          )}

          {excelData && excelData.success && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Excel cargado exitosamente desde pestaña: <strong>{excelData.resumen.pestañaUtilizada}</strong>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{excelData.resumen.totalFilasProcesadas}</div>
                  <div className="text-sm text-muted-foreground">Filas totales</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{excelData.resumen.filasVálidas}</div>
                  <div className="text-sm text-muted-foreground">Filas válidas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{excelData.resumen.cotizacionesAgrupadas}</div>
                  <div className="text-sm text-muted-foreground">Cotizaciones</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{excelData.resumen.columnasDetectadas}</div>
                  <div className="text-sm text-muted-foreground">Columnas</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Vista previa de cotizaciones:</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {excelData.data.slice(0, 5).map((quotation: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{quotation.cliente}</div>
                        <div className="text-sm text-muted-foreground">{quotation.proyecto}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{quotation.monedaCotizacion}</Badge>
                        <Badge variant="secondary">{quotation.equipo.length} miembros</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {excelData.data.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    ... y {excelData.data.length - 5} cotizaciones más
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {excelData && excelData.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Crear Cotizaciones
            </CardTitle>
            <CardDescription>
              Procesa los datos y genera las cotizaciones en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="dryRun"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="dryRun" className="text-sm font-medium">
                Modo análisis (solo validar, no crear cotizaciones reales)
              </label>
            </div>

            <Button
              onClick={handleCreateQuotations}
              disabled={createQuotationsMutation.isPending}
              className={`w-full ${dryRun ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {createQuotationsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {dryRun ? 'Analizando...' : 'Creando cotizaciones...'}
                </>
              ) : (
                <>
                  {dryRun ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Analizar Cotizaciones
                    </>
                  ) : (
                    <>
                      <DollarSign className="mr-2 h-4 w-4" />
                      Crear Cotizaciones
                    </>
                  )}
                </>
              )}
            </Button>

            {createQuotationsMutation.data && (
              <div className="space-y-4">
                <Alert variant={createQuotationsMutation.data.errores.length > 0 ? "destructive" : "default"}>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div>
                        <strong>Resumen:</strong> {createQuotationsMutation.data.message}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="font-bold">{createQuotationsMutation.data.resumen.total}</div>
                          <div className="text-xs">Total</div>
                        </div>
                        <div>
                          <div className="font-bold text-green-600">{createQuotationsMutation.data.resumen.exitosas}</div>
                          <div className="text-xs">Exitosas</div>
                        </div>
                        <div>
                          <div className="font-bold text-red-600">{createQuotationsMutation.data.resumen.errores}</div>
                          <div className="text-xs">Errores</div>
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                {createQuotationsMutation.data.errores.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-destructive">Errores encontrados:</h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {createQuotationsMutation.data.errores.map((error: any, index: number) => (
                        <div key={index} className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm">
                          <strong>{error.cliente} - {error.proyecto}:</strong> {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {createQuotationsMutation.data.cotizaciones.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-green-600">
                      {dryRun ? 'Cotizaciones validadas:' : 'Cotizaciones creadas:'}
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {createQuotationsMutation.data.cotizaciones.slice(0, 5).map((quotation: any, index: number) => (
                        <div key={index} className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                          <div className="flex justify-between items-center">
                            <span><strong>{quotation.cliente}</strong> - {quotation.proyecto}</span>
                            {!dryRun && quotation.totalUSD && (
                              <Badge variant="outline">
                                ${Math.round(quotation.totalUSD)} USD
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {createQuotationsMutation.data.cotizaciones.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center">
                        ... y {createQuotationsMutation.data.cotizaciones.length - 5} más
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}