import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Download, Upload, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

interface ImportResult {
  success: boolean;
  message: string;
  imported?: number;
  updated?: number;
  totalProcessed?: number;
  errors?: string[];
}

interface GoogleSheetsProject {
  id: number;
  projectName: string;
  projectType: string;
  clientName: string;
  isConfirmed: boolean;
  firstBillingMonth: string | null;
  firstBillingYear: number;
  originalCurrency: string;
  approvedPriceUSD: number;
  currentAmountUSD: number | null;
  googleSheetsKey: string;
}

interface GoogleSheetsClient {
  id: number;
  name: string;
  isFromGoogleSheets: boolean;
  googleSheetsKey: string | null;
}

interface GoogleSheetsClientsResponse {
  success: boolean;
  message: string;
  data: string[];
  count: number;
}

interface GoogleSheetsProjectsResponse {
  success: boolean;
  projects: GoogleSheetsProject[];
}

export default function GoogleSheetsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);

  // Query para obtener clientes desde Google Sheets
  const { data: googleSheetsClients, isLoading: loadingClients } = useQuery<GoogleSheetsClientsResponse>({
    queryKey: ['/api/google-sheets/clients'],
    enabled: true
  });

  // Query para obtener proyectos importados
  const { data: importedProjects, isLoading: loadingProjects } = useQuery<GoogleSheetsProjectsResponse>({
    queryKey: ['/api/google-sheets/projects'],
    enabled: true
  });

  // Mutation para importar clientes
  const importClientsMutation = useMutation({
    mutationFn: () => apiRequest('/api/google-sheets/import-clients', { method: 'POST' }),
    onSuccess: (data) => {
      toast({
        title: "Clientes importados exitosamente",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error al importar clientes",
        description: error.message || "Ocurrió un error inesperado",
      });
    }
  });

  // Mutation para importar proyectos
  const importProjectsMutation = useMutation({
    mutationFn: () => apiRequest('/api/google-sheets/import-projects', { method: 'POST' }),
    onSuccess: (data: ImportResult) => {
      toast({
        title: "Proyectos importados exitosamente",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/google-sheets/projects'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error al importar proyectos",
        description: error.message || "Ocurrió un error inesperado",
      });
    }
  });

  const handleImportClients = async () => {
    setIsImporting(true);
    try {
      await importClientsMutation.mutateAsync();
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportProjects = async () => {
    setIsImporting(true);
    try {
      await importProjectsMutation.mutateAsync();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <FileSpreadsheet className="h-8 w-8 text-green-600" />
            Gestión de Google Sheets
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Importa y gestiona clientes y proyectos desde el Excel MAESTRO de Google Sheets
          </p>
        </div>

        {/* Import Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Importar Clientes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-500" />
                Importar Clientes
              </CardTitle>
              <CardDescription>
                Importa la lista de clientes desde la pestaña "Activo" (columna C) del Excel MAESTRO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {googleSheetsClients && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Clientes disponibles en Google Sheets: <Badge variant="outline">{googleSheetsClients.count || 0}</Badge>
                  </p>
                  {googleSheetsClients.data && googleSheetsClients.data.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {googleSheetsClients.data.slice(0, 5).map((client: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {client}
                        </Badge>
                      ))}
                      {googleSheetsClients.data.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{googleSheetsClients.data.length - 5} más...
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
              <Button
                onClick={handleImportClients}
                disabled={isImporting || importClientsMutation.isPending || loadingClients}
                className="w-full"
              >
                {importClientsMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Clientes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Importar Proyectos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-green-500" />
                Importar Proyectos
              </CardTitle>
              <CardDescription>
                Importa proyectos confirmados y estimados con su historial de facturación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {importedProjects && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Proyectos ya importados: <Badge variant="outline">{importedProjects.projects?.length || 0}</Badge>
                  </p>
                </div>
              )}
              <Button
                onClick={handleImportProjects}
                disabled={isImporting || importProjectsMutation.isPending || loadingProjects}
                className="w-full"
              >
                {importProjectsMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Proyectos
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Proyectos Importados */}
        {importedProjects?.projects && importedProjects.projects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Proyectos Importados ({importedProjects.projects.length})</CardTitle>
              <CardDescription>
                Proyectos sincronizados desde Google Sheets con su información de facturación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {importedProjects.projects.slice(0, 10).map((project: GoogleSheetsProject) => (
                  <div key={project.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{project.projectName}</h4>
                        <p className="text-sm text-gray-600">{project.clientName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={project.isConfirmed ? "default" : "secondary"}>
                          {project.isConfirmed ? "Confirmado" : "Estimado"}
                        </Badge>
                        <Badge variant="outline">
                          {project.projectType}
                        </Badge>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-700">Precio Aprobado</p>
                        <p className="text-green-600 font-mono">
                          ${project.approvedPriceUSD.toLocaleString()} USD
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Moneda Original</p>
                        <p>{project.originalCurrency}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Primer Facturación</p>
                        <p>{project.firstBillingMonth}/{project.firstBillingYear}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Monto Actual</p>
                        <p className="text-blue-600 font-mono">
                          {project.currentAmountUSD 
                            ? `$${project.currentAmountUSD.toLocaleString()} USD`
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {importedProjects.projects.length > 10 && (
                  <Alert>
                    <AlertDescription>
                      Mostrando los primeros 10 proyectos de {importedProjects.projects.length} total.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tipos de Proyecto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>One Shot</span>
                <Badge variant="outline">Único</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>FEE</span>
                <Badge variant="outline">Mensual</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Monedas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>USD</span>
                <Badge variant="default">Dólares</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>ARS</span>
                <Badge variant="secondary">Pesos</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Estados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Confirmado</span>
                <Badge variant="default">Aprobado</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estimado</span>
                <Badge variant="secondary">Propuesta</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}