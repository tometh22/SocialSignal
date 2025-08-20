import React, { useState } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet, Users, Briefcase, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ImportProgress {
  step: string;
  current: number;
  total: number;
  details?: string;
}

interface ImportSummary {
  quotations: number;
  projects: number;
  timeEntries: number;
  errors: string[];
}

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    // Crear plantilla Excel con las columnas necesarias
    const template = `Cliente,Proyecto,Fecha Inicio,Fecha Fin,Estado,Tipo Proyecto,Costo Base USD,Horas Trabajadas,Personal Asignado,Markup Factor,Moneda,Descripcion,Análisis Tipo,Países Cubiertos,Volumen Menciones
"Ejemplo S.A.","Proyecto Demo","2024-01-15","2024-02-15","completed","desarrollo-web",2500,120,"Juan Pérez;María García",2.0,"ARS","Desarrollo de sitio web corporativo","standard","Argentina;Chile","medium"
"Tech Corp","App Mobile","2024-03-01","2024-04-30","in_progress","app-mobile",3500,200,"Carlos López",2.2,"USD","Aplicación móvil para e-commerce","comprehensive","México;Colombia;Perú","high"`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_proyectos_historicos.csv';
    link.click();
    
    toast({
      title: "Plantilla descargada",
      description: "Usa este archivo como ejemplo para cargar tus datos históricos"
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validar que sea CSV o Excel
      const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (allowedTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setSummary(null);
      } else {
        toast({
          title: "Formato no válido",
          description: "Por favor, sube un archivo CSV o Excel (.xlsx, .xls)",
          variant: "destructive"
        });
      }
    }
  };

  const processImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setProgress({ step: 'Iniciando importación...', current: 0, total: 100 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Crear un EventSource para recibir actualizaciones de progreso
      const eventSource = new EventSource('/api/bulk-import/progress');
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setProgress(data);
      };

      const response = await apiRequest('/api/bulk-import', 'POST', formData);
      
      eventSource.close();
      
      setSummary(response);
      setProgress({ step: 'Importación completada', current: 100, total: 100 });
      
      toast({
        title: "Importación exitosa",
        description: `Se crearon ${response.quotations} cotizaciones y ${response.projects} proyectos`
      });

    } catch (error) {
      console.error('Error en importación:', error);
      toast({
        title: "Error en importación",
        description: "Hubo un problema procesando el archivo. Revisa el formato e intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Importación Masiva de Proyectos</h1>
        <p className="text-gray-600 mt-2">
          Carga todos los proyectos históricos de la empresa desde enero hasta hoy
        </p>
      </div>

      {/* Instrucciones */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Cómo usar la importación masiva
          </CardTitle>
          <CardDescription>
            Sigue estos pasos para cargar todos tus proyectos históricos de una vez
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="bg-blue-100 rounded-full p-2">
                <Download className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">1. Descarga la plantilla</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Usa el archivo de ejemplo con las columnas correctas
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="bg-green-100 rounded-full p-2">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium">2. Completa tus datos</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Agrega toda la información de tus proyectos históricos
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="bg-purple-100 rounded-full p-2">
                <Upload className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium">3. Sube y procesa</h3>
                <p className="text-sm text-gray-600 mt-1">
                  El sistema creará automáticamente cotizaciones y proyectos
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Datos que se crearán automáticamente:</AlertTitle>
            <AlertDescription>
              • <strong>Cotizaciones históricas</strong> con los precios y márgenes originales<br/>
              • <strong>Proyectos activos/completados</strong> con fechas y estados correctos<br/>
              • <strong>Registros de tiempo y costos</strong> distribuidos según las horas trabajadas<br/>
              • <strong>Asignaciones de personal</strong> a cada proyecto histórico
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Descarga de plantilla */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Plantilla de Excel/CSV</CardTitle>
          <CardDescription>
            Descarga el archivo de ejemplo con todas las columnas necesarias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline" className="w-full md:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Descargar Plantilla CSV
          </Button>
        </CardContent>
      </Card>

      {/* Subida de archivo */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Subir Archivo de Proyectos</CardTitle>
          <CardDescription>
            Selecciona el archivo CSV o Excel con todos tus proyectos históricos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium">Haz clic para subir archivo</p>
              <p className="text-gray-600">Formatos: CSV, Excel (.xlsx, .xls)</p>
            </label>
          </div>

          {file && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Archivo seleccionado</AlertTitle>
              <AlertDescription>
                <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                <br />
                Listo para procesar. Haz clic en "Importar" para comenzar.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={processImport}
            disabled={!file || isImporting}
            className="w-full"
            size="lg"
          >
            {isImporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Procesando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importar Proyectos Históricos
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progreso de importación */}
      {progress && isImporting && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Progreso de Importación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{progress.step}</span>
                <span>{progress.current}/{progress.total}</span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} />
            </div>
            {progress.details && (
              <p className="text-sm text-gray-600">{progress.details}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resumen de importación */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Resumen de Importación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <Briefcase className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{summary.quotations}</p>
                  <p className="text-sm text-gray-600">Cotizaciones creadas</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <Users className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{summary.projects}</p>
                  <p className="text-sm text-gray-600">Proyectos creados</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{summary.timeEntries}</p>
                  <p className="text-sm text-gray-600">Registros de tiempo</p>
                </div>
              </div>
            </div>

            {summary.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Advertencias durante la importación:</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {summary.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}