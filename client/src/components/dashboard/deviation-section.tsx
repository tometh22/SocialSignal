import React from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import {
  AlertCircle,
  Calendar,
  DollarSign,
  TrendingDown,
  TrendingUp,
  HelpCircle,
  AlertTriangle,
  Gauge,
  Timer
} from 'lucide-react';

interface DeviationSectionProps {
  costVariance: number;
  scheduleVariance: number;
  riskMetrics: {
    budgetRisk: number;
    scheduleRisk: number;
    activeAlerts: number;
  };
  onHelpClick: (helpType: string) => void;
  showRisks?: boolean;
}

export const DeviationSection = ({
  costVariance,
  scheduleVariance,
  riskMetrics,
  onHelpClick,
  showRisks = true
}: DeviationSectionProps) => {
  const { budgetRisk, scheduleRisk, activeAlerts } = riskMetrics;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Desviaciones */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-medium">Monitor de Desviaciones</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-6 w-6"
                  onClick={() => onHelpClick('deviationHelp')}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Desviación de costo */}
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Desviación de costo</div>
                      <div className="text-xs text-muted-foreground">Comparado con lo presupuestado</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold flex items-center gap-1">
                    {costVariance > 0 ? (
                      <>
                        <TrendingUp className={`h-5 w-5 ${costVariance > 10 ? "text-red-500" : "text-amber-500"}`} />
                        <span className={costVariance > 10 ? "text-red-500" : "text-amber-500"}>
                          +{costVariance.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-5 w-5 text-green-500" />
                        <span className="text-green-500">{costVariance.toFixed(1)}%</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Desviación de tiempo */}
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Desviación de tiempo</div>
                      <div className="text-xs text-muted-foreground">Comparado con el plan inicial</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold flex items-center gap-1">
                    {scheduleVariance > 0 ? (
                      <>
                        <TrendingUp className="h-5 w-5 text-amber-500" />
                        <span className="text-amber-500">
                          +{scheduleVariance.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-5 w-5 text-green-500" />
                        <span className="text-green-500">
                          {scheduleVariance.toFixed(1)}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Indicadores de Riesgo - Solo se muestra si showRisks es true */}
        {showRisks && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-medium">Monitor de Riesgos</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-6 w-6"
                    onClick={() => onHelpClick('riskHelp')}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Riesgo de presupuesto */}
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        budgetRisk >= 75
                          ? "bg-red-100 text-red-500"
                          : budgetRisk >= 50
                            ? "bg-amber-100 text-amber-500"
                            : "bg-green-100 text-green-500"
                      }`}>
                        <Gauge className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Riesgo de presupuesto</div>
                        <div className="text-xs text-muted-foreground">Probabilidad de exceder el presupuesto</div>
                      </div>
                    </div>
                    <div className="w-32">
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            budgetRisk >= 75
                              ? "bg-red-500"
                              : budgetRisk >= 50
                                ? "bg-amber-500"
                                : "bg-green-500"
                          }`}
                          style={{ width: `${budgetRisk}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-right mt-1 text-muted-foreground">
                        {budgetRisk}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Riesgo de cronograma */}
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        scheduleRisk >= 75
                          ? "bg-red-100 text-red-500"
                          : scheduleRisk >= 50
                            ? "bg-amber-100 text-amber-500"
                            : "bg-green-100 text-green-500"
                      }`}>
                        <Timer className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Riesgo de cronograma</div>
                        <div className="text-xs text-muted-foreground">Probabilidad de retraso en la entrega</div>
                      </div>
                    </div>
                    <div className="w-32">
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            scheduleRisk >= 75
                              ? "bg-red-500"
                              : scheduleRisk >= 50
                                ? "bg-amber-500"
                                : "bg-green-500"
                          }`}
                          style={{ width: `${scheduleRisk}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-right mt-1 text-muted-foreground">
                        {scheduleRisk}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Alertas activas */}
                  {activeAlerts > 0 && (
                    <div className="flex items-center justify-between mt-4 p-3 rounded-lg bg-red-50 border border-red-100">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-red-700">
                          {activeAlerts} alerta{activeAlerts > 1 ? 's' : ''} activa{activeAlerts > 1 ? 's' : ''}
                        </span>
                      </div>
                      <Button size="sm" variant="outline" className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-100">
                        Ver detalles
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DeviationSection;