import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FinancialSummaryProps {
  baseCost: number;
  complexityAdjustment: number;
  totalAmount: number;
}

export function FinancialSummary({ 
  baseCost = 0, 
  complexityAdjustment = 0, 
  totalAmount = 0 
}: FinancialSummaryProps) {
  // Estado local para garantizar siempre valores válidos
  const [localBaseCost, setLocalBaseCost] = useState(0);
  const [localAdjustment, setLocalAdjustment] = useState(0);
  const [localTotal, setLocalTotal] = useState(0);
  
  // Forzar la actualización de valores cuando cambian las props
  useEffect(() => {
      baseCost,
      complexityAdjustment,
      totalAmount
    });
    
    // Actualizar los valores locales con valores válidos (nunca null/undefined)
    setLocalBaseCost(baseCost || 0);
    setLocalAdjustment(complexityAdjustment || 0);
    setLocalTotal(totalAmount || 0);
  }, [baseCost, complexityAdjustment, totalAmount]);
  
  // Datos para la visualización - forzar actualización inmediata del gráfico
  const chartData = React.useMemo(() => [
    { name: 'Costo Base', valor: localBaseCost },
    { name: 'Ajuste', valor: localAdjustment },
    { name: 'Total', valor: localTotal }
  ], [localBaseCost, localAdjustment, localTotal]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Resumen de Costos</CardTitle>
        <CardDescription>Vista previa del impacto de tus selecciones</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Valor']} />
              <Bar 
                dataKey="valor" 
                fill="#94a3b8"
                radius={[4, 4, 0, 0]} 
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-600">Costo Base:</span>
            <span className="font-medium">${localBaseCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600">Ajuste de Complejidad:</span>
            <span className="font-medium">${localAdjustment.toFixed(2)}</span>
          </div>
          <div className="col-span-2 pt-2 mt-2 border-t flex justify-between">
            <span className="font-medium">Total Estimado:</span>
            <span className="font-bold text-primary">${localTotal.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}