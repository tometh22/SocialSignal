import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, TrendingUp, Database } from 'lucide-react';
import SalesImport from '@/components/google-sheets/SalesImport';

export default function ExcelMaestroPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileSpreadsheet className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Excel MAESTRO</h1>
          </div>
          <p className="text-gray-600">
            Gestión e importación de datos desde el Excel MAESTRO de Epical Digital
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Info */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Funcionalidades</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Ventas Tomi</h4>
                    <p className="text-sm text-muted-foreground">
                      Importar datos de ventas operacionales
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Proyectos</h4>
                    <p className="text-sm text-muted-foreground">
                      Sincronizar proyectos confirmados
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estado de Conexión</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Google Sheets API</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Base de Datos</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="sales" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sales">Ventas Tomi</TabsTrigger>
                <TabsTrigger value="projects">Proyectos</TabsTrigger>
              </TabsList>

              <TabsContent value="sales" className="space-y-6">
                <SalesImport />
              </TabsContent>

              <TabsContent value="projects" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Importación de Proyectos</CardTitle>
                    <CardDescription>
                      Funcionalidad existente para importar proyectos confirmados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Esta funcionalidad ya está implementada en otras secciones del sistema.
                      Los proyectos confirmados se importan automáticamente desde la pestaña 
                      "Proyectos confirmados y estimados" del Excel MAESTRO.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}