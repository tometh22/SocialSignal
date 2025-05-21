import React from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { CalendarIcon, Clock, DollarSign, Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

interface Entregable {
  id: string;
  tipo: string;
  frecuencia: string;
  descripcion: string;
  presupuesto: number;
}

interface Equipo {
  nombre: string;
  rol: string;
  horas: number;
  tarifa: number;
}

interface AlwaysOnProjectSummaryProps {
  cliente: string;
  proyecto: string;
  fechaInicio: string;
  presupuestoMensual: number;
  entregables: Entregable[];
  equipo: Equipo[];
  costoAdicional?: number;
}

const obtenerIconoFrecuencia = (frecuencia: string) => {
  switch (frecuencia) {
    case 'weekly': return <Badge variant="outline" className="bg-blue-50">Semanal</Badge>;
    case 'biweekly': return <Badge variant="outline" className="bg-green-50">Quincenal</Badge>;
    case 'monthly': return <Badge variant="outline" className="bg-purple-50">Mensual</Badge>;
    case 'quarterly': return <Badge variant="outline" className="bg-amber-50">Trimestral</Badge>;
    default: return <Badge variant="outline">Personalizado</Badge>;
  }
};

const obtenerIconoTipo = (tipo: string) => {
  switch (tipo) {
    case 'report': return <Badge>Informe de tendencias</Badge>;
    case 'analysis': return <Badge variant="secondary">Análisis estadístico</Badge>;
    case 'monitoring': return <Badge variant="destructive">Monitoreo en tiempo real</Badge>;
    case 'dashboard': return <Badge variant="outline">Dashboard de performance</Badge>;
    default: return <Badge variant="default">Personalizado</Badge>;
  }
};

const calcularCostoEquipo = (equipo: Equipo[]) => {
  return equipo.reduce((total, miembro) => total + (miembro.horas * miembro.tarifa), 0);
};

export const AlwaysOnProjectSummary: React.FC<AlwaysOnProjectSummaryProps> = ({
  cliente,
  proyecto,
  fechaInicio,
  presupuestoMensual,
  entregables,
  equipo,
  costoAdicional
}) => {
  const costoEquipo = calcularCostoEquipo(equipo);
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">{proyecto}</CardTitle>
              <CardDescription className="mt-1">
                Cliente: {cliente} · Inicio: {fechaInicio}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              <DollarSign className="h-4 w-4 mr-1" />
              {formatCurrency(presupuestoMensual)}/mes
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Resumen de entregables */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Repeat className="h-5 w-5 mr-2 text-primary" />
              Entregables incluidos
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Presupuesto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entregables.map((entregable) => (
                  <TableRow key={entregable.id}>
                    <TableCell>{obtenerIconoTipo(entregable.tipo)}</TableCell>
                    <TableCell>{obtenerIconoFrecuencia(entregable.frecuencia)}</TableCell>
                    <TableCell className="max-w-xs truncate">{entregable.descripcion}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(entregable.presupuesto)}
                    </TableCell>
                  </TableRow>
                ))}
                {costoAdicional && costoAdicional > 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={3} className="font-medium">
                      Precio por reportes adicionales (fuera del alcance)
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(costoAdicional)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Resumen del equipo */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-primary" />
              Equipo Asignado
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Miembro</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Horas/mes</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipo.map((miembro, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{miembro.nombre}</TableCell>
                    <TableCell>{miembro.rol}</TableCell>
                    <TableCell className="text-right">{miembro.horas}</TableCell>
                    <TableCell className="text-right">${miembro.tarifa.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${(miembro.horas * miembro.tarifa).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={3}></TableCell>
                  <TableCell className="font-semibold text-right">Total Equipo:</TableCell>
                  <TableCell className="font-semibold text-right">${costoEquipo.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          
          {/* Aviso importante */}
          {presupuestoMensual > costoEquipo && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> El presupuesto mensual total (${presupuestoMensual.toFixed(2)}) 
                incluye costos adicionales como licencias de plataformas, herramientas de análisis 
                y otros gastos operativos además del costo base del equipo (${costoEquipo.toFixed(2)}).
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};