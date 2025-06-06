import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Clock, TrendingUp, Users, DollarSign } from "lucide-react";
// Tipos locales para las props del componente
interface TimeEntry {
  id: number;
  projectId: number;
  personnelId: number;
  date: Date;
  hours: number;
  description?: string;
}

interface Personnel {
  id: number;
  name: string;
  roleId: number;
  hourlyRate: number;
}

interface SubprojectAlertsProps {
  timeEntries: TimeEntry[];
  personnel: Personnel[];
  estimatedHours: number;
  projectStartDate?: string;
  clientSubprojects?: Array<{
    id: number;
    name: string;
    totalHours: number;
    totalCost: number;
  }>;
}

interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  metric?: string;
  severity: number; // 1-5, 5 being most critical
}

export function SubprojectAlerts({ 
  timeEntries, 
  personnel, 
  estimatedHours, 
  projectStartDate,
  clientSubprojects = []
}: SubprojectAlertsProps) {
  const alerts: Alert[] = [];

  // Calcular métricas básicas
  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const totalCost = timeEntries.reduce((sum, entry) => {
    const person = personnel.find(p => p.id === entry.personnelId);
    const hourlyRate = person?.hourlyRate || 50; // Valor por defecto
    return sum + (entry.hours * hourlyRate);
  }, 0);
  const hoursProgress = estimatedHours > 0 ? (totalHours / estimatedHours) * 100 : 0;

  // 1. ALERTA: Sobrecosto de horas por subproyecto
  if (hoursProgress > 80) {
    alerts.push({
      id: 'hours_overrun',
      type: hoursProgress > 100 ? 'danger' : 'warning',
      title: hoursProgress > 100 ? 'Horas Excedidas' : 'Límite de Horas Próximo',
      description: `Has usado ${totalHours}h de ${estimatedHours}h estimadas (${hoursProgress.toFixed(1)}%)`,
      metric: `${hoursProgress.toFixed(1)}%`,
      severity: hoursProgress > 100 ? 5 : 3
    });
  }

  // 2. ALERTA: Sobrecarga de personal específico
  const hoursByPerson = timeEntries.reduce((acc, entry) => {
    const personId = entry.personnelId;
    if (!acc[personId]) {
      acc[personId] = { hours: 0, name: '' };
    }
    acc[personId].hours += entry.hours;
    
    const person = personnel.find(p => p.id === personId);
    acc[personId].name = person?.name || 'Desconocido';
    return acc;
  }, {} as Record<number, { hours: number; name: string }>);

  // Detectar personas con más del 40% de las horas totales del proyecto
  Object.entries(hoursByPerson).forEach(([personId, data]) => {
    const personPercentage = (data.hours / totalHours) * 100;
    if (personPercentage > 40 && totalHours > 10) {
      alerts.push({
        id: `person_overload_${personId}`,
        type: 'warning',
        title: 'Sobrecarga de Personal',
        description: `${data.name} tiene ${personPercentage.toFixed(1)}% de las horas del proyecto`,
        metric: `${personPercentage.toFixed(1)}%`,
        severity: 3
      });
    }
  });

  // 3. ALERTA: Progreso lento basado en tiempo transcurrido
  if (projectStartDate) {
    const startDate = new Date(projectStartDate);
    const now = new Date();
    const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Asumiendo proyectos de 30 días promedio
    const expectedDays = 30;
    const timeProgress = Math.min((daysElapsed / expectedDays) * 100, 100);
    
    if (timeProgress > hoursProgress + 20 && daysElapsed > 7) {
      alerts.push({
        id: 'slow_progress',
        type: 'warning',
        title: 'Progreso Lento',
        description: `${timeProgress.toFixed(1)}% del tiempo transcurrido vs ${hoursProgress.toFixed(1)}% de horas completadas`,
        metric: `-${(timeProgress - hoursProgress).toFixed(1)}%`,
        severity: 4
      });
    }
  }

  // 4. ALERTA: Comparativa con otros subproyectos del cliente
  if (clientSubprojects.length > 1) {
    const avgHoursPerProject = clientSubprojects.reduce((sum, proj) => sum + proj.totalHours, 0) / clientSubprojects.length;
    const avgCostPerProject = clientSubprojects.reduce((sum, proj) => sum + proj.totalCost, 0) / clientSubprojects.length;
    
    if (totalHours > avgHoursPerProject * 1.3) {
      alerts.push({
        id: 'above_avg_hours',
        type: 'info',
        title: 'Horas Superiores al Promedio',
        description: `Este subproyecto usa ${((totalHours / avgHoursPerProject - 1) * 100).toFixed(1)}% más horas que el promedio del cliente`,
        metric: `+${((totalHours / avgHoursPerProject - 1) * 100).toFixed(1)}%`,
        severity: 2
      });
    }

    if (totalCost > avgCostPerProject * 1.3) {
      alerts.push({
        id: 'above_avg_cost',
        type: 'info',
        title: 'Costo Superior al Promedio',
        description: `Este subproyecto cuesta ${((totalCost / avgCostPerProject - 1) * 100).toFixed(1)}% más que el promedio del cliente`,
        metric: `+${((totalCost / avgCostPerProject - 1) * 100).toFixed(1)}%`,
        severity: 2
      });
    }
  }

  // 5. ALERTA: Eficiencia por rol
  const hoursByRole = timeEntries.reduce((acc, entry) => {
    const person = personnel.find(p => p.id === entry.personnelId);
    const roleId = person?.roleId || 0;
    const hourlyRate = person?.hourlyRate || 50;
    
    if (!acc[roleId]) {
      acc[roleId] = { hours: 0, cost: 0, roleName: '' };
    }
    acc[roleId].hours += entry.hours;
    acc[roleId].cost += entry.hours * hourlyRate;
    return acc;
  }, {} as Record<number, { hours: number; cost: number; roleName: string }>);

  // Detectar si hay desequilibrio entre roles senior/junior
  const totalSeniorHours = Object.values(hoursByRole).reduce((sum, role) => sum + role.hours, 0);
  if (totalSeniorHours > 0) {
    // Lógica simplificada: si más del 70% son horas senior, alertar
    Object.entries(hoursByRole).forEach(([roleId, data]) => {
      const rolePercentage = (data.hours / totalSeniorHours) * 100;
      if (rolePercentage > 70 && parseInt(roleId) > 10) { // Asumiendo roles senior tienen ID > 10
        alerts.push({
          id: `role_imbalance_${roleId}`,
          type: 'info',
          title: 'Desequilibrio de Roles',
          description: `${rolePercentage.toFixed(1)}% de las horas son de roles senior - considera delegación`,
          metric: `${rolePercentage.toFixed(1)}%`,
          severity: 2
        });
      }
    });
  }

  // Ordenar alertas por severidad
  alerts.sort((a, b) => b.severity - a.severity);

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <TrendingUp className="h-5 w-5" />
            Estado Óptimo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-600">El subproyecto está operando dentro de los parámetros esperados.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
        Alertas de Eficiencia ({alerts.length})
      </h3>
      
      <div className="grid gap-3">
        {alerts.map((alert) => (
          <Card key={alert.id} className={`border-l-4 ${
            alert.type === 'danger' ? 'border-l-red-500 bg-red-50' :
            alert.type === 'warning' ? 'border-l-orange-500 bg-orange-50' :
            'border-l-blue-500 bg-blue-50'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {alert.type === 'danger' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    {alert.type === 'warning' && <Clock className="h-4 w-4 text-orange-500" />}
                    {alert.type === 'info' && <TrendingUp className="h-4 w-4 text-blue-500" />}
                    <span className="font-medium text-sm">{alert.title}</span>
                  </div>
                  <p className="text-sm text-gray-700">{alert.description}</p>
                </div>
                {alert.metric && (
                  <Badge variant={alert.type === 'danger' ? 'destructive' : 'secondary'} className="ml-3">
                    {alert.metric}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Panel de Métricas Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resumen de Eficiencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Progreso de Horas</span>
              <span>{hoursProgress.toFixed(1)}%</span>
            </div>
            <Progress value={Math.min(hoursProgress, 100)} className="h-2" />
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-lg font-bold">{totalHours}h</div>
              <div className="text-xs text-gray-600">Registradas</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-lg font-bold">{estimatedHours}h</div>
              <div className="text-xs text-gray-600">Estimadas</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-lg font-bold">${totalCost.toFixed(0)}</div>
              <div className="text-xs text-gray-600">Costo Actual</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}