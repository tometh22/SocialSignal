import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { addDays, format, differenceInDays } from "date-fns";

interface CompletionPredictorProps {
  timeEntries: Array<{
    id: number;
    date: Date | string;
    hours: number;
  }>;
  estimatedHours: number;
  startDate?: string;
  currentHours: number;
}

export function CompletionPredictor({
  timeEntries,
  estimatedHours,
  startDate,
  currentHours
}: CompletionPredictorProps) {
  // Calcular velocidad promedio (horas por día)
  const calculateVelocity = () => {
    if (timeEntries.length === 0 || !startDate) return 0;
    
    const start = new Date(startDate);
    const now = new Date();
    const daysElapsed = Math.max(1, differenceInDays(now, start));
    
    return currentHours / daysElapsed;
  };

  // Predecir fecha de finalización
  const predictCompletionDate = () => {
    const velocity = calculateVelocity();
    if (velocity === 0) return null;
    
    const remainingHours = Math.max(0, estimatedHours - currentHours);
    const daysToComplete = Math.ceil(remainingHours / velocity);
    
    return addDays(new Date(), daysToComplete);
  };

  // Calcular tendencia semanal
  const calculateWeeklyTrend = () => {
    if (timeEntries.length < 7) return null;
    
    const now = new Date();
    const oneWeekAgo = addDays(now, -7);
    const twoWeeksAgo = addDays(now, -14);
    
    const thisWeekHours = timeEntries
      .filter(entry => new Date(entry.date) >= oneWeekAgo)
      .reduce((sum, entry) => sum + entry.hours, 0);
    
    const lastWeekHours = timeEntries
      .filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= twoWeeksAgo && entryDate < oneWeekAgo;
      })
      .reduce((sum, entry) => sum + entry.hours, 0);
    
    if (lastWeekHours === 0) return null;
    
    return ((thisWeekHours - lastWeekHours) / lastWeekHours) * 100;
  };

  const velocity = calculateVelocity();
  const predictedDate = predictCompletionDate();
  const weeklyTrend = calculateWeeklyTrend();
  const progress = estimatedHours > 0 ? (currentHours / estimatedHours) * 100 : 0;
  const isOnTrack = progress <= 100;
  const remainingHours = Math.max(0, estimatedHours - currentHours);

  // Determinar estado del proyecto
  const getProjectStatus = () => {
    if (progress >= 100) return { status: "completed", color: "green", icon: CheckCircle };
    if (progress >= 80) return { status: "warning", color: "orange", icon: AlertTriangle };
    return { status: "on_track", color: "blue", icon: TrendingUp };
  };

  const projectStatus = getProjectStatus();

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <projectStatus.icon className={`h-5 w-5 text-${projectStatus.color}-500`} />
          Predicción de Finalización
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas Principales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">
              {velocity.toFixed(1)}h
            </div>
            <div className="text-sm text-gray-600">Velocidad/día</div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">
              {remainingHours.toFixed(1)}h
            </div>
            <div className="text-sm text-blue-600">Restantes</div>
          </div>
          
          <div className={`bg-${projectStatus.color}-50 p-4 rounded-lg text-center`}>
            <div className={`text-2xl font-bold text-${projectStatus.color}-600`}>
              {predictedDate ? Math.ceil((predictedDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : '?'}
            </div>
            <div className={`text-sm text-${projectStatus.color}-600`}>Días estimados</div>
          </div>
        </div>

        {/* Fecha de Finalización Predicha */}
        {predictedDate && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-purple-600" />
              <div>
                <div className="font-medium text-purple-900">
                  Finalización Estimada: {format(predictedDate, 'dd/MM/yyyy')}
                </div>
                <div className="text-sm text-purple-600">
                  Basado en velocidad actual de {velocity.toFixed(1)} horas/día
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tendencia Semanal */}
        {weeklyTrend !== null && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-5 w-5 ${weeklyTrend >= 0 ? 'text-green-500' : 'text-red-500'}`} />
              <span className="text-sm font-medium">Tendencia Semanal:</span>
            </div>
            <Badge variant={weeklyTrend >= 0 ? "default" : "destructive"}>
              {weeklyTrend >= 0 ? '+' : ''}{weeklyTrend.toFixed(1)}%
            </Badge>
          </div>
        )}

        {/* Alertas y Recomendaciones */}
        {progress > 80 && progress < 100 && (
          <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-orange-900">Proyecto cerca del límite</div>
              <div className="text-sm text-orange-700">
                Considera revisar el alcance o solicitar horas adicionales al PM.
              </div>
            </div>
          </div>
        )}

        {progress >= 100 && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-red-900">Proyecto excedido</div>
              <div className="text-sm text-red-700">
                Contacta al PM inmediatamente para revisar el presupuesto y cronograma.
              </div>
            </div>
          </div>
        )}

        {velocity < 1 && timeEntries.length > 5 && (
          <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Clock className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-yellow-900">Progreso lento detectado</div>
              <div className="text-sm text-yellow-700">
                La velocidad actual puede resultar en retrasos. Considera aumentar la dedicación diaria.
              </div>
            </div>
          </div>
        )}

        {/* Barra de Progreso Visual */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progreso del proyecto</span>
            <span className={progress > 100 ? 'text-red-600 font-medium' : 'text-gray-600'}>
              {progress.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={Math.min(progress, 100)} 
            className={`h-3 ${progress > 100 ? 'bg-red-100' : 'bg-gray-200'}`}
          />
          {progress > 100 && (
            <div className="text-xs text-red-600 text-right">
              Excedido en {(progress - 100).toFixed(1)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}