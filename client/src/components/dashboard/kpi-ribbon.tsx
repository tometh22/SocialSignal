import React from 'react';
import { ExternalLink, Clock, DollarSign, Timer, Activity } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { motion } from "framer-motion";

interface KpiRibbonProps {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  costData: {
    actualCost: number;
    estimatedCost: number;
    percentageUsed: number;
  };
  timeData: {
    daysRemaining: number;
    daysTotal: number;
    progressPercentage: number;
  };
  onHelpClick: (helpType: string) => void;
}

export const KpiRibbon = ({
  totalHours,
  billableHours,
  nonBillableHours,
  costData,
  timeData,
  onHelpClick
}: KpiRibbonProps) => {
  const { actualCost, estimatedCost, percentageUsed } = costData;
  const { daysRemaining, daysTotal, progressPercentage } = timeData;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI: Horas Registradas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="overflow-hidden border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-medium text-blue-800">Horas Registradas</CardTitle>
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-3xl font-bold text-blue-700">{totalHours}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {billableHours} facturables / {nonBillableHours} no facturables
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-0"
                  onClick={() => onHelpClick('hoursHelp')}
                >
                  <span className="sr-only">Más información</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-1">Distribución</div>
                <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                  {totalHours > 0 && (
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(billableHours / totalHours) * 100}%` }}
                    ></div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* KPI: Costo vs Presupuesto */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="overflow-hidden border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100 pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-medium text-emerald-800">Costo vs Presupuesto</CardTitle>
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-3xl font-bold text-emerald-700">{formatCurrency(actualCost || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    de {formatCurrency(estimatedCost || 0)} presupuestados
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 p-0"
                  onClick={() => onHelpClick('costHelp')}
                >
                  <span className="sr-only">Más información</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-1">
                  {percentageUsed?.toFixed(1)}% del presupuesto usado
                </div>
                <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      percentageUsed > 90
                        ? "bg-red-500"
                        : percentageUsed > 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${percentageUsed || 0}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* KPI: Tiempo Restante */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="overflow-hidden border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-amber-100 pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-medium text-amber-800">Tiempo Restante</CardTitle>
                <Timer className="h-5 w-5 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-3xl font-bold text-amber-700">{daysRemaining}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    días de {daysTotal} totales
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 p-0"
                  onClick={() => onHelpClick('timeHelp')}
                >
                  <span className="sr-only">Más información</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-1">
                  {Math.round(progressPercentage)}% completado
                </div>
                <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default KpiRibbon;