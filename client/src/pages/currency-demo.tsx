import React from 'react';
import { CurrencyConverter } from '@/components/currency/CurrencyConverter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Database, Globe, CheckCircle } from 'lucide-react';

export default function CurrencyDemo() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Sistema de Tipos de Cambio USD/ARS</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Sistema completo de conversión de monedas integrado con datos históricos del BCRA 
          obtenidos desde el Excel MAESTRO de Epical Digital.
        </p>
      </div>

      {/* Estado del sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Estado del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <Database className="h-8 w-8 text-green-600" />
              <div>
                <div className="font-medium text-green-900">Base de Datos</div>
                <div className="text-sm text-green-700">16 registros históricos</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Globe className="h-8 w-8 text-blue-600" />
              <div>
                <div className="font-medium text-blue-900">Excel MAESTRO</div>
                <div className="text-sm text-blue-700">Conexión activa</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <div className="font-medium text-purple-900">Rango BCRA</div>
                <div className="text-sm text-purple-700">ARS 645 - ARS 1030</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversor principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CurrencyConverter />
        </div>
        
        <div className="space-y-4">
          {/* Información técnica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Características Técnicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Fuente de datos</span>
                <Badge variant="secondary">BCRA Oficial</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Período disponible</span>
                <Badge variant="outline">Sep 2023 - Dic 2024</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Frecuencia</span>
                <Badge variant="outline">Mensual</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Última actualización</span>
                <Badge variant="outline">En tiempo real</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Endpoints disponibles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">APIs Disponibles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  GET /api/exchange-rates
                </code>
                <p className="text-muted-foreground mt-1">Obtener todos los tipos de cambio</p>
              </div>
              <div className="text-sm">
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  GET /api/exchange-rates/2024/12
                </code>
                <p className="text-muted-foreground mt-1">Tipo de cambio específico</p>
              </div>
              <div className="text-sm">
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  GET /api/google-sheets/tipos-cambio
                </code>
                <p className="text-muted-foreground mt-1">Datos directos del Excel MAESTRO</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Casos de uso */}
      <Card>
        <CardHeader>
          <CardTitle>Casos de Uso en el Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Cotizaciones Duales</h4>
              <p className="text-sm text-muted-foreground">
                Las cotizaciones pueden presentarse tanto en USD como en ARS usando tipos históricos 
                para mayor flexibilidad comercial.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Análisis Financiero</h4>
              <p className="text-sm text-muted-foreground">
                Conversión automática para reportes internos y análisis de rentabilidad 
                en moneda local o internacional.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Proyectos Históricos</h4>
              <p className="text-sm text-muted-foreground">
                Evaluación de proyectos anteriores con tipos de cambio correspondientes 
                al período de ejecución.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Planificación Presupuestaria</h4>
              <p className="text-sm text-muted-foreground">
                Estimaciones precisas considerando volatilidad cambiaria y tendencias 
                históricas del peso argentino.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}